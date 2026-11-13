const express = require('express');
const { all, get, run } = require('../../db');

// Listas abiertas: opciones que los usuarios agregan cuando aparece algo nuevo
// (p. ej. un tipo o estado de contacto que no estaba en la lista).
// GET /api/options/:list → [{ value }] · POST /api/options/:list { value } → crea si no existe.
const router = express.Router();
const LISTS = new Set(['customer_type', 'customer_status']);

router.get('/:list', (req, res) => {
  if (!LISTS.has(req.params.list)) return res.status(404).json({ error: 'Lista no encontrada' });
  res.json(all('SELECT value FROM custom_options WHERE list = ? ORDER BY value COLLATE NOCASE', [req.params.list]));
});

router.post('/:list', (req, res) => {
  if (!LISTS.has(req.params.list)) return res.status(404).json({ error: 'Lista no encontrada' });
  const value = String((req.body || {}).value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!value) return res.status(400).json({ error: 'Escribe la opción nueva' });
  const dup = get('SELECT value FROM custom_options WHERE list = ? AND lower(value) = lower(?)', [req.params.list, value]);
  if (!dup) run('INSERT INTO custom_options (list, value) VALUES (?, ?)', [req.params.list, value]);
  res.status(201).json({ value: dup ? dup.value : value });
});

module.exports = router;
