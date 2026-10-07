const express = require('express');
const { all, get, run, nowIso } = require('../../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { q } = req.query;
  let sql = 'SELECT * FROM suppliers WHERE 1=1';
  const params = [];
  if (q) {
    sql += ' AND (name LIKE ? OR tax_id LIKE ? OR email LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY name';
  res.json(all(sql, params));
});

router.get('/:id', (req, res) => {
  const supplier = get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(supplier);
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const result = run(
    `INSERT INTO suppliers (name, tax_id, email, phone, address, notes) VALUES (?,?,?,?,?,?)`,
    [b.name, b.taxId || null, b.email || null, b.phone || null, b.address || null, b.notes || null]
  );
  res.status(201).json(get('SELECT * FROM suppliers WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });
  run(
    `UPDATE suppliers SET name=?, tax_id=?, email=?, phone=?, address=?, notes=? WHERE id=?`,
    [b.name ?? existing.name, b.taxId ?? existing.tax_id, b.email ?? existing.email, b.phone ?? existing.phone,
     b.address ?? existing.address, b.notes ?? existing.notes, req.params.id]
  );
  res.json(get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
