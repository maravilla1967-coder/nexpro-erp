const express = require('express');
const { db, all, get, run } = require('../../db');
const { requireModuleEdit } = require('../middleware/auth');

// Números de serie por unidad física, con su historia completa:
// de qué orden de compra / recepción vino → a qué factura y cliente se vendió, o en qué
// vehículo quedó instalado. Usa el permiso del módulo de inventario.
const router = express.Router();
router.use(requireModuleEdit('inventario'));

const STATUSES = ['disponible', 'vendido', 'instalado', 'dado_de_baja'];
const SELECT = `
  SELECT ps.*, p.name AS product_name, p.sku AS product_sku, s.name AS supplier_name,
         po.number AS purchase_order_number, gr.number AS goods_receipt_number,
         i.number AS invoice_number, c.name AS customer_name, v.vin AS vehicle_vin,
         v.make AS vehicle_make, v.model AS vehicle_model, v.year AS vehicle_year
  FROM product_serials ps
  JOIN products p ON p.id = ps.product_id
  LEFT JOIN suppliers s ON s.id = ps.supplier_id
  LEFT JOIN purchase_orders po ON po.id = ps.purchase_order_id
  LEFT JOIN goods_receipts gr ON gr.id = ps.goods_receipt_id
  LEFT JOIN invoices i ON i.id = ps.invoice_id
  LEFT JOIN customers c ON c.id = ps.customer_id
  LEFT JOIN vehicles v ON v.id = ps.vehicle_id`;

function getFull(id) {
  const s = get(`${SELECT} WHERE ps.id = ?`, [id]);
  if (!s) return s;
  s.events = all(`SELECT e.*, u.name AS created_by_name FROM serial_events e LEFT JOIN users u ON u.id = e.created_by
                  WHERE e.serial_id = ? ORDER BY e.id`, [id]);
  s.warranties = all('SELECT id, number, kind, status FROM warranties WHERE product_serial_id = ? ORDER BY id', [id]);
  return s;
}

router.get('/', (req, res) => {
  const { q, status, productId, invoiceId, vehicleId, productIds } = req.query;
  let sql = `${SELECT} WHERE 1=1`;
  const params = [];
  if (q) { sql += ' AND (ps.serial LIKE ? OR p.name LIKE ? OR p.sku LIKE ?)'; const like = `%${q}%`; params.push(like, like, like); }
  if (status) { sql += ' AND ps.status = ?'; params.push(status); }
  if (productId) { sql += ' AND ps.product_id = ?'; params.push(productId); }
  if (invoiceId) { sql += ' AND ps.invoice_id = ?'; params.push(invoiceId); }
  if (vehicleId) { sql += ' AND ps.vehicle_id = ?'; params.push(vehicleId); }
  if (productIds) {
    const ids = String(productIds).split(',').map((x) => parseInt(x, 10)).filter((x) => !Number.isNaN(x));
    if (ids.length) { sql += ` AND ps.product_id IN (${ids.map(() => '?').join(',')})`; params.push(...ids); }
  }
  sql += ' ORDER BY ps.id DESC';
  res.json(all(sql, params));
});

router.get('/:id', (req, res) => {
  const s = getFull(req.params.id);
  if (!s) return res.status(404).json({ error: 'Serial no encontrado' });
  res.json(s);
});

// Alta manual de seriales (unidades que llegaron fuera de una recepción formal, o que ya
// estaban en inventario antes de activar el control de seriales).
router.post('/', (req, res) => {
  const b = req.body || {};
  const product = get('SELECT * FROM products WHERE id = ?', [b.productId]);
  if (!product) return res.status(400).json({ error: 'Elige el producto' });
  const serials = [...new Set((b.serials || []).map((x) => String(x).trim()).filter(Boolean))];
  if (serials.length === 0) return res.status(400).json({ error: 'Escribe al menos un número de serie' });
  for (const sn of serials) {
    if (get('SELECT id FROM product_serials WHERE product_id = ? AND serial = ?', [product.id, sn])) {
      return res.status(400).json({ error: `El serial ${sn} ya existe para este producto` });
    }
  }
  const date = b.receivedDate || new Date().toISOString().slice(0, 10);
  db.exec('BEGIN');
  try {
    if (!product.track_serials) run('UPDATE products SET track_serials = 1 WHERE id = ?', [product.id]);
    for (const sn of serials) {
      const id = run(`INSERT INTO product_serials (product_id, serial, status, supplier_id, received_date, unit_cost, status_date, notes)
                      VALUES (?,?,?,?,?,?,?,?)`,
        [product.id, sn, 'disponible', b.supplierId || product.supplier_id || null, date, product.purchase_cost, date, b.notes || null]).lastInsertRowid;
      run('INSERT INTO serial_events (serial_id, event, notes, created_by) VALUES (?,?,?,?)', [id, 'alta_manual', b.notes || null, req.user && req.user.id]);
    }
    if (b.addToStock) run('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [serials.length, product.id]);
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  res.status(201).json({ created: serials.length });
});

// Cambiar el estado de una unidad: vender (factura/cliente), instalar (vehículo), dar de
// baja o devolver a disponible. Cada cambio queda en la historia del serial.
router.post('/:id/status', (req, res) => {
  const s = get('SELECT * FROM product_serials WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Serial no encontrado' });
  const b = req.body || {};
  const status = b.status;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Estado no válido' });
  let invoiceId = s.invoice_id, customerId = s.customer_id, vehicleId = s.vehicle_id, reference = null;
  if (status === 'vendido') {
    invoiceId = b.invoiceId || null;
    const inv = invoiceId ? get('SELECT id, number, customer_id FROM invoices WHERE id = ?', [invoiceId]) : null;
    if (invoiceId && !inv) return res.status(400).json({ error: 'Factura no encontrada' });
    customerId = (inv && inv.customer_id) || b.customerId || null;
    if (!invoiceId && !customerId) return res.status(400).json({ error: 'Indica la factura o el cliente al que se vendió' });
    if (b.vehicleId !== undefined) vehicleId = b.vehicleId || null;
    reference = inv ? `Factura ${inv.number}` : null;
  } else if (status === 'instalado') {
    vehicleId = b.vehicleId || null;
    const v = vehicleId ? get('SELECT id, vin, customer_id FROM vehicles WHERE id = ?', [vehicleId]) : null;
    if (!v) return res.status(400).json({ error: 'Elige el vehículo donde quedó instalado' });
    customerId = customerId || v.customer_id || null;
    reference = `VIN ${v.vin}`;
  } else if (status === 'disponible') {
    invoiceId = null; customerId = null; vehicleId = null;
  }
  const today = new Date().toISOString().slice(0, 10);
  run(`UPDATE product_serials SET status=?, invoice_id=?, customer_id=?, vehicle_id=?, status_date=? WHERE id=?`,
    [status, invoiceId, customerId, vehicleId, b.date || today, s.id]);
  run('INSERT INTO serial_events (serial_id, event, reference, notes, created_by) VALUES (?,?,?,?,?)',
    [s.id, status, reference, b.notes || null, req.user && req.user.id]);
  res.json(getFull(s.id));
});

router.delete('/:id', (req, res) => {
  const s = get('SELECT * FROM product_serials WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Serial no encontrado' });
  if (s.status !== 'disponible') return res.status(400).json({ error: 'Solo se puede borrar un serial que está disponible. Para los demás, cambia su estado.' });
  run('DELETE FROM product_serials WHERE id = ?', [s.id]);
  res.status(204).end();
});

module.exports = router;
