const express = require('express');
const { all, get, run, nowIso } = require('../../db');
const { nextDocNumber } = require('../utils/numbering');
const { requireModuleEdit } = require('../middleware/auth');
const { makeDocUploader } = require('../middleware/upload');

// Módulo de garantías. Dos tipos de registro en la misma tabla:
//   - 'reclamo'  (NX-WC-AAAAMMDD-NN): reclamo de garantía al fabricante.
//   - 'registro' (NX-WR-AAAAMMDD-NN): registro de la garantía de un equipo comprado, con
//     los archivos de constancia adjuntos.
// Se puede enlazar a un vehículo de la Recepción de Vehículos (y a un equipo instalado en
// él), a una orden de compra y a un proveedor/fabricante. Ningún dato es obligatorio.
const router = express.Router();
router.use(requireModuleEdit('garantias'));
const docUpload = makeDocUploader('warranty-docs');

const FIELDS = {
  kind: 'kind', status: 'status', vehicleId: 'vehicle_id', vehicleEquipmentId: 'vehicle_equipment_id',
  purchaseOrderId: 'purchase_order_id', supplierId: 'supplier_id', customerId: 'customer_id',
  responsibleUserId: 'responsible_user_id', itemDescription: 'item_description', vin: 'vin',
  serialNumber: 'serial_number', manufacturer: 'manufacturer', model: 'model', year: 'year',
  purchaseDate: 'purchase_date', warrantyStart: 'warranty_start', warrantyEnd: 'warranty_end',
  claimDate: 'claim_date', manufacturerClaimNumber: 'manufacturer_claim_number',
  problemDescription: 'problem_description', resolution: 'resolution', claimAmount: 'claim_amount',
  approvedAmount: 'approved_amount', notes: 'notes', productSerialId: 'product_serial_id',
};
const ID_FIELDS = new Set(['product_serial_id', 'vehicle_id', 'vehicle_equipment_id', 'purchase_order_id', 'supplier_id', 'customer_id', 'responsible_user_id']);
const NUM_FIELDS = new Set(['year', 'claim_amount', 'approved_amount']);

function clean(col, v) {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return null;
  if (ID_FIELDS.has(col)) { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; }
  if (NUM_FIELDS.has(col)) { const n = parseFloat(v); return Number.isNaN(n) ? null : n; }
  return typeof v === 'string' ? v.trim() : v;
}

const SELECT = `
  SELECT w.*, s.name AS supplier_name, s.email AS supplier_email, s.phone AS supplier_phone,
         s.address AS supplier_address, s.city AS supplier_city, s.zip AS supplier_zip,
         c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
         u.name AS responsible_name, u.email AS responsible_email,
         po.number AS purchase_order_number, v.vin AS vehicle_vin,
         v.make AS vehicle_make, v.model AS vehicle_model, v.year AS vehicle_year,
         ve.serial_number AS equipment_serial,
         COALESCE(et.name, ve.custom_type_name) AS equipment_type_name
  FROM warranties w
  LEFT JOIN suppliers s ON s.id = w.supplier_id
  LEFT JOIN customers c ON c.id = w.customer_id
  LEFT JOIN users u ON u.id = w.responsible_user_id
  LEFT JOIN purchase_orders po ON po.id = w.purchase_order_id
  LEFT JOIN vehicles v ON v.id = w.vehicle_id
  LEFT JOIN vehicle_equipment ve ON ve.id = w.vehicle_equipment_id
  LEFT JOIN equipment_types et ON et.id = ve.equipment_type_id`;

function withAttachments(w) {
  if (!w) return w;
  w.attachments = all('SELECT * FROM warranty_attachments WHERE warranty_id = ? ORDER BY id', [w.id]);
  return w;
}
const getOne = (id) => withAttachments(get(`${SELECT} WHERE w.id = ?`, [id]));

// Personas que pueden ser responsables de una garantía (usuarios activos del ERP).
router.get('/responsibles', (req, res) => {
  res.json(all("SELECT id, name, email FROM users WHERE status != 'desactivado' ORDER BY name"));
});

router.get('/', (req, res) => {
  const { kind, vehicleId, purchaseOrderId } = req.query;
  let sql = `${SELECT} WHERE 1=1`;
  const params = [];
  if (kind) { sql += ' AND w.kind = ?'; params.push(kind); }
  if (vehicleId) { sql += ' AND w.vehicle_id = ?'; params.push(vehicleId); }
  if (purchaseOrderId) { sql += ' AND w.purchase_order_id = ?'; params.push(purchaseOrderId); }
  sql += ' ORDER BY w.created_at DESC, w.id DESC';
  res.json(all(sql, params));
});

router.get('/:id', (req, res) => {
  const w = getOne(req.params.id);
  if (!w) return res.status(404).json({ error: 'Garantía no encontrada' });
  res.json(w);
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const kind = b.kind === 'registro' ? 'registro' : 'reclamo';
  const number = nextDocNumber('warranties', kind === 'registro' ? 'WR' : 'WC');
  const cols = ['number', 'kind', 'status'];
  const vals = [number, kind, clean('status', b.status) || (kind === 'registro' ? 'registrada' : 'abierta')];
  for (const [key, col] of Object.entries(FIELDS)) {
    if (col === 'kind' || col === 'status') continue;
    const v = clean(col, b[key]);
    if (v !== undefined) { cols.push(col); vals.push(v); }
  }
  const result = run(
    `INSERT INTO warranties (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    vals
  );
  res.status(201).json(getOne(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = get('SELECT * FROM warranties WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Garantía no encontrada' });
  const b = req.body || {};
  const sets = [];
  const vals = [];
  for (const [key, col] of Object.entries(FIELDS)) {
    if (col === 'kind') continue; // el tipo (reclamo/registro) define el número; no se cambia
    const v = clean(col, b[key]);
    if (v !== undefined) { sets.push(`${col} = ?`); vals.push(v); }
  }
  if (sets.length) {
    sets.push('updated_at = ?'); vals.push(nowIso());
    run(`UPDATE warranties SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.params.id]);
  }
  res.json(getOne(req.params.id));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM warranties WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

router.post('/:id/attachments', docUpload.array('files', 10), (req, res) => {
  const w = get('SELECT id FROM warranties WHERE id = ?', [req.params.id]);
  if (!w) return res.status(404).json({ error: 'Garantía no encontrada' });
  for (const f of req.files || []) {
    run('INSERT INTO warranty_attachments (warranty_id, file_url, original_name) VALUES (?,?,?)',
      [req.params.id, `/uploads/warranty-docs/${f.filename}`, f.originalname]);
  }
  res.status(201).json(getOne(req.params.id));
});

router.delete('/:id/attachments/:attachmentId', (req, res) => {
  run('DELETE FROM warranty_attachments WHERE id = ? AND warranty_id = ?', [req.params.attachmentId, req.params.id]);
  res.status(204).end();
});

module.exports = router;
