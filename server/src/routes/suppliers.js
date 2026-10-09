const express = require('express');
const { all, get, run, nowIso } = require('../../db');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('proveedores'));

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

// Deriva un código de 2 letras a partir del nombre del proveedor (p. ej. "Acme Parts" -> "AC").
function deriveCode(name) {
  const letters = String(name || '').toUpperCase().replace(/[^A-Z]/g, '');
  return (letters.slice(0, 2) || 'XX').padEnd(2, 'X');
}

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const code = (b.code && String(b.code).trim()) ? String(b.code).trim().toUpperCase().slice(0, 2) : deriveCode(b.name);
  const result = run(
    `INSERT INTO suppliers (name, code, tax_id, email, phone, address, city, zip, notes) VALUES (?,?,?,?,?,?,?,?,?)`,
    [b.name, code, b.taxId || null, b.email || null, b.phone || null, b.address || null, b.city || null, b.zip || null, b.notes || null]
  );
  res.status(201).json(get('SELECT * FROM suppliers WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Proveedor no encontrado' });
  const code = (b.code !== undefined && String(b.code).trim())
    ? String(b.code).trim().toUpperCase().slice(0, 2)
    : (existing.code || deriveCode(b.name ?? existing.name));
  run(
    `UPDATE suppliers SET name=?, code=?, tax_id=?, email=?, phone=?, address=?, city=?, zip=?, notes=? WHERE id=?`,
    [b.name ?? existing.name, code, b.taxId ?? existing.tax_id, b.email ?? existing.email, b.phone ?? existing.phone,
     b.address ?? existing.address, b.city ?? existing.city, b.zip ?? existing.zip, b.notes ?? existing.notes, req.params.id]
  );
  res.json(get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
