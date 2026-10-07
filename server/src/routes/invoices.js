const express = require('express');
const { all, get, run } = require('../../db');
const { nextNumber } = require('../utils/numbering');

const router = express.Router();

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

router.get('/', (req, res) => {
  const list = all(
    `SELECT i.*, c.name as customer_name FROM invoices i
     LEFT JOIN customers c ON c.id = i.customer_id ORDER BY i.created_at DESC`
  );
  res.json(list);
});

router.get('/:id', (req, res) => {
  const inv = get(
    `SELECT i.*, c.name as customer_name, c.address as customer_address, c.tax_id as customer_tax_id, c.phone as customer_phone, c.email as customer_email
     FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id WHERE i.id = ?`,
    [req.params.id]
  );
  if (!inv) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(withItems(inv));
});

// Crear factura directa (con items propios) o a partir de un pedido (salesOrderId)
router.post('/', (req, res) => {
  const b = req.body;
  let items = b.items;
  let customerId = b.customerId;
  let salesOrderId = b.salesOrderId || null;

  if (salesOrderId) {
    const so = get('SELECT * FROM sales_orders WHERE id = ?', [salesOrderId]);
    if (!so) return res.status(404).json({ error: 'Pedido no encontrado' });
    customerId = so.customer_id;
    items = all('SELECT * FROM sales_order_items WHERE sales_order_id = ?', [salesOrderId]);
  }

  if (!customerId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cliente e items son obligatorios' });
  }

  const taxRate = b.taxRate ?? 0;
  const { subtotal, taxAmount, total } = computeTotals(items, taxRate);
  const number = nextNumber('invoices', 'FAC');

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

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Factura no encontrada' });

  let subtotal = existing.subtotal, taxAmount = existing.tax_amount, total = existing.total;
  const taxRate = b.taxRate ?? existing.tax_rate;

  if (Array.isArray(b.items)) {
    run('DELETE FROM invoice_items WHERE invoice_id = ?', [req.params.id]);
    for (const item of b.items) {
      run(
        `INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price) VALUES (?,?,?,?,?)`,
        [req.params.id, item.productId || null, item.description, item.quantity, item.unitPrice]
      );
    }
    const totals = computeTotals(b.items, taxRate);
    subtotal = totals.subtotal; taxAmount = totals.taxAmount; total = totals.total;
  }

  run(
    `UPDATE invoices SET status=?, due_date=?, subtotal=?, tax_rate=?, tax_amount=?, total=?, notes=? WHERE id=?`,
    [b.status ?? existing.status, b.dueDate ?? existing.due_date, subtotal, taxRate, taxAmount, total, b.notes ?? existing.notes, req.params.id]
  );
  res.json(withItems(get('SELECT * FROM invoices WHERE id = ?', [req.params.id])));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM invoices WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
