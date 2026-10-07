const express = require('express');
const { all, get, run } = require('../../db');

const router = express.Router();

router.get('/', (req, res) => {
  const { active } = req.query;
  let sql = 'SELECT * FROM mechanics WHERE 1=1';
  const params = [];
  if (active !== undefined) {
    sql += ' AND active = ?';
    params.push(active === 'true' ? 1 : 0);
  }
  sql += ' ORDER BY name';
  res.json(all(sql, params));
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const result = run(
    `INSERT INTO mechanics (name, specialty, phone, email, active) VALUES (?,?,?,?,?)`,
    [b.name, b.specialty || null, b.phone || null, b.email || null, b.active === false ? 0 : 1]
  );
  res.status(201).json(get('SELECT * FROM mechanics WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM mechanics WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Mecánico no encontrado' });
  run(
    `UPDATE mechanics SET name=?, specialty=?, phone=?, email=?, active=? WHERE id=?`,
    [b.name ?? existing.name, b.specialty ?? existing.specialty, b.phone ?? existing.phone, b.email ?? existing.email,
     b.active !== undefined ? (b.active ? 1 : 0) : existing.active, req.params.id]
  );
  res.json(get('SELECT * FROM mechanics WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM mechanics WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
