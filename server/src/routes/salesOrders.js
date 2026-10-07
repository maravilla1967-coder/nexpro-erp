const express = require('express');
const { all, get, run, nowIso } = require('../../db');
const { nextNumber } = require('../utils/numbering');

const router = express.Router();

function withItems(so) {
  if (!so) return so;
  so.items = all('SELECT * FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
  return so;
}

router.get('/', (req, res) => {
  const list = all(
    `SELECT so.*, c.name as customer_name FROM sales_orders so
     LEFT JOIN customers c ON c.id = so.customer_id ORDER BY so.created_at DESC`
  );
  res.json(list);
});

router.get('/:id', (req, res) => {
  const so = get('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
  if (!so) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(withItems(so));
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.customerId || !Array.isArray(b.items) || b.items.length === 0) {
    return res.status(400).json({ error: 'Cliente e items son obligatorios' });
  }
  const number = nextNumber('sales_orders', 'PED');
  const result = run(
    `INSERT INTO sales_orders (number, customer_id, status, notes) VALUES (?,?,?,?)`,
    [number, b.customerId, b.status || 'pendiente', b.notes || null]
  );
  const soId = result.lastInsertRowid;
  for (const item of b.items) {
    run(
      `INSERT INTO sales_order_items (sales_order_id, product_id, description, quantity, unit_price) VALUES (?,?,?,?,?)`,
      [soId, item.productId || null, item.description, item.quantity, item.unitPrice]
    );
  }
  res.status(201).json(withItems(get('SELECT * FROM sales_orders WHERE id = ?', [soId])));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });
  run(`UPDATE sales_orders SET status=?, notes=?, updated_at=? WHERE id=?`,
    [b.status ?? existing.status, b.notes ?? existing.notes, nowIso(), req.params.id]);

  if (Array.isArray(b.items)) {
    run('DELETE FROM sales_order_items WHERE sales_order_id = ?', [req.params.id]);
    for (const item of b.items) {
      run(
        `INSERT INTO sales_order_items (sales_order_id, product_id, description, quantity, unit_price) VALUES (?,?,?,?,?)`,
        [req.params.id, item.productId || null, item.description, item.quantity, item.unitPrice]
      );
    }
  }
  res.json(withItems(get('SELECT * FROM sales_orders WHERE id = ?', [req.params.id])));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM sales_orders WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
