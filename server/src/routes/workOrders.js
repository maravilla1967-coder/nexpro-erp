const express = require('express');
const { all, get, run, nowIso } = require('../../db');
const { nextNumber } = require('../utils/numbering');

const router = express.Router();

function calcServiceTotal(svc) {
  if (svc.pricingType === 'servicio_completo' || svc.pricing_type === 'servicio_completo') {
    return Number(svc.flatPrice ?? svc.flat_price ?? 0);
  }
  const hours = Number(svc.hours ?? 0);
  const rate = Number(svc.hourlyRate ?? svc.hourly_rate ?? 0);
  return Math.round(hours * rate * 100) / 100;
}

function calcPartTotal(part) {
  const qty = Number(part.quantity ?? 1);
  const unitCost = Number(part.unitCost ?? part.unit_cost ?? 0);
  return Math.round(qty * unitCost * 100) / 100;
}

function withDetails(wo) {
  if (!wo) return wo;
  const services = all(
    `SELECT wos.*, s.name as service_name FROM work_order_services wos
     LEFT JOIN services s ON s.id = wos.service_id WHERE wos.work_order_id = ?`,
    [wo.id]
  );
  const parts = all(
    `SELECT * FROM work_order_parts WHERE work_order_id = ? ORDER BY id`,
    [wo.id]
  );
  wo.services = services;
  wo.parts = parts;
  const servicesTotal = services.reduce((sum, s) => sum + Number(s.total), 0);
  const partsTotal = parts.reduce((sum, p) => sum + Number(p.total), 0);
  wo.total = Math.round((servicesTotal + partsTotal) * 100) / 100;
  return wo;
}

function insertParts(workOrderId, parts) {
  if (!Array.isArray(parts)) return;
  for (const p of parts) {
    if (!p.description) continue;
    const total = calcPartTotal(p);
    run(
      `INSERT INTO work_order_parts (work_order_id, description, action, quantity, unit_cost, total)
       VALUES (?,?,?,?,?,?)`,
      [workOrderId, p.description, p.action || 'reemplazada', Number(p.quantity ?? 1), Number(p.unitCost ?? p.unit_cost ?? 0), total]
    );
  }
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = `SELECT wo.*, v.vin, v.make, v.model, v.year, v.chassis_type, v.plate, m.name as mechanic_name FROM work_orders wo
             LEFT JOIN vehicles v ON v.id = wo.vehicle_id
             LEFT JOIN mechanics m ON m.id = wo.mechanic_id WHERE 1=1`;
  const params = [];
  if (status) {
    sql += ' AND wo.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY wo.created_at DESC';
  const list = all(sql, params);
  res.json(list.map(withDetails));
});

router.get('/:id', (req, res) => {
  const wo = get(
    `SELECT wo.*, v.vin, v.make, v.model, v.year, v.chassis_type, v.plate, v.customer_id, m.name as mechanic_name
     FROM work_orders wo
     LEFT JOIN vehicles v ON v.id = wo.vehicle_id
     LEFT JOIN mechanics m ON m.id = wo.mechanic_id WHERE wo.id = ?`,
    [req.params.id]
  );
  if (!wo) return res.status(404).json({ error: 'Orden de trabajo no encontrada' });
  res.json(withDetails(wo));
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.vehicleId) return res.status(400).json({ error: 'El vehículo es obligatorio' });
  const number = nextNumber('work_orders', 'OT');
  const result = run(
    `INSERT INTO work_orders (number, vehicle_id, mechanic_id, status, notes, diagnosis, resolution) VALUES (?,?,?,?,?,?,?)`,
    [number, b.vehicleId, b.mechanicId || null, b.status || 'pendiente', b.notes || null, b.diagnosis || null, b.resolution || null]
  );
  const woId = result.lastInsertRowid;
  if (Array.isArray(b.services)) {
    for (const svc of b.services) {
      const total = calcServiceTotal(svc);
      run(
        `INSERT INTO work_order_services (work_order_id, service_id, description, pricing_type, hours, hourly_rate, flat_price, total)
         VALUES (?,?,?,?,?,?,?,?)`,
        [woId, svc.serviceId || null, svc.description, svc.pricingType || 'hora', svc.hours ?? 0, svc.hourlyRate ?? 0, svc.flatPrice ?? 0, total]
      );
    }
  }
  insertParts(woId, b.parts);
  // actualizar estado del vehiculo
  run(`UPDATE vehicles SET status = 'en_servicio' WHERE id = ? AND status = 'recibido'`, [b.vehicleId]);
  res.status(201).json(withDetails(get('SELECT * FROM work_orders WHERE id = ?', [woId])));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM work_orders WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Orden de trabajo no encontrada' });
  run(
    `UPDATE work_orders SET mechanic_id=?, status=?, notes=?, diagnosis=?, resolution=?, updated_at=? WHERE id=?`,
    [b.mechanicId ?? existing.mechanic_id, b.status ?? existing.status, b.notes ?? existing.notes,
     b.diagnosis ?? existing.diagnosis, b.resolution ?? existing.resolution, nowIso(), req.params.id]
  );
  if (Array.isArray(b.services)) {
    run('DELETE FROM work_order_services WHERE work_order_id = ?', [req.params.id]);
    for (const svc of b.services) {
      const total = calcServiceTotal(svc);
      run(
        `INSERT INTO work_order_services (work_order_id, service_id, description, pricing_type, hours, hourly_rate, flat_price, total)
         VALUES (?,?,?,?,?,?,?,?)`,
        [req.params.id, svc.serviceId || null, svc.description, svc.pricingType || 'hora', svc.hours ?? 0, svc.hourlyRate ?? 0, svc.flatPrice ?? 0, total]
      );
    }
  }
  if (Array.isArray(b.parts)) {
    run('DELETE FROM work_order_parts WHERE work_order_id = ?', [req.params.id]);
    insertParts(req.params.id, b.parts);
  }
  if (b.status === 'completado') {
    run(`UPDATE vehicles SET status = 'completado' WHERE id = ?`, [existing.vehicle_id]);
  }
  res.json(withDetails(get('SELECT * FROM work_orders WHERE id = ?', [req.params.id])));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM work_orders WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
