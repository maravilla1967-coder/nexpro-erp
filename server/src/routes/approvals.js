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

router.post('/:id/approve', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede aprobar.' });
  const reqRow = get('SELECT * FROM approval_requests WHERE id = ?', [req.params.id]);
  if (!reqRow) return res.status(404).json({ error: 'Solicitud no encontrada' });
  if (reqRow.status !== 'pendiente') return res.status(400).json({ error: 'Esta solicitud ya fue resuelta' });

  const payloadObj = reqRow.payload ? (() => { try { return JSON.parse(reqRow.payload); } catch (_) { return {}; } })() : {};
  // Solicitudes del control de cambios general: se vuelve a ejecutar la misma operación,
  // ahora con la sesión del administrador que aprueba.
  if (payloadObj && payloadObj.replay) {
    const { method, url, body } = payloadObj.replay;
    try {
      const r = await fetch(`http://127.0.0.1:${process.env.PORT || 4000}${url}`, {
        method, headers: { Authorization: req.headers.authorization || '', 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify(body || {}),
      });
      if (r.status >= 400) {
        const e = await r.json().catch(() => ({}));
        return res.status(400).json({ error: `No se pudo aplicar el cambio: ${e.error || r.status}` });
      }
    } catch (err) { return res.status(500).json({ error: `No se pudo aplicar el cambio: ${err.message}` }); }
    run(`UPDATE approval_requests SET status = 'aprobado', resolved_by = ?, resolved_at = datetime('now') WHERE id = ?`, [req.user.id, req.params.id]);
    return res.json(withRequester(get('SELECT * FROM approval_requests WHERE id = ?', [req.params.id])));
  }
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
