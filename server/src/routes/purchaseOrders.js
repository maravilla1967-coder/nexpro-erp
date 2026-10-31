const express = require('express');
const { all, get, run } = require('../../db');
const { nextPoNumber } = require('../utils/numbering');
const { requireModuleEdit } = require('../middleware/auth');
const { makeDocUploader } = require('../middleware/upload');
const { receivePurchaseOrder, closeShort, reopenShort } = require('../utils/receiving');

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
  po.summary.unbilled = Math.max(0, Math.round((viaReceipts - po.summary.billed) * 100) / 100);
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
            (SELECT GROUP_CONCAT(gr.number, ' ') FROM goods_receipts gr WHERE gr.purchase_order_id = po.id) AS search_receipts
     FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC`
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
  res.json(withItems(get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id])));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM purchase_orders WHERE id = ?', [req.params.id]);
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
