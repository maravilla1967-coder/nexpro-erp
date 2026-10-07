const express = require('express');
const { all, get, run } = require('../../db');
const { makeUploader } = require('../middleware/upload');

const router = express.Router();
const upload = makeUploader('vehicles');

function withDetails(vehicle) {
  if (!vehicle) return vehicle;
  vehicle.equipment = all(
    `SELECT ve.*, et.name as equipment_type_name FROM vehicle_equipment ve
     LEFT JOIN equipment_types et ON et.id = ve.equipment_type_id
     WHERE ve.vehicle_id = ? ORDER BY ve.id`,
    [vehicle.id]
  );
  vehicle.workOrders = all(
    `SELECT wo.*, m.name as mechanic_name FROM work_orders wo
     LEFT JOIN mechanics m ON m.id = wo.mechanic_id
     WHERE wo.vehicle_id = ? ORDER BY wo.created_at DESC`,
    [vehicle.id]
  );
  return vehicle;
}

// ---- Equipment Types (lista de tipos de equipo: grua, compresor, bucket lift, lift gate...) ----
router.get('/equipment-types', (req, res) => {
  res.json(all('SELECT * FROM equipment_types ORDER BY name'));
});

router.post('/equipment-types', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre del tipo de equipo es obligatorio' });
  const existing = get('SELECT * FROM equipment_types WHERE name = ?', [name]);
  if (existing) return res.status(200).json(existing);
  const result = run('INSERT INTO equipment_types (name) VALUES (?)', [name]);
  res.status(201).json(get('SELECT * FROM equipment_types WHERE id = ?', [result.lastInsertRowid]));
});

router.delete('/equipment-types/:id', (req, res) => {
  run('DELETE FROM equipment_types WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// ---- Vehicles ----
router.get('/', (req, res) => {
  const { q, status } = req.query;
  let sql = `SELECT v.*, c.name as customer_name FROM vehicles v
             LEFT JOIN customers c ON c.id = v.customer_id WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ' AND (v.vin LIKE ? OR v.make LIKE ? OR v.model LIKE ? OR v.plate LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (status) {
    sql += ' AND v.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY v.received_at DESC';
  res.json(all(sql, params));
});

router.get('/:id', (req, res) => {
  const vehicle = get(
    `SELECT v.*, c.name as customer_name FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id WHERE v.id = ?`,
    [req.params.id]
  );
  if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
  res.json(withDetails(vehicle));
});

router.get('/by-vin/:vin', (req, res) => {
  const vehicle = get('SELECT * FROM vehicles WHERE vin = ?', [req.params.vin]);
  if (!vehicle) return res.status(404).json({ error: 'No existe un vehículo con ese VIN' });
  res.json(withDetails(vehicle));
});

// Recibir vehículo por VIN
router.post('/', upload.single('photo'), (req, res) => {
  const b = req.body;
  if (!b.vin) return res.status(400).json({ error: 'El VIN es obligatorio' });
  const existing = get('SELECT * FROM vehicles WHERE vin = ?', [b.vin]);
  if (existing) return res.status(409).json({ error: 'Ya existe un vehículo registrado con ese VIN', vehicle: existing });

  const photoUrl = req.file ? `/uploads/vehicles/${req.file.filename}` : (b.photoUrl || null);
  const result = run(
    `INSERT INTO vehicles (vin, make, model, year, chassis_type, plate, customer_id, photo_url, status, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [b.vin, b.make || null, b.model || null, b.year ? parseInt(b.year, 10) : null, b.chassisType || null,
     b.plate || null, b.customerId || null, photoUrl, b.status || 'recibido', b.notes || null]
  );
  res.status(201).json(withDetails(get('SELECT * FROM vehicles WHERE id = ?', [result.lastInsertRowid])));
});

router.put('/:id', upload.single('photo'), (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Vehículo no encontrado' });
  const photoUrl = req.file ? `/uploads/vehicles/${req.file.filename}` : (b.photoUrl ?? existing.photo_url);
  run(
    `UPDATE vehicles SET make=?, model=?, year=?, chassis_type=?, plate=?, customer_id=?, photo_url=?, status=?, notes=? WHERE id=?`,
    [b.make ?? existing.make, b.model ?? existing.model, b.year ? parseInt(b.year, 10) : existing.year,
     b.chassisType ?? existing.chassis_type, b.plate ?? existing.plate, b.customerId ?? existing.customer_id,
     photoUrl, b.status ?? existing.status, b.notes ?? existing.notes, req.params.id]
  );
  res.json(withDetails(get('SELECT * FROM vehicles WHERE id = ?', [req.params.id])));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// ---- Equipment relacionado al vehículo (grúas, compresores, bucket lifts, lift gates...) ----
router.post('/:id/equipment', (req, res) => {
  const b = req.body;
  const vehicle = get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
  if (!b.equipmentTypeId && !b.customTypeName) {
    return res.status(400).json({ error: 'Seleccione un tipo de equipo de la lista o escriba uno nuevo' });
  }
  const result = run(
    `INSERT INTO vehicle_equipment (vehicle_id, equipment_type_id, custom_type_name, serial_number, manufacturer, model, notes)
     VALUES (?,?,?,?,?,?,?)`,
    [req.params.id, b.equipmentTypeId || null, b.customTypeName || null, b.serialNumber || null,
     b.manufacturer || null, b.model || null, b.notes || null]
  );
  res.status(201).json(get(
    `SELECT ve.*, et.name as equipment_type_name FROM vehicle_equipment ve
     LEFT JOIN equipment_types et ON et.id = ve.equipment_type_id WHERE ve.id = ?`,
    [result.lastInsertRowid]
  ));
});

router.put('/equipment/:equipId', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM vehicle_equipment WHERE id = ?', [req.params.equipId]);
  if (!existing) return res.status(404).json({ error: 'Equipo no encontrado' });
  run(
    `UPDATE vehicle_equipment SET equipment_type_id=?, custom_type_name=?, serial_number=?, manufacturer=?, model=?, notes=? WHERE id=?`,
    [b.equipmentTypeId ?? existing.equipment_type_id, b.customTypeName ?? existing.custom_type_name,
     b.serialNumber ?? existing.serial_number, b.manufacturer ?? existing.manufacturer, b.model ?? existing.model,
     b.notes ?? existing.notes, req.params.equipId]
  );
  res.json(get('SELECT * FROM vehicle_equipment WHERE id = ?', [req.params.equipId]));
});

router.delete('/equipment/:equipId', (req, res) => {
  run('DELETE FROM vehicle_equipment WHERE id = ?', [req.params.equipId]);
  res.status(204).end();
});

module.exports = router;
