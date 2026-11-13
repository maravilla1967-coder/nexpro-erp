const express = require('express');
const { all, get, run } = require('../../db');
const { nextPoNumber } = require('../utils/numbering');
const { requireModuleEdit } = require('../middleware/auth');
const { makeDocUploader } = require('../middleware/upload');
const { receivePurchaseOrder, closeShort, reopenShort } = require('../utils/receiving');
const { linkPoWarranty, unlinkPo, createClaimForPo } = require('../utils/warrantyLink');

// "Por garantía" se elige en las condiciones de pago: la orden la cubre el fabricante/vendedor.
const isWarrantyTerms = (b) => b.paymentTermsDays === 'garantia' || b.isWarranty === true || b.isWarranty === 1 || b.isWarranty === '1';
// Aplica lo de garantía que venga en el formulario: marca, vehículo (VIN) y reclamo enlazado
// (uno existente o 'nuevo' para crearlo con los datos de la orden).
function applyWarranty(poId, b) {
  const touches = b.paymentTermsDays !== undefined || b.isWarranty !== undefined || b.warrantyId !== undefined || b.vehicleId !== undefined;
  if (!touches) return;
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
  const flag = (b.paymentTermsDays !== undefined || b.isWarranty !== undefined) ? isWarrantyTerms(b) : !!po.is_warranty;
  if (!flag) { if (po.is_warranty || po.warranty_id) unlinkPo(poId, { clearFlag: true }); return; }
  const vid = b.vehicleId === undefined ? po.vehicle_id : (parseInt(b.vehicleId, 10) || null);
  run('UPDATE purchase_orders SET is_warranty = 1, payment_terms_days = NULL, vehicle_id = ? WHERE id = ?', [vid, poId]);
  if (b.warrantyId === undefined) { if (po.warranty_id) linkPoWarranty(poId, po.warranty_id); return; }
  if (b.warrantyId === 'nuevo') { if (po.warranty_id) unlinkPo(poId); createClaimForPo(poId); return; }
  const wid = parseInt(b.warrantyId, 10) || null;
  if (po.warranty_id && po.warranty_id !== wid) unlinkPo(poId);
  if (wid) {
    if (!get("SELECT id FROM warranties WHERE id = ?", [wid])) { const e = new Error('Reclamo de garantía no encontrado'); e.status = 400; throw e; }
    linkPoWarranty(poId, wid);
  }
}
const WARRANTY_SELECT = `SELECT w.id, w.number, w.status, w.kind, w.vin, w.item_description, w.manufacturer_claim_number,
    w.claim_amount, w.approved_amount, w.vehicle_id FROM warranties w WHERE w.id = ?`;

const router = express.Router();
const termsVal = (v) => { if (v === undefined) return undefined; if (v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) || n < 0 ? null : n; };
router.use(requireModuleEdit('compras'));
const docUpload = makeDocUploader('purchase-order-docs');

function withItems(po) {
  if (!po) return po;
  po.items = all(`SELECT i.*, p.track_serials, p.name AS product_name FROM purchase_order_items i
                  LEFT JOIN products p ON p.id = i.product_id WHERE i.purchase_order_id = ? ORDER BY i.id`, [po.id]);
  po.attachments = all('SELECT * FROM purchase_order_attachments WHERE purchase_order_id = ? ORDER BY id', [po.id]);
  po.receipts = all(
    `SELECT r.*, u.name AS created_by_name FROM goods_receipts r LEFT JOIN users u ON u.id = r.created_by
     WHERE r.purchase_order_id = ? ORDER BY r.id`, [po.id]);
  po.bills = all(`SELECT b.id, b.bill_number, b.bill_date, b.amount, b.status, b.due_date, b.goods_receipt_id,
                         ROUND((SELECT COALESCE(SUM(p.amount),0) FROM supplier_bill_payments p WHERE p.bill_id = b.id), 2) AS paid
                  FROM supplier_bills b WHERE b.purchase_order_id = ? ORDER BY b.id`, [po.id]);
  for (const b of po.bills) b.balance = Math.round((b.amount - b.paid) * 100) / 100;
  for (const r of po.receipts) {
    r.items = all('SELECT * FROM goods_receipt_items WHERE goods_receipt_id = ?', [r.id]);
    r.bill = po.bills.find((b) => b.goods_receipt_id === r.id) || null;
  }
  // Resumen de la cadena: pedido, recibido, faltante, facturado y pagado.
  const sum = (f) => Math.round(po.items.reduce((s, i) => s + f(i), 0) * 100) / 100;
  po.summary = {
    ordered: sum((i) => i.quantity * i.unit_cost),
    received: sum((i) => (i.received_qty || 0) * i.unit_cost),
    short: sum((i) => (i.short_qty || 0) * i.unit_cost),
    pending: sum((i) => Math.max(0, i.quantity - (i.received_qty || 0) - (i.short_qty || 0)) * i.unit_cost),
    billed: Math.round(po.bills.filter((b) => b.status !== 'anulada').reduce((s, b) => s + b.amount, 0) * 100) / 100,
    paid: Math.round(po.bills.filter((b) => b.status !== 'anulada').reduce((s, b) => s + b.paid, 0) * 100) / 100,
  };
  // Lo recibido en el ERP (recepciones registradas) que todavía no tiene factura del proveedor.
  // Las órdenes históricas importadas no tienen recepciones, así que no generan este aviso.
  const costOf = new Map(po.items.map((i) => [i.id, Number(i.unit_cost) || 0]));
  const viaReceipts = po.receipts.reduce((s, r) => s + r.items.reduce((t, gi) => t + gi.quantity * (costOf.get(gi.purchase_order_item_id) || 0), 0), 0);
  po.summary.unbilled = po.is_warranty ? 0 : Math.max(0, Math.round((viaReceipts - po.summary.billed) * 100) / 100);
  // Garantía: reclamo enlazado y vehículo (VIN).
  po.warranty = po.warranty_id ? get(WARRANTY_SELECT, [po.warranty_id]) || null : null;
  po.vehicle = po.vehicle_id ? get(`SELECT v.id, v.vin, v.make, v.model, v.year, c.name AS customer_name FROM vehicles v
                                    LEFT JOIN customers c ON c.id = v.customer_id WHERE v.id = ?`, [po.vehicle_id]) || null : null;
  return po;
}

router.get('/', (req, res) => {
  const list = all(
    `SELECT po.*, s.name as supplier_name,
            (SELECT COALESCE(SUM(i.quantity * i.unit_cost), 0) FROM purchase_order_items i WHERE i.purchase_order_id = po.id) AS total,
            (SELECT GROUP_CONCAT(i.description, '; ') FROM purchase_order_items i WHERE i.purchase_order_id = po.id) AS items_summary,
            -- Texto para el buscador de la lista: productos (nombre/SKU), seriales recibidos,
            -- facturas del proveedor y recepciones de la orden.
            (SELECT GROUP_CONCAT(COALESCE(p.name,'') || ' ' || COALESCE(p.sku,''), ' ') FROM purchase_order_items i JOIN products p ON p.id = i.product_id WHERE i.purchase_order_id = po.id) AS search_products,
            (SELECT GROUP_CONCAT(ps.serial, ' ') FROM product_serials ps WHERE ps.purchase_order_id = po.id) AS search_serials,
            (SELECT GROUP_CONCAT(COALESCE(b.bill_number,''), ' ') FROM supplier_bills b WHERE b.purchase_order_id = po.id) AS search_bills,
            (SELECT GROUP_CONCAT(gr.number, ' ') FROM goods_receipts gr WHERE gr.purchase_order_id = po.id) AS search_receipts,
            w.number AS warranty_number, w.status AS warranty_status, w.manufacturer_claim_number AS warranty_claim_number,
            COALESCE(v.vin, w.vin) AS vehicle_vin
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id
     LEFT JOIN warranties w ON w.id = po.warranty_id
     LEFT JOIN vehicles v ON v.id = po.vehicle_id ORDER BY po.created_at DESC`
  );
  res.json(list);
});

router.get('/:id', (req, res) => {
  // Trae también los datos del proveedor (nombre, dirección, contacto, etc.) para que el
  // documento imprimible de la orden de compra tenga la información completa del proveedor
  // sin necesidad de otra consulta.
  const po = get(
    `SELECT po.*, s.name as supplier_name, s.code as supplier_code, s.tax_id as supplier_tax_id,
            s.email as supplier_email, s.phone as supplier_phone, s.address as supplier_address,
            s.city as supplier_city, s.zip as supplier_zip, s.payment_terms_days as supplier_terms_days
     FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?`,
    [req.params.id]
  );
  if (!po) return res.status(404).json({ error: 'Orden de compra no encontrada' });
  // Condiciones de pago que aplican: las de la orden si se fijaron, si no las del proveedor.
  po.effective_terms_days = po.payment_terms_days != null ? po.payment_terms_days : po.supplier_terms_days;
  res.json(withItems(po));
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.supplierId || !Array.isArray(b.items) || b.items.length === 0) {
    return res.status(400).json({ error: 'Proveedor e items son obligatorios' });
  }
  const supplier = get('SELECT * FROM suppliers WHERE id = ?', [b.supplierId]);
  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
  const vendorCode = supplier.code || supplier.name;
  const number = nextPoNumber(vendorCode);
  const orderDate = b.orderDate || new Date().toISOString().slice(0, 10);
  const result = run(
    `INSERT INTO purchase_orders (number, supplier_id, status, order_date, notes, payment_terms_days) VALUES (?,?,?,?,?,?)`,
    [number, b.supplierId, b.status || 'borrador', orderDate, b.notes || null, termsVal(b.paymentTermsDays) ?? null]
  );
  const poId = result.lastInsertRowid;
  for (const item of b.items) {
    run(
      `INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) VALUES (?,?,?,?,?)`,
      [poId, item.productId || null, item.description, item.quantity, item.unitCost]
    );
  }
  try { applyWarranty(poId, b); } catch (err) { return res.status(err.status || 500).json({ error: err.message }); }
  res.status(201).json(withItems(get('SELECT * FROM purchase_orders WHERE id = ?', [poId])));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Orden de compra no encontrada' });
  // Una orden ya recibida queda bloqueada: no se pueden cambiar sus items (ya afectaron
  // el inventario), para que la orden siga reflejando con exactitud lo que realmente llegó.
  if (Array.isArray(b.items) && ['recibida', 'parcial', 'cerrada'].includes(existing.status)) {
    return res.status(400).json({ error: 'No se pueden editar los items de una orden que ya tiene mercancía recibida' });
  }
  // Marcar "recibida" de una sola vez = recibir todo lo que falte de cada línea (con el
  // mismo registro de recepción que la recepción parcial).
  if (b.status === 'cancelado' && existing.status !== 'cancelado') {
    const block = poBlocker(existing.id, 'anular');
    if (block) return res.status(400).json({ error: block });
  }
  if (b.status === 'recibida' && existing.status !== 'recibida') {
    const pending = all('SELECT id, quantity, received_qty, short_qty FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id])
      .map((i) => ({ itemId: i.id, quantity: Number(i.quantity) - Number(i.received_qty || 0) - Number(i.short_qty || 0) }))
      .filter((l) => l.quantity > 0);
    try {
      if (pending.length) receivePurchaseOrder(req.params.id, { lines: pending, userId: req.user && req.user.id });
      else run(`UPDATE purchase_orders SET status = 'recibida' WHERE id = ?`, [req.params.id]);
    } catch (err) {
      return res.status(err.status || 500).json({ error: err.message });
    }
    return res.json(withItems(get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id])));
  }
  // Cambiar el proveedor: solo mientras la orden no tenga recepciones ni cuentas por pagar
  // (p. ej. corregir una orden importada con el proveedor equivocado).
  if (b.supplierId !== undefined && String(b.supplierId) !== String(existing.supplier_id)) {
    const hasDocs = get('SELECT 1 FROM goods_receipts WHERE purchase_order_id = ? UNION SELECT 1 FROM supplier_bills WHERE purchase_order_id = ? LIMIT 1', [req.params.id, req.params.id]);
    if (hasDocs) return res.status(400).json({ error: 'No se puede cambiar el proveedor: la orden ya tiene recepciones o cuentas por pagar.' });
    if (!get('SELECT id FROM suppliers WHERE id = ?', [b.supplierId])) return res.status(400).json({ error: 'Proveedor no encontrado' });
    run('UPDATE purchase_orders SET supplier_id = ? WHERE id = ?', [b.supplierId, req.params.id]);
  }
  // Cambiar el número de la orden (p. ej. dejar "241" cuando la versión vieja se eliminó).
  if (b.number !== undefined && String(b.number).trim() && String(b.number).trim() !== existing.number) {
    const num = String(b.number).trim();
    if (get('SELECT id FROM purchase_orders WHERE number = ? AND id != ?', [num, req.params.id])) {
      return res.status(400).json({ error: `Ya existe otra orden de compra con el número ${num}` });
    }
    run('UPDATE purchase_orders SET number = ? WHERE id = ?', [num, req.params.id]);
  }
  run(
    `UPDATE purchase_orders SET status=?, order_date=?, notes=?, payment_terms_days=? WHERE id=?`,
    [b.status ?? existing.status, b.orderDate ?? existing.order_date, b.notes ?? existing.notes,
     termsVal(b.paymentTermsDays) === undefined ? existing.payment_terms_days : termsVal(b.paymentTermsDays), req.params.id]
  );

  if (Array.isArray(b.items)) {
    run('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
    for (const item of b.items) {
      run(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) VALUES (?,?,?,?,?)`,
        [req.params.id, item.productId || null, item.description, item.quantity, item.unitCost]
      );
    }
  }
  try { applyWarranty(req.params.id, b); } catch (err) { return res.status(err.status || 500).json({ error: err.message }); }
  res.json(withItems(get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id])));
});

// Una orden con mercancía recibida o con cuentas por pagar no se borra (el inventario y las
// cuentas quedarían descuadrados): se cierra el faltante o se anulan primero las cuentas.
function poBlocker(id, action) {
  const rec = get('SELECT COUNT(*) AS n FROM goods_receipts WHERE purchase_order_id = ?', [id]).n;
  if (rec) return `No se puede ${action}: la orden ya tiene mercancía recibida (${rec} recepción${rec > 1 ? 'es' : ''}). Si no va a llegar el resto, usa "Recibir" → cerrar faltante.`;
  const bills = get(`SELECT COUNT(*) AS n FROM supplier_bills WHERE purchase_order_id = ? AND status != 'anulada'`, [id]).n;
  if (bills) return `No se puede ${action}: la orden tiene cuentas por pagar. Anúlalas primero en Cuentas por pagar.`;
  return null;
}

router.delete('/:id', (req, res) => {
  const po = get('SELECT id FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (!po) return res.status(404).json({ error: 'Orden de compra no encontrada' });
  const block = poBlocker(po.id, 'eliminar');
  if (block) return res.status(400).json({ error: block });
  run('UPDATE supplier_bills SET purchase_order_id = NULL WHERE purchase_order_id = ?', [po.id]);
  unlinkPo(po.id);
  run('DELETE FROM purchase_orders WHERE id = ?', [po.id]);
  res.status(204).end();
});

// ---- Recepción de mercancía (parcial o total) ----
router.post('/:id/receipts', (req, res) => {
  try {
    const b = req.body || {};
    receivePurchaseOrder(req.params.id, { lines: b.lines, receiptDate: b.receiptDate, notes: b.notes, userId: req.user && req.user.id, bill: b.bill, closeShort: b.closeShort });
    res.status(201).json(withItems(get(`SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?`, [req.params.id])));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Corregir la fecha / notas de una recepción ya hecha (no cambia cantidades ni inventario).
router.put('/:id/receipts/:receiptId', (req, res) => {
  const gr = get('SELECT * FROM goods_receipts WHERE id = ? AND purchase_order_id = ?', [req.params.receiptId, req.params.id]);
  if (!gr) return res.status(404).json({ error: 'Recepción no encontrada' });
  const b = req.body || {};
  const date = b.receiptDate && /^\d{4}-\d{2}-\d{2}$/.test(b.receiptDate) ? b.receiptDate : gr.receipt_date;
  run('UPDATE goods_receipts SET receipt_date = ?, notes = ? WHERE id = ?', [date, b.notes !== undefined ? b.notes : gr.notes, gr.id]);
  run('UPDATE product_serials SET received_date = ? WHERE goods_receipt_id = ?', [date, gr.id]);
  res.json(get('SELECT * FROM goods_receipts WHERE id = ?', [gr.id]));
});

// ---- Faltantes: cerrar lo que ya no va a llegar / reabrirlo ----
router.post('/:id/close-short', (req, res) => {
  try { closeShort(req.params.id, (req.body || {}).note); res.json(withItems(get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]))); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});
router.post('/:id/reopen-short', (req, res) => {
  reopenShort(req.params.id);
  res.json(withItems(get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id])));
});

// ---- Documentos adjuntos (cotización del proveedor, factura final, etc.) ----
router.post('/:id/attachments', docUpload.array('files', 10), (req, res) => {
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (!po) return res.status(404).json({ error: 'Orden de compra no encontrada' });
  const files = req.files || [];
  for (const f of files) {
    run(
      'INSERT INTO purchase_order_attachments (purchase_order_id, file_url, original_name) VALUES (?,?,?)',
      [req.params.id, `/uploads/purchase-order-docs/${f.filename}`, f.originalname]
    );
  }
  res.status(201).json(withItems(get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id])));
});

router.delete('/:id/attachments/:attachmentId', (req, res) => {
  run('DELETE FROM purchase_order_attachments WHERE id = ? AND purchase_order_id = ?', [req.params.attachmentId, req.params.id]);
  res.status(204).end();
});

module.exports = router;
