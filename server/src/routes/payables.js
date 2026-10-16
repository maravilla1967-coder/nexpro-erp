const express = require('express');
const { all, get, run } = require('../../db');
const { requireModuleEdit } = require('../middleware/auth');
const { makeDocUploader } = require('../middleware/upload');
const { attachFiles, mountPaymentFileRoutes, deleteFilesOfPayment } = require('../utils/paymentFiles');

// Cuentas por pagar: facturas de proveedores (con o sin orden de compra), sus pagos y la
// antigüedad de lo que se debe. Usa el permiso del módulo de compras.
const router = express.Router();
router.use(requireModuleEdit('compras'));
const docUpload = makeDocUploader('supplier-bill-docs');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const PAID = `(SELECT COALESCE(SUM(p.amount),0) FROM supplier_bill_payments p WHERE p.bill_id = b.id)`;
const SELECT = `
  SELECT b.*, s.name AS supplier_name, po.number AS purchase_order_number,
         ROUND(${PAID}, 2) AS paid, ROUND(b.amount - ${PAID}, 2) AS balance,
         (SELECT MAX(p.payment_date) FROM supplier_bill_payments p WHERE p.bill_id = b.id) AS last_payment
  FROM supplier_bills b
  LEFT JOIN suppliers s ON s.id = b.supplier_id
  LEFT JOIN purchase_orders po ON po.id = b.purchase_order_id`;

function bucketOf(days) {
  return days <= 0 ? 'corriente' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '+90';
}
function decorate(r) {
  if (!r) return r;
  const today = new Date().toISOString().slice(0, 10);
  const due = r.due_date || r.bill_date || String(r.created_at || '').slice(0, 10);
  const days = Math.floor((Date.parse(today) - Date.parse(due)) / 86400000);
  r.days_overdue = Number.isNaN(days) ? 0 : days;
  r.bucket = bucketOf(r.days_overdue);
  return r;
}
function getFull(id) {
  const b = decorate(get(`${SELECT} WHERE b.id = ?`, [id]));
  if (!b) return b;
  b.payments = all(`SELECT p.*, u.name AS created_by_name FROM supplier_bill_payments p LEFT JOIN users u ON u.id = p.created_by
                    WHERE p.bill_id = ? ORDER BY p.payment_date, p.id`, [id]);
  attachFiles(b.payments, 'bill');
  b.attachments = all('SELECT * FROM supplier_bill_attachments WHERE bill_id = ? ORDER BY id', [id]);
  return b;
}
function refreshStatus(id) {
  const b = get(`${SELECT} WHERE b.id = ?`, [id]);
  if (!b || b.status === 'anulada') return;
  let status = 'pendiente';
  if (b.paid > 0 && b.balance > 0.004) status = 'parcial';
  if (b.balance <= 0.004 && b.amount > 0) status = 'pagada';
  run('UPDATE supplier_bills SET status = ? WHERE id = ?', [status, id]);
}

router.get('/', (req, res) => {
  const { open } = req.query;
  let sql = `${SELECT} WHERE 1=1`;
  if (open === '1') sql += ` AND b.status != 'anulada' AND ROUND(b.amount - ${PAID}, 2) > 0.004`;
  sql += ' ORDER BY COALESCE(b.due_date, b.bill_date, b.created_at)';
  res.json(all(sql).map(decorate));
});

router.get('/:id', (req, res) => {
  const b = getFull(req.params.id);
  if (!b) return res.status(404).json({ error: 'Factura de proveedor no encontrada' });
  res.json(b);
});

function fields(b) {
  return {
    supplier_id: b.supplierId, purchase_order_id: b.purchaseOrderId || null, bill_number: b.billNumber || null,
    bill_date: b.billDate || null, due_date: b.dueDate || null, amount: round2(b.amount), notes: b.notes || null,
  };
}

router.post('/', (req, res) => {
  const f = fields(req.body || {});
  if (!f.supplier_id) return res.status(400).json({ error: 'El proveedor es obligatorio' });
  if (!(f.amount > 0)) return res.status(400).json({ error: 'El monto debe ser mayor que cero' });
  const cols = Object.keys(f);
  const id = run(`INSERT INTO supplier_bills (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, cols.map((c) => f[c])).lastInsertRowid;
  res.status(201).json(getFull(id));
});

router.put('/:id', (req, res) => {
  const existing = get('SELECT * FROM supplier_bills WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Factura de proveedor no encontrada' });
  const b = req.body || {};
  if (b.status === 'anulada') {
    run(`UPDATE supplier_bills SET status = 'anulada' WHERE id = ?`, [req.params.id]);
    return res.json(getFull(req.params.id));
  }
  const f = fields({ supplierId: existing.supplier_id, ...b });
  if (!(f.amount > 0)) return res.status(400).json({ error: 'El monto debe ser mayor que cero' });
  run(`UPDATE supplier_bills SET supplier_id=?, purchase_order_id=?, bill_number=?, bill_date=?, due_date=?, amount=?, notes=? WHERE id=?`,
    [f.supplier_id, f.purchase_order_id, f.bill_number, f.bill_date, f.due_date, f.amount, f.notes, req.params.id]);
  refreshStatus(req.params.id);
  res.json(getFull(req.params.id));
});

router.delete('/:id', (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede borrar una factura de proveedor.' });
  run('DELETE FROM supplier_bills WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

router.post('/:id/payments', (req, res) => {
  const bill = get(`${SELECT} WHERE b.id = ?`, [req.params.id]);
  if (!bill) return res.status(404).json({ error: 'Factura de proveedor no encontrada' });
  if (bill.status === 'anulada') return res.status(400).json({ error: 'La factura está anulada' });
  const p = req.body || {};
  const amount = round2(p.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'El monto del pago debe ser mayor que cero' });
  if (amount - bill.balance > 0.004) return res.status(400).json({ error: `El pago es mayor que el saldo ($${bill.balance.toLocaleString('en-US')})` });
  const newId = run(`INSERT INTO supplier_bill_payments (bill_id, payment_date, amount, method, reference, notes, created_by) VALUES (?,?,?,?,?,?,?)`,
    [bill.id, p.paymentDate || new Date().toISOString().slice(0, 10), amount, p.method || null, p.reference || null, p.notes || null, req.user ? req.user.id : null]).lastInsertRowid;
  refreshStatus(bill.id);
  res.status(201).json({ ...getFull(bill.id), newPaymentId: newId });
});

router.delete('/:id/payments/:paymentId', (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede borrar un pago registrado.' });
  run('DELETE FROM supplier_bill_payments WHERE id = ? AND bill_id = ?', [req.params.paymentId, req.params.id]);
  deleteFilesOfPayment('bill', req.params.paymentId);
  refreshStatus(req.params.id);
  res.json(getFull(req.params.id));
});

router.post('/:id/attachments', docUpload.array('files', 10), (req, res) => {
  if (!get('SELECT id FROM supplier_bills WHERE id = ?', [req.params.id])) return res.status(404).json({ error: 'Factura de proveedor no encontrada' });
  for (const f of req.files || []) {
    run('INSERT INTO supplier_bill_attachments (bill_id, file_url, original_name) VALUES (?,?,?)',
      [req.params.id, `/uploads/supplier-bill-docs/${f.filename}`, f.originalname]);
  }
  res.status(201).json(getFull(req.params.id));
});

router.delete('/:id/attachments/:attId', (req, res) => {
  run('DELETE FROM supplier_bill_attachments WHERE id = ? AND bill_id = ?', [req.params.attId, req.params.id]);
  res.json(getFull(req.params.id));
});

mountPaymentFileRoutes(router, 'bill', getFull);

module.exports = router;
