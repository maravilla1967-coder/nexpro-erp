const express = require('express');
const { all, get, run, nowIso } = require('../../db');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('clientes'));

// ---- Customers ----
router.get('/', (req, res) => {
  const { q, status } = req.query;
  let sql = 'SELECT * FROM customers WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ? OR tax_id LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  res.json(all(sql, params));
});

router.get('/:id', (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
  customer.contacts = all('SELECT * FROM contacts WHERE customer_id = ? ORDER BY id DESC', [req.params.id]);
  customer.opportunities = all('SELECT * FROM opportunities WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
  customer.activities = all('SELECT * FROM activities WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
  customer.vehicles = all('SELECT * FROM vehicles WHERE customer_id = ? ORDER BY received_at DESC', [req.params.id]);
  res.json(customer);
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const result = run(
    `INSERT INTO customers (type, name, tax_id, email, phone, address, city, zip, industry, status, source, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [b.type || 'empresa', b.name, b.taxId || null, b.email || null, b.phone || null, b.address || null,
     b.city || null, b.zip || null, b.industry || null, b.status || 'lead', b.source || null, b.notes || null]
  );
  res.status(201).json(get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
  run(
    `UPDATE customers SET type=?, name=?, tax_id=?, email=?, phone=?, address=?, city=?, zip=?, industry=?, status=?, source=?, notes=?, updated_at=?
     WHERE id=?`,
    [b.type ?? existing.type, b.name ?? existing.name, b.taxId ?? existing.tax_id, b.email ?? existing.email,
     b.phone ?? existing.phone, b.address ?? existing.address, b.city ?? existing.city, b.zip ?? existing.zip, b.industry ?? existing.industry,
     b.status ?? existing.status, b.source ?? existing.source, b.notes ?? existing.notes, nowIso(), req.params.id]
  );
  res.json(get('SELECT * FROM customers WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// ---- Contacts ----
router.post('/:id/contacts', (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'El nombre del contacto es obligatorio' });
  const result = run(
    `INSERT INTO contacts (customer_id, name, role, email, phone, notes) VALUES (?,?,?,?,?,?)`,
    [req.params.id, b.name, b.role || null, b.email || null, b.phone || null, b.notes || null]
  );
  res.status(201).json(get('SELECT * FROM contacts WHERE id = ?', [result.lastInsertRowid]));
});

router.delete('/contacts/:contactId', (req, res) => {
  run('DELETE FROM contacts WHERE id = ?', [req.params.contactId]);
  res.status(204).end();
});

// ---- Opportunities ----
router.post('/:id/opportunities', (req, res) => {
  const b = req.body;
  if (!b.title) return res.status(400).json({ error: 'El título es obligatorio' });
  const result = run(
    `INSERT INTO opportunities (customer_id, title, stage, value, probability, expected_close, notes)
     VALUES (?,?,?,?,?,?,?)`,
    [req.params.id, b.title, b.stage || 'nuevo', b.value ?? null, b.probability ?? null, b.expectedClose || null, b.notes || null]
  );
  res.status(201).json(get('SELECT * FROM opportunities WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/opportunities/:oppId', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM opportunities WHERE id = ?', [req.params.oppId]);
  if (!existing) return res.status(404).json({ error: 'Oportunidad no encontrada' });
  run(
    `UPDATE opportunities SET title=?, stage=?, value=?, probability=?, expected_close=?, notes=?, updated_at=? WHERE id=?`,
    [b.title ?? existing.title, b.stage ?? existing.stage, b.value ?? existing.value, b.probability ?? existing.probability,
     b.expectedClose ?? existing.expected_close, b.notes ?? existing.notes, nowIso(), req.params.oppId]
  );
  res.json(get('SELECT * FROM opportunities WHERE id = ?', [req.params.oppId]));
});

router.delete('/opportunities/:oppId', (req, res) => {
  run('DELETE FROM opportunities WHERE id = ?', [req.params.oppId]);
  res.status(204).end();
});

// ---- Activities ----
router.post('/:id/activities', (req, res) => {
  const b = req.body;
  if (!b.subject || !b.type) return res.status(400).json({ error: 'Tipo y asunto son obligatorios' });
  const result = run(
    `INSERT INTO activities (customer_id, type, subject, notes, due_date, done) VALUES (?,?,?,?,?,?)`,
    [req.params.id, b.type, b.subject, b.notes || null, b.dueDate || null, b.done ? 1 : 0]
  );
  res.status(201).json(get('SELECT * FROM activities WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/activities/:actId', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM activities WHERE id = ?', [req.params.actId]);
  if (!existing) return res.status(404).json({ error: 'Actividad no encontrada' });
  run(
    `UPDATE activities SET type=?, subject=?, notes=?, due_date=?, done=? WHERE id=?`,
    [b.type ?? existing.type, b.subject ?? existing.subject, b.notes ?? existing.notes,
     b.dueDate ?? existing.due_date, b.done !== undefined ? (b.done ? 1 : 0) : existing.done, req.params.actId]
  );
  res.json(get('SELECT * FROM activities WHERE id = ?', [req.params.actId]));
});

router.delete('/activities/:actId', (req, res) => {
  run('DELETE FROM activities WHERE id = ?', [req.params.actId]);
  res.status(204).end();
});

module.exports = router;
