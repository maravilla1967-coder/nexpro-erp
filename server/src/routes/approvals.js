const express = require('express');
const { get, all, run } = require('../../db');
const invoicesService = require('./invoices').service;
const salesOrdersService = require('./salesOrders').service;

const router = express.Router();

function withRequester(reqRow) {
  if (!reqRow) return reqRow;
  const requester = get('SELECT id, name, email FROM users WHERE id = ?', [reqRow.requested_by]);
  const resolver = reqRow.resolved_by ? get('SELECT id, name, email FROM users WHERE id = ?', [reqRow.resolved_by]) : null;
  return { ...reqRow, requested_by_name: requester ? requester.name : null, resolved_by_name: resolver ? resolver.name : null };
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM approval_requests WHERE 1=1';
  const params = [];
  if (req.user.role !== 'admin') {
    sql += ' AND requested_by = ?';
    params.push(req.user.id);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  res.json(all(sql, params).map(withRequester));
});

router.post('/:id/approve', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede aprobar.' });
  const reqRow = get('SELECT * FROM approval_requests WHERE id = ?', [req.params.id]);
  if (!reqRow) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (reqRow.status !== 'pendiente') return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });

  const service = reqRow.entity_type === 'invoice' ? invoicesService : salesOrdersService;
  try {
    if (reqRow.action === 'delete') {
      service.applyDelete(reqRow.entity_id);
    } else {
      const payload = reqRow.payload ? JSON.parse(reqRow.payload) : {};
      service.applyUpdate(reqRow.entity_id, payload);
    }
  } catch (err) {
    return res.status(500).json({ error: `No se pudo aplicar el cambio: ${err.message}` });
  }

  run(
    `UPDATE approval_requests SET status = 'aprobado', resolved_by = ?, resolved_at = datetime('now') WHERE id = ?`,
    [req.user.id, req.params.id]
  );
  res.json(withRequester(get('SELECT * FROM approval_requests WHERE id = ?', [req.params.id])));
});

router.post('/:id/reject', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede rechazar.' });
  const reqRow = get('SELECT * FROM approval_requests WHERE id = ?', [req.params.id]);
  if (!reqRow) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (reqRow.status !== 'pendiente') return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });

  run(
    `UPDATE approval_requests SET status = 'rechazado', resolved_by = ?, resolved_at = datetime('now'), reject_reason = ? WHERE id = ?`,
    [req.user.id, (req.body && req.body.reason) || null, req.params.id]
  );
  res.json(withRequester(get('SELECT * FROM approval_requests WHERE id = ?', [req.params.id])));
});

module.exports = router;
