const express = require('express');
const { all, get, run, nowIso } = require('../../db');
const { nextDocNumber } = require('../utils/numbering');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('pedidos'));

function withItems(so) {
  if (!so) return so;
  so.items = all('SELECT * FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
  return so;
}

// ---- Lógica de aplicación real de cambios (usada directamente por admin, o por la
// ruta de aprobaciones cuando el administrador aprueba la solicitud de otro usuario) ----
function applyUpdate(id, b) {
  const existing = get('SELECT * FROM sales_orders WHERE id = ?', [id]);
  if (!existing) throw new Error('Pedido no encontrado');
  run(`UPDATE sales_orders SET status=?, notes=?, updated_at=? WHERE id=?`,
    [b.status ?? existing.status, b.notes ?? existing.notes, nowIso(), id]);

  if (Array.isArray(b.items)) {
    run('DELETE FROM sales_order_items WHERE sales_order_id = ?', [id]);
    for (const item of b.items) {
      run(
        `INSERT INTO sales_order_items (sales_order_id, product_id, description, quantity, unit_price) VALUES (?,?,?,?,?)`,
        [id, item.productId || null, item.description, item.quantity, item.unitPrice]
      );
    }
  }
  return get('SELECT * FROM sales_orders WHERE id = ?', [id]);
}

function applyDelete(id) {
  run('DELETE FROM sales_orders WHERE id = ?', [id]);
}

router.get('/', (req, res) => {
  const list = all(
    `SELECT so.*, c.name as customer_name FROM sales_orders so
     LEFT JOIN customers c ON c.id = so.customer_id ORDER BY so.created_at DESC`
  );
  res.json(list);
});

router.get('/:id', (req, res) => {
  const so = get(
    `SELECT so.*, c.name as customer_name, c.address as customer_address, c.city as customer_city, c.zip as customer_zip,
            c.tax_id as customer_tax_id, c.phone as customer_phone, c.email as customer_email
     FROM sales_orders so LEFT JOIN customers c ON c.id = so.customer_id WHERE so.id = ?`,
    [req.params.id]
  );
  if (!so) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(withItems(so));
});

// Crear un pedido nuevo no pasa por aprobación: solo la edición/eliminación de uno existente.
router.post('/', (req, res) => {
  const b = req.body;
  if (!b.customerId || !Array.isArray(b.items) || b.items.length === 0) {
    return res.status(400).json({ error: 'Cliente e items son obligatorios' });
  }
  // Número de pedido/cotización: NX-QT-AAAAMMDD-NN (el código QT identifica que es un
  // pedido y no una orden de trabajo o una factura). Si más adelante se convierte en
  // factura, la factura reutiliza la misma fecha y consecutivo, cambiando QT por INV
  // (ver asInvoiceNumber en invoices.js).
  const number = nextDocNumber('sales_orders', 'QT');
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

// Editar o eliminar un pedido existente: un administrador lo aplica de inmediato;
// cualquier otro usuario con permiso de edición en "pedidos" solo puede proponer el
// cambio, que queda pendiente de autorización del administrador.
router.put('/:id', (req, res) => {
  const existing = get('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });

  if (req.user.role === 'admin') {
    return res.json(withItems(applyUpdate(req.params.id, req.body)));
  }
  const result = run(
    `INSERT INTO approval_requests (entity_type, entity_id, action, payload, summary, requested_by)
     VALUES ('sales_order', ?, 'update', ?, ?, ?)`,
    [req.params.id, JSON.stringify(req.body), `Cambios en el pedido ${existing.number}`, req.user.id]
  );
  res.status(202).json({ pending: true, approvalId: result.lastInsertRowid, message: 'Los cambios se enviaron para autorización del administrador.' });
});

router.delete('/:id', (req, res) => {
  const existing = get('SELECT * FROM sales_orders WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Pedido no encontrado' });

  if (req.user.role === 'admin') {
    applyDelete(req.params.id);
    return res.status(204).end();
  }
  const result = run(
    `INSERT INTO approval_requests (entity_type, entity_id, action, payload, summary, requested_by)
     VALUES ('sales_order', ?, 'delete', NULL, ?, ?)`,
    [req.params.id, `Eliminar el pedido ${existing.number}`, req.user.id]
  );
  res.status(202).json({ pending: true, approvalId: result.lastInsertRowid, message: 'La eliminación se envió para autorización del administrador.' });
});

router.service = { applyUpdate, applyDelete };
module.exports = router;
