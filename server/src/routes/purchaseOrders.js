const express = require('express');
const { all, get, run } = require('../../db');
const { nextPoNumber } = require('../utils/numbering');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('compras'));

function withItems(po) {
  if (!po) return po;
  po.items = all('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [po.id]);
  return po;
}

router.get('/', (req, res) => {
  const list = all(
    `SELECT po.*, s.name as supplier_name FROM purchase_orders po
     LEFT JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC`
  );
  res.json(list);
});

router.get('/:id', (req, res) => {
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (!po) return res.status(404).json({ error: 'Orden de compra no encontrada' });
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
  const result = run(
    `INSERT INTO purchase_orders (number, supplier_id, status, notes) VALUES (?,?,?,?)`,
    [number, b.supplierId, b.status || 'borrador', b.notes || null]
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
  run(`UPDATE purchase_orders SET status=?, notes=? WHERE id=?`, [b.status ?? existing.status, b.notes ?? existing.notes, req.params.id]);

  if (Array.isArray(b.items)) {
    run('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
    for (const item of b.items) {
      run(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_cost) VALUES (?,?,?,?,?)`,
        [req.params.id, item.productId || null, item.description, item.quantity, item.unitCost]
      );
    }
  }
  // Si la orden pasa a "recibida", aumentar stock de los productos asociados
  if (b.status === 'recibida' && existing.status !== 'recibida') {
    const items = all('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
    for (const item of items) {
      if (item.product_id) {
        run('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }
  }
  res.json(withItems(get('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id])));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM purchase_orders WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
