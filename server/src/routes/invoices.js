const express = require('express');
const { db, all, get, run } = require('../../db');
const { nextDocNumber, asInvoiceNumber } = require('../utils/numbering');
const { requireModuleEdit } = require('../middleware/auth');
const { round2, refreshInvoiceStatus } = require('../utils/payments');
const { attachFiles, mountPaymentFileRoutes, deleteFilesOfPayment, paymentUpload, saveFilesForPayment } = require('../utils/paymentFiles');

const router = express.Router();
router.use(requireModuleEdit('facturas'));

function withItems(inv) {
  if (!inv) return inv;
  inv.items = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
  return inv;
}

// Devuelve la factura completa tal como la necesita el cliente: datos del cliente (vía
// JOIN), sus líneas, y las órdenes de trabajo que la originaron. Se usa en todas las rutas
// que responden con una factura -no solo GET /:id- para que ninguna respuesta deje "a
// medias" los datos del cliente o el enlace a sus órdenes de trabajo (eso fue justo el bug:
// una respuesta armada a mano con un SELECT * FROM invoices, sin el JOIN, vaciaba en
// pantalla la sección "Facturar a" en cuanto se usaba esa respuesta para actualizar la
// factura en pantalla sin recargar la página).
function getFullInvoice(id) {
  const inv = get(
    `SELECT i.*, c.name as customer_name, c.address as customer_address, c.city as customer_city, c.zip as customer_zip, c.tax_id as customer_tax_id, c.phone as customer_phone, c.email as customer_email
     FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`,
    [id]
  );
  if (!inv) return inv;
  withItems(inv);
  inv.workOrders = all('SELECT id, number, status FROM work_orders WHERE invoice_id = ?', [inv.id]);
  inv.payments = all(
    `SELECT p.*, u.name AS created_by_name FROM invoice_payments p
     LEFT JOIN users u ON u.id = p.created_by WHERE p.invoice_id = ? ORDER BY p.payment_date, p.id`,
    [inv.id]
  );
  attachFiles(inv.payments, 'invoice');
  inv.paid = round2(inv.payments.reduce((s, p) => s + Number(p.amount || 0), 0));
  inv.surcharges = round2(inv.payments.reduce((s, p) => s + Number(p.surcharge || 0), 0));
  inv.balance = round2(Number(inv.total || 0) - inv.paid);
  return inv;
}

function computeTotals(items, taxRate) {
  const subtotal = items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unitPrice ?? it.unit_price), 0);
  const taxAmount = Math.round(subtotal * (Number(taxRate || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, taxAmount, total };
}

// ---- Lógica de aplicación real de cambios (usada directamente por admin, o por la
// ruta de aprobaciones cuando el administrador aprueba la solicitud de otro usuario) ----
function applyUpdate(id, b) {
  const existing = get('SELECT * FROM invoices WHERE id = ?', [id]);
  if (!existing) throw new Error('Factura no encontrada');

  let subtotal = existing.subtotal, taxAmount = existing.tax_amount, total = existing.total;
  const taxRate = b.taxRate ?? existing.tax_rate;

  if (Array.isArray(b.items)) {
    run('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
    for (const item of b.items) {
      run(
        `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price) VALUES (?,?,?,?,?)`,
        [id, item.productId || null, item.description, item.quantity, item.unitPrice]
      );
    }
    const totals = computeTotals(b.items, taxRate);
    subtotal = totals.subtotal; taxAmount = totals.taxAmount; total = totals.total;
  }

  const includeWireInfo = b.includeWireInfo !== undefined ? (b.includeWireInfo ? 1 : 0) : existing.include_wire_info;
  run(
    `UPDATE invoices SET status=?, due_date=?, subtotal=?, tax_rate=?, tax_amount=?, total=?, notes=?, include_wire_info=? WHERE id=?`,
    [b.status ?? existing.status, b.dueDate ?? existing.due_date, subtotal, taxRate, taxAmount, total, b.notes ?? existing.notes, includeWireInfo, id]
  );
  // El estado de cobro (pendiente/parcial/pagada) sale de los pagos registrados.
  if (b.status === undefined || ['pendiente', 'parcial', 'pagada'].includes(b.status)) refreshInvoiceStatus(id);
  return get('SELECT * FROM invoices WHERE id = ?', [id]);
}

// Borrar una factura deja todo lo que estaba ligado a ella como si nunca se hubiera
// facturado: las órdenes de trabajo vuelven a "completado" (se pueden facturar de nuevo),
// el pedido de origen vuelve a "aprobado" y los seriales vendidos con ella vuelven a
// "disponible". Sus líneas y pagos se borran con ella.
function applyDelete(id) {
  db.exec('BEGIN');
  try {
    run(`UPDATE work_orders SET invoice_id = NULL, status = 'completado' WHERE invoice_id = ?`, [id]);
    const inv = get('SELECT sales_order_id FROM invoices WHERE id = ?', [id]);
    if (inv && inv.sales_order_id) run(`UPDATE sales_orders SET status = 'aprobado' WHERE id = ? AND status = 'facturado'`, [inv.sales_order_id]);
    const sold = all(`SELECT id FROM product_serials WHERE invoice_id = ?`, [id]);
    for (const sr of sold) {
      run(`UPDATE product_serials SET invoice_id = NULL, customer_id = CASE WHEN vehicle_id IS NULL THEN NULL ELSE customer_id END,
             status = CASE WHEN status = 'vendido' THEN 'disponible' ELSE status END WHERE id = ?`, [sr.id]);
      run(`INSERT INTO serial_events (serial_id, event, notes) VALUES (?, 'disponible', 'Factura eliminada')`, [sr.id]);
    }
    run('DELETE FROM invoices WHERE id = ?', [id]);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const PAID_SQL = `(SELECT COALESCE(SUM(p.amount),0) FROM invoice_payments p WHERE p.invoice_id = i.id)`;

router.get('/', (req, res) => {
  const list = all(
    `SELECT i.*, c.name as customer_name, ROUND(${PAID_SQL}, 2) AS paid, ROUND(i.total - ${PAID_SQL}, 2) AS balance
     FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id ORDER BY i.created_at DESC`
  );
  res.json(list);
});

// Cartera (cuentas por cobrar): facturas con saldo, con días vencidos y rango de antigüedad.
// Si la factura no tiene fecha de vencimiento se toma la fecha de emisión + los días de
// crédito indicados (por omisión 30, lo habitual con municipios: Net 30).
router.get('/receivables', (req, res) => {
  const termDays = Math.max(0, parseInt(req.query.termDays, 10) || 30);
  const rows = all(
    `SELECT i.id, i.number, i.customer_id, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
            date(i.issue_date) AS issue_date,
            COALESCE(date(i.due_date), date(i.issue_date, '+' || ? || ' days')) AS due_date,
            i.due_date IS NULL AS due_date_estimated,
            i.total, i.status, ROUND(${PAID_SQL}, 2) AS paid, ROUND(i.total - ${PAID_SQL}, 2) AS balance,
            (SELECT MAX(p.payment_date) FROM invoice_payments p WHERE p.invoice_id = i.id) AS last_payment
     FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
     WHERE i.status NOT IN ('cancelado','anulada') ${req.query.includePaid === '1' ? '' : `AND ROUND(i.total - ${PAID_SQL}, 2) > 0.004`}
     ORDER BY due_date`,
    [termDays]
  );
  const today = new Date().toISOString().slice(0, 10);
  const dayMs = 86400000;
  for (const r of rows) {
    const days = Math.floor((Date.parse(today) - Date.parse(r.due_date)) / dayMs);
    r.days_overdue = Number.isNaN(days) ? 0 : days;
    r.bucket = r.balance <= 0.004 ? 'pagada' : r.days_overdue <= 0 ? 'corriente' : r.days_overdue <= 30 ? '1-30' : r.days_overdue <= 60 ? '31-60' : r.days_overdue <= 90 ? '61-90' : '+90';
    r.due_date_estimated = !!r.due_date_estimated;
  }
  res.json({ today, termDays, rows });
});

router.get('/:id', (req, res) => {
  const inv = getFullInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(inv);
});

// Crear factura directa (con items propios) o a partir de un pedido (salesOrderId).
// La creación no pasa por aprobación: solo la edición/eliminación de una factura ya existente.
router.post('/', (req, res) => {
  const b = req.body;
  let items = b.items;
  let customerId = b.customerId;
  let salesOrderId = b.salesOrderId || null;
  let sourceSalesOrder = null;

  if (salesOrderId) {
    sourceSalesOrder = get('SELECT * FROM sales_orders WHERE id = ?', [salesOrderId]);
    if (!sourceSalesOrder) return res.status(404).json({ error: 'Pedido no encontrado' });
    customerId = sourceSalesOrder.customer_id;
    items = all('SELECT * FROM sales_order_items WHERE sales_order_id = ?', [salesOrderId]);
  }

  if (!customerId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cliente e items son obligatorios' });
  }

  const taxRate = b.taxRate ?? 0;
  const { subtotal, taxAmount, total } = computeTotals(items, taxRate);
  // Número de factura: NX-INV-AAAAMMDD-NN (el código INV identifica que es una factura
  // y no un pedido o una orden de trabajo). Si la factura nace de un pedido (cotización),
  // conserva la misma fecha y consecutivo del pedido, cambiando el código QT por INV, para
  // que quede clara la relación entre ambos documentos; si es una factura directa, genera
  // su propio número del día.
  const number = sourceSalesOrder ? asInvoiceNumber(sourceSalesOrder.number) : nextDocNumber('invoices', 'INV');

  const result = run(
    `INSERT INTO invoices (number, customer_id, sales_order_id, status, due_date, subtotal, tax_rate, tax_amount, total, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [number, customerId, salesOrderId, b.status || 'pendiente', b.dueDate || null, subtotal, taxRate, taxAmount, total, b.notes || null]
  );
  const invId = result.lastInsertRowid;
  for (const item of items) {
    run(
      `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price) VALUES (?,?,?,?,?)`,
      [invId, item.productId || item.product_id || null, item.description, item.quantity, item.unitPrice ?? item.unit_price]
    );
  }
  if (salesOrderId) {
    run(`UPDATE sales_orders SET status = 'facturado' WHERE id = ?`, [salesOrderId]);
  }
  res.status(201).json(getFullInvoice(invId));
});

// Facturar una o varias órdenes de trabajo ya completadas, directamente desde la ficha
// del vehículo o la lista de órdenes de trabajo (sin tener que armar la factura a mano).
// Cada línea del detalle de la factura se arma a partir de los servicios y partes de las
// órdenes seleccionadas, y queda identificada con el número de la orden de trabajo de
// origen para poder rastrearla después.
//
// Para evitar facturar dos veces lo mismo, o mezclar trabajo de clientes distintos en una
// sola factura por error, se valida que cada orden de trabajo: exista, esté "completada",
// no tenga ya una factura asociada (una vez facturada queda marcada, así que no puede
// volver a elegirse), y pertenezca al mismo cliente que las demás órdenes seleccionadas.
// No se intenta adivinar qué órdenes "son de la misma visita" por fecha: el usuario elige
// explícitamente cuáles facturar juntas, y el sistema solo evita duplicar o mezclar clientes.
router.post('/from-work-orders', (req, res) => {
  const workOrderIds = Array.isArray(req.body.workOrderIds) ? req.body.workOrderIds : [];
  if (workOrderIds.length === 0) {
    return res.status(400).json({ error: 'Seleccione al menos una orden de trabajo para facturar' });
  }

  const placeholders = workOrderIds.map(() => '?').join(',');
  const workOrders = all(
    `SELECT wo.*, v.customer_id FROM work_orders wo
     LEFT JOIN vehicles v ON v.id = wo.vehicle_id WHERE wo.id IN (${placeholders})`,
    workOrderIds
  );
  if (workOrders.length !== workOrderIds.length) {
    return res.status(404).json({ error: 'Una o más órdenes de trabajo no existen' });
  }
  const alreadyInvoiced = workOrders.find((wo) => wo.invoice_id);
  if (alreadyInvoiced) {
    return res.status(400).json({ error: `La orden ${alreadyInvoiced.number} ya fue facturada` });
  }
  const notCompleted = workOrders.find((wo) => wo.status !== 'completado');
  if (notCompleted) {
    return res.status(400).json({ error: `La orden ${notCompleted.number} no está completada todavía` });
  }
  const customerId = workOrders[0].customer_id;
  if (!customerId) {
    return res.status(400).json({ error: 'El vehículo de la orden de trabajo no tiene cliente asignado' });
  }
  const mixedCustomer = workOrders.find((wo) => wo.customer_id !== customerId);
  if (mixedCustomer) {
    return res.status(400).json({ error: 'No se pueden facturar juntas órdenes de trabajo de clientes distintos' });
  }

  const items = [];
  for (const wo of workOrders) {
    const services = all('SELECT * FROM work_order_services WHERE work_order_id = ?', [wo.id]);
    const parts = all('SELECT * FROM work_order_parts WHERE work_order_id = ?', [wo.id]);
    for (const s of services) {
      const isFlat = s.pricing_type === 'servicio_completo';
      items.push({
        description: `${wo.number} — ${s.description}`,
        quantity: isFlat ? 1 : Number(s.hours || 0),
        unitPrice: isFlat ? Number(s.flat_price || 0) : Number(s.hourly_rate || 0),
      });
    }
    for (const p of parts) {
      items.push({
        description: `${wo.number} — ${p.description}`,
        quantity: Number(p.quantity || 1),
        unitPrice: Number(p.unit_cost || 0),
      });
    }
  }
  if (items.length === 0) {
    return res.status(400).json({ error: 'Las órdenes de trabajo seleccionadas no tienen servicios ni partes que facturar' });
  }

  const taxRate = req.body.taxRate ?? 0;
  const { subtotal, taxAmount, total } = computeTotals(items, taxRate);
  const number = nextDocNumber('invoices', 'INV');

  const result = run(
    `INSERT INTO invoices (number, customer_id, status, due_date, subtotal, tax_rate, tax_amount, total, notes)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [number, customerId, 'pendiente', req.body.dueDate || null, subtotal, taxRate, taxAmount, total,
     `Generada desde ${workOrders.map((wo) => wo.number).join(', ')}`]
  );
  const invId = result.lastInsertRowid;
  for (const item of items) {
    run(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price) VALUES (?,?,?,?)`,
      [invId, item.description, item.quantity, item.unitPrice]
    );
  }
  for (const wo of workOrders) {
    run(`UPDATE work_orders SET invoice_id = ?, status = 'facturado', updated_at = ? WHERE id = ?`, [invId, new Date().toISOString().slice(0, 19).replace('T', ' '), wo.id]);
  }

  res.status(201).json(getFullInvoice(invId));
});

// Agregar a una factura ya generada las líneas nuevas que se hayan sumado después en
// alguna de sus órdenes de trabajo de origen (por ejemplo, una parte que el mecánico
// cargó después de facturar). Nunca toca ni borra una línea que ya está en la factura:
// solo agrega las que todavía faltan, comparando la lista actual de servicios/partes de
// cada orden de trabajo contra lo que ya hay facturado (por descripción, que ya incluye
// el número de orden). Así una factura ya enviada al cliente no cambia de golpe, salvo
// por lo nuevo que efectivamente se agrega.
router.post('/:id/sync-work-orders', (req, res) => {
  const invoiceId = req.params.id;
  const invoice = get('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invoice) return res.status(404).json({ error: 'Factura no encontrada' });

  const workOrders = all('SELECT * FROM work_orders WHERE invoice_id = ?', [invoiceId]);
  if (workOrders.length === 0) {
    return res.status(400).json({ error: 'Esta factura no fue generada desde órdenes de trabajo' });
  }

  const expectedItems = [];
  for (const wo of workOrders) {
    const services = all('SELECT * FROM work_order_services WHERE work_order_id = ?', [wo.id]);
    const parts = all('SELECT * FROM work_order_parts WHERE work_order_id = ?', [wo.id]);
    for (const s of services) {
      const isFlat = s.pricing_type === 'servicio_completo';
      expectedItems.push({
        description: `${wo.number} — ${s.description}`,
        quantity: isFlat ? 1 : Number(s.hours || 0),
        unitPrice: isFlat ? Number(s.flat_price || 0) : Number(s.hourly_rate || 0),
      });
    }
    for (const p of parts) {
      expectedItems.push({
        description: `${wo.number} — ${p.description}`,
        quantity: Number(p.quantity || 1),
        unitPrice: Number(p.unit_cost || 0),
      });
    }
  }

  const existingItems = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
  const existingCounts = {};
  for (const it of existingItems) existingCounts[it.description] = (existingCounts[it.description] || 0) + 1;

  // Si una orden tiene dos líneas con la misma descripción, se cuenta cuántas hay de cada
  // lado (facturadas vs. actuales en la orden), para no duplicar ni perder ninguna.
  const newItems = [];
  const seenCount = {};
  for (const it of expectedItems) {
    seenCount[it.description] = (seenCount[it.description] || 0) + 1;
    if (seenCount[it.description] > (existingCounts[it.description] || 0)) {
      newItems.push(it);
    }
  }

  if (newItems.length === 0) {
    return res.json({ added: 0, invoice: getFullInvoice(invoiceId) });
  }

  // Se reutiliza la misma ruta de aplicación (applyUpdate) que cualquier otra edición de
  // factura: se manda la lista completa (lo que ya había + lo nuevo) como si fuera una
  // edición normal de items, así el camino de aprobación para usuarios no-admin ya
  // funciona sin cambios.
  const mergedItems = [
    ...existingItems.map((it) => ({ description: it.description, quantity: it.quantity, unitPrice: it.unit_price, productId: it.product_id })),
    ...newItems,
  ];
  const payload = { items: mergedItems, taxRate: invoice.tax_rate };

  if (req.user.role === 'admin') {
    applyUpdate(invoiceId, payload);
    return res.json({ added: newItems.length, invoice: getFullInvoice(invoiceId) });
  }

  const result = run(
    `INSERT INTO approval_requests (entity_type, entity_id, action, payload, summary, requested_by)
     VALUES ('invoice', ?, 'update', ?, ?, ?)`,
    [invoiceId, JSON.stringify(payload), `Agregar ${newItems.length} línea(s) nueva(s) de orden(es) de trabajo a la factura ${invoice.number}`, req.user.id]
  );
  res.status(202).json({ pending: true, newItemsCount: newItems.length, approvalId: result.lastInsertRowid, message: 'Los cambios se enviaron para autorización del administrador.' });
});

// Editar o eliminar una factura existente: un administrador lo aplica de inmediato;
// cualquier otro usuario con permiso de edición en "facturas" solo puede proponer el
// cambio, que queda pendiente de autorización del administrador.
router.put('/:id', (req, res) => {
  const existing = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Factura no encontrada' });

  if (req.user.role === 'admin') {
    applyUpdate(req.params.id, req.body);
    return res.json(getFullInvoice(req.params.id));
  }
  const result = run(
    `INSERT INTO approval_requests (entity_type, entity_id, action, payload, summary, requested_by)
     VALUES ('invoice', ?, 'update', ?, ?, ?)`,
    [req.params.id, JSON.stringify(req.body), `Cambios en la factura ${existing.number}`, req.user.id]
  );
  res.status(202).json({ pending: true, approvalId: result.lastInsertRowid, message: 'Los cambios se enviaron para autorización del administrador.' });
});

router.delete('/:id', (req, res) => {
  const existing = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Factura no encontrada' });

  if (req.user.role === 'admin') {
    applyDelete(req.params.id);
    return res.status(204).end();
  }
  const result = run(
    `INSERT INTO approval_requests (entity_type, entity_id, action, payload, summary, requested_by)
     VALUES ('invoice', ?, 'delete', NULL, ?, ?)`,
    [req.params.id, `Eliminar la factura ${existing.number}`, req.user.id]
  );
  res.status(202).json({ pending: true, approvalId: result.lastInsertRowid, message: 'La eliminación se envió para autorización del administrador.' });
});

// ---- Pagos de clientes (abonos) ----
// Registrar un pago no modifica la factura en sí (sus líneas y total), por eso no pasa por
// aprobación: basta el permiso de edición de Facturación. Borrar un pago sí es solo del admin.
router.post('/:id/payments', paymentUpload, (req, res) => {
  const inv = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });
  if (['cancelado', 'anulada'].includes(inv.status)) return res.status(400).json({ error: 'La factura está anulada' });
  const b = req.body || {};
  const amount = round2(b.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'El monto del pago debe ser mayor que cero' });
  const paid = round2(get('SELECT COALESCE(SUM(amount),0) AS s FROM invoice_payments WHERE invoice_id = ?', [inv.id]).s);
  const balance = round2(inv.total - paid);
  if (amount - balance > 0.004) {
    return res.status(400).json({ error: `El pago ($${amount.toLocaleString('en-US')}) es mayor que el saldo de la factura ($${balance.toLocaleString('en-US')})` });
  }
  const newId = run(
    `INSERT INTO invoice_payments (invoice_id, payment_date, amount, surcharge, processor_fee, method, reference, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?)`,
    [inv.id, b.paymentDate || new Date().toISOString().slice(0, 10), amount, Math.max(0, round2(b.surcharge)), Math.max(0, round2(b.processorFee)), b.method || null, b.reference || null, b.notes || null, req.user ? req.user.id : null]
  ).lastInsertRowid;
  saveFilesForPayment('invoice', newId, req.files);
  refreshInvoiceStatus(inv.id);
  res.status(201).json({ ...getFullInvoice(inv.id), newPaymentId: newId });
});

// Corregir los datos de un pago ya registrado (fecha, monto, forma de pago, referencia).
// Útil sobre todo para los pagos que se crearon solos al activar el módulo de cobros
// ("Marcada como pagada antes del registro de cobros"). Solo administrador.
router.put('/:id/payments/:paymentId', paymentUpload, (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede corregir un pago registrado.' });
  const pay = get('SELECT * FROM invoice_payments WHERE id = ? AND invoice_id = ?', [req.params.paymentId, req.params.id]);
  if (!pay) return res.status(404).json({ error: 'Pago no encontrado' });
  const inv = get('SELECT total FROM invoices WHERE id = ?', [req.params.id]);
  const b = req.body || {};
  const amount = b.amount !== undefined ? round2(b.amount) : pay.amount;
  if (!(amount > 0)) return res.status(400).json({ error: 'El monto del pago debe ser mayor que cero' });
  const others = round2(get('SELECT COALESCE(SUM(amount),0) AS s FROM invoice_payments WHERE invoice_id = ? AND id != ?', [req.params.id, pay.id]).s);
  if (amount + others - inv.total > 0.004) return res.status(400).json({ error: 'Con ese monto los pagos superan el total de la factura' });
  run(`UPDATE invoice_payments SET payment_date = ?, amount = ?, surcharge = ?, processor_fee = ?, method = ?, reference = ?, notes = ? WHERE id = ?`,
    [b.paymentDate || pay.payment_date, amount, b.surcharge !== undefined ? Math.max(0, round2(b.surcharge)) : pay.surcharge,
     b.processorFee !== undefined ? Math.max(0, round2(b.processorFee)) : pay.processor_fee, b.method ?? pay.method, b.reference ?? pay.reference, b.notes ?? null, pay.id]);
  saveFilesForPayment('invoice', pay.id, req.files);
  refreshInvoiceStatus(req.params.id);
  res.json(getFullInvoice(req.params.id));
});

router.delete('/:id/payments/:paymentId', (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede borrar un pago registrado.' });
  run('DELETE FROM invoice_payments WHERE id = ? AND invoice_id = ?', [req.params.paymentId, req.params.id]);
  deleteFilesOfPayment('invoice', req.params.paymentId);
  refreshInvoiceStatus(req.params.id);
  res.json(getFullInvoice(req.params.id));
});

mountPaymentFileRoutes(router, 'invoice', getFullInvoice);

router.service = { applyUpdate, applyDelete };
module.exports = router;
