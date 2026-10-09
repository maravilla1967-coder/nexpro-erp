const express = require('express');
const { all, get, run } = require('../../db');
const { nextDocNumber, asInvoiceNumber } = require('../utils/numbering');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('facturas'));

function withItems(inv) {
  if (!inv) return inv;
  inv.items = all('SELECT * FROM invoice_items WHERE invoice_id = ?', [inv.id]);
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
  return get('SELECT * FROM invoices WHERE id = ?', [id]);
}

function applyDelete(id) {
  run('DELETE FROM invoices WHERE id = ?', [id]);
}

router.get('/', (req, res) => {
  const list = all(
    `SELECT i.*, c.name as customer_name FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id ORDER BY i.created_at DESC`
  );
  res.json(list);
});

router.get('/:id', (req, res) => {
  const inv = get(
    `SELECT i.*, c.name as customer_name, c.address as customer_address, c.city as customer_city, c.zip as customer_zip, c.tax_id as customer_tax_id, c.phone as customer_phone, c.email as customer_email
     FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`,
    [req.params.id]
  );
  if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(withItems(inv));
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
  res.status(201).json(withItems(get('SELECT * FROM invoices WHERE id = ?', [invId])));
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

  res.status(201).json(withItems(get('SELECT * FROM invoices WHERE id = ?', [invId])));
});

// Editar o eliminar una factura existente: un administrador lo aplica de inmediato;
// cualquier otro usuario con permiso de edición en "facturas" solo puede proponer el
// cambio, que queda pendiente de autorización del administrador.
router.put('/:id', (req, res) => {
  const existing = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Factura no encontrada' });

  if (req.user.role === 'admin') {
    return res.json(withItems(applyUpdate(req.params.id, req.body)));
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

router.service = { applyUpdate, applyDelete };
module.exports = router;
