const express = require('express');
const { all, get, run } = require('../../db');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('servicios'));

router.get('/', (req, res) => {
  const { active } = req.query;
  let sql = 'SELECT * FROM services WHERE 1=1';
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
  if (!b.name) return res.status(400).json({ error: 'El nombre del servicio es obligatorio' });
  const result = run(
    `INSERT INTO services (name, description, pricing_type, hourly_rate, flat_price, active) VALUES (?,?,?,?,?,?)`,
    [b.name, b.description || null, b.pricingType || 'hora', b.hourlyRate ?? 0, b.flatPrice ?? 0, b.active === false ? 0 : 1]
  );
  res.status(201).json(get('SELECT * FROM services WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM services WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Servicio no encontrado' });
  run(
    `UPDATE services SET name=?, description=?, pricing_type=?, hourly_rate=?, flat_price=?, active=? WHERE id=?`,
    [b.name ?? existing.name, b.description ?? existing.description, b.pricingType ?? existing.pricing_type,
     b.hourlyRate ?? existing.hourly_rate, b.flatPrice ?? existing.flat_price,
     b.active !== undefined ? (b.active ? 1 : 0) : existing.active, req.params.id]
  );
  res.json(get('SELECT * FROM services WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM services WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
