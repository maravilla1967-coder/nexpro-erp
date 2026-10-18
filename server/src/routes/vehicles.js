const express = require('express');
const { all, get, run } = require('../../db');
const { makeUploader } = require('../middleware/upload');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('vehiculos'));
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
    `SELECT wo.*, m.name as mechanic_name, i.number as invoice_number FROM work_orders wo
     LEFT JOIN mechanics m ON m.id = wo.mechanic_id
     LEFT JOIN invoices i ON i.id = wo.invoice_id
     WHERE wo.vehicle_id = ? ORDER BY wo.created_at DESC`,
    [vehicle.id]
  );
  // Adjunta servicios y partes de cada orden de trabajo, para poder imprimir el
  // documento de recepción del vehículo (firmable) aunque todavía no exista ninguna
  // orden de trabajo, y mostrar el trabajo realizado una vez que sí exista.
  vehicle.workOrders.forEach((wo) => {
    wo.services = all(
      `SELECT wos.*, s.name as service_name FROM work_order_services wos
       LEFT JOIN services s ON s.id = wos.service_id WHERE wos.work_order_id = ?`,
      [wo.id]
    );
    wo.parts = all('SELECT * FROM work_order_parts WHERE work_order_id = ? ORDER BY id', [wo.id]);
    wo.photos = all('SELECT * FROM work_order_photos WHERE work_order_id = ? ORDER BY id', [wo.id]);
  });
  return vehicle;
}

// ---- Equipment Types (lista de tipos de equipo: grua, compresor, bucket lift, lift gate...) ----
router.get('/equipment-types', (req, res) => {
  res.json(all(`SELECT et.*, (SELECT COUNT(*) FROM vehicle_equipment ve WHERE ve.equipment_type_id = et.id) AS uses
                FROM equipment_types et ORDER BY et.name COLLATE NOCASE`));
});

router.put('/equipment-types/:id', (req, res) => {
  const name = String((req.body || {}).name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre del tipo de equipo es obligatorio' });
  const dup = get('SELECT id FROM equipment_types WHERE lower(name) = lower(?) AND id != ?', [name, req.params.id]);
  if (dup) return res.status(409).json({ error: 'Ya existe un tipo de equipo con ese nombre' });
  run('UPDATE equipment_types SET name = ? WHERE id = ?', [name, req.params.id]);
  res.json(get('SELECT * FROM equipment_types WHERE id = ?', [req.params.id]));
});

router.post('/equipment-types', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre del tipo de equipo es obligatorio' });
  const existing = get('SELECT * FROM equipment_types WHERE lower(name) = lower(?)', [String(name).trim()]);
  if (existing) return res.status(200).json(existing);
  const result = run('INSERT INTO equipment_types (name) VALUES (?)', [name]);
  res.status(201).json(get('SELECT * FROM equipment_types WHERE id = ?', [result.lastInsertRowid]));
});

router.delete('/equipment-types/:id', (req, res) => {
  const used = get('SELECT COUNT(*) AS n FROM vehicle_equipment WHERE equipment_type_id = ?', [req.params.id]).n;
  if (used > 0) return res.status(400).json({ error: `No se puede borrar: ${used} equipo(s) instalado(s) usan este tipo. Cámbiale el nombre si está mal escrito.` });
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

function getVehicleFull(id) {
  return get(
    `SELECT v.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
            c.tax_id as customer_tax_id, c.address as customer_address, c.city as customer_city, c.zip as customer_zip
     FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id WHERE v.id = ?`, [id]);
}

router.get('/:id', (req, res) => {
  const vehicle = get(
    `SELECT v.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
            c.tax_id as customer_tax_id, c.address as customer_address, c.city as customer_city, c.zip as customer_zip
     FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id WHERE v.id = ?`,
    [req.params.id]
  );
  if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
  res.json(withDetails(vehicle));
});

router.get('/by-vin/:vin', (req, res) => {
  const vehicle = get(
    `SELECT v.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
            c.tax_id as customer_tax_id, c.address as customer_address, c.city as customer_city, c.zip as customer_zip
     FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id WHERE v.vin = ?`,
    [req.params.vin]
  );
  if (!vehicle) return res.status(404).json({ error: 'No existe un vehículo con ese VIN' });
  res.json(withDetails(vehicle));
});

// Cliente de la recepción: se puede mandar customerId o customerName (escrito a mano). Si el
// nombre no existe en clientes, se crea el cliente nuevo para que quede enlazado al vehículo.
// Devuelve undefined si no se mandó nada (no cambiar), null para dejarlo sin cliente.
function resolveCustomer(b) {
  if (b.customerName !== undefined) {
    const name = String(b.customerName).trim();
    if (!name) return null;
    const found = get('SELECT id FROM customers WHERE lower(trim(name)) = lower(?)', [name]);
    if (found) return found.id;
    return run(`INSERT INTO customers (type, name, status, source) VALUES ('empresa', ?, 'cliente', 'Recepción de vehículo')`, [name]).lastInsertRowid;
  }
  if (b.customerId !== undefined) { const c = parseInt(b.customerId, 10); return Number.isNaN(c) ? null : c; }
  return undefined;
}

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
     b.plate || null, resolveCustomer(b) || null, photoUrl, b.status || 'recibido', b.notes || null]
  );
  res.status(201).json(withDetails(getVehicleFull(result.lastInsertRowid)));
});

// Editar la recepción: se puede completar o corregir cualquier dato después (incluido el VIN,
// si se recibió con un VIN provisional o mal escrito). Un campo enviado vacío se borra.
router.put('/:id', upload.single('photo'), (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Vehículo no encontrado' });
  const val = (v, old) => (v === undefined ? old : (String(v).trim() === '' ? null : String(v).trim()));
  let vin = existing.vin;
  if (b.vin !== undefined) {
    vin = String(b.vin).trim().toUpperCase();
    if (!vin) return res.status(400).json({ error: 'El VIN no puede quedar vacío' });
    const dup = get('SELECT id FROM vehicles WHERE vin = ? AND id != ?', [vin, existing.id]);
    if (dup) return res.status(409).json({ error: 'Ya existe otro vehículo registrado con ese VIN' });
  }
  let year = existing.year;
  if (b.year !== undefined) { const y = parseInt(b.year, 10); year = Number.isNaN(y) ? null : y; }
  const rc = resolveCustomer(b);
  const customerId = rc === undefined ? existing.customer_id : rc;
  const photoUrl = req.file ? `/uploads/vehicles/${req.file.filename}` : (b.photoUrl ?? existing.photo_url);
  const receivedAt = b.receivedAt ? `${String(b.receivedAt).slice(0, 10)}${String(existing.received_at || '').slice(10) || ' 00:00:00'}` : existing.received_at;
  run(
    `UPDATE vehicles SET vin=?, make=?, model=?, year=?, chassis_type=?, plate=?, customer_id=?, photo_url=?, status=?, notes=?, received_at=? WHERE id=?`,
    [vin, val(b.make, existing.make), val(b.model, existing.model), year, val(b.chassisType, existing.chassis_type),
     val(b.plate, existing.plate), customerId, photoUrl, b.status || existing.status, val(b.notes, existing.notes), receivedAt, req.params.id]
  );
  res.json(withDetails(getVehicleFull(req.params.id)));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM vehicles WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// Lista maestra de tipos de equipo: si se escribe un tipo que no existe, se agrega a la lista
// para que aparezca la próxima vez (sin duplicar por mayúsculas/minúsculas).
function resolveEquipmentType(b) {
  if (b.equipmentTypeId) return { typeId: parseInt(b.equipmentTypeId, 10) || null, custom: null };
  const name = String(b.typeName || b.customTypeName || '').trim();
  if (!name) return { typeId: null, custom: null };
  const found = get('SELECT id FROM equipment_types WHERE lower(name) = lower(?)', [name]);
  if (found) return { typeId: found.id, custom: null };
  return { typeId: run('INSERT INTO equipment_types (name) VALUES (?)', [name]).lastInsertRowid, custom: null };
}

// ---- Equipment relacionado al vehículo (grúas, compresores, bucket lifts, lift gates...) ----
router.post('/:id/equipment', (req, res) => {
  const b = req.body;
  const vehicle = get('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
  if (!vehicle) return res.status(404).json({ error: 'Vehículo no encontrado' });
  const { typeId } = resolveEquipmentType(b);
  if (!typeId) return res.status(400).json({ error: 'Elige un tipo de equipo de la lista o escribe uno nuevo' });
  const result = run(
    `INSERT INTO vehicle_equipment (vehicle_id, equipment_type_id, custom_type_name, serial_number, manufacturer, model, notes)
     VALUES (?,?,?,?,?,?,?)`,
    [req.params.id, typeId, null, b.serialNumber || null,
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
  const r = (b.equipmentTypeId || b.typeName || b.customTypeName) ? resolveEquipmentType(b) : { typeId: existing.equipment_type_id };
  run(
    `UPDATE vehicle_equipment SET equipment_type_id=?, custom_type_name=?, serial_number=?, manufacturer=?, model=?, notes=? WHERE id=?`,
    [r.typeId || existing.equipment_type_id, r.typeId ? null : existing.custom_type_name,
     b.serialNumber ?? existing.serial_number, b.manufacturer ?? existing.manufacturer, b.model ?? existing.model,
     b.notes ?? existing.notes, req.params.equipId]
  );
  res.json(get(`SELECT ve.*, et.name as equipment_type_name FROM vehicle_equipment ve
                LEFT JOIN equipment_types et ON et.id = ve.equipment_type_id WHERE ve.id = ?`, [req.params.equipId]));
});

router.delete('/equipment/:equipId', (req, res) => {
  run('DELETE FROM vehicle_equipment WHERE id = ?', [req.params.equipId]);
  res.status(204).end();
});

module.exports = router;
