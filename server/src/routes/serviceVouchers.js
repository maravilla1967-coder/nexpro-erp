const express = require('express');
const { db, all, get, run } = require('../../db');
const { requireModuleEdit } = require('../middleware/auth');
const { makeDocUploader } = require('../middleware/upload');
const { nextDocNumber } = require('../utils/numbering');
const { attachFiles } = require('../utils/paymentFiles');

// Comprobantes de pago sin factura (NX-PS-AAAAMMDD-NN): pago a un proveedor de servicios
// (persona o empresa) que no expide factura. Cada comprobante crea su cuenta por pagar
// (supplier_bills) y, si ya se pagó, el pago; así aparece en Cuentas por pagar con todo lo demás.
const router = express.Router();
router.use(requireModuleEdit('compras'));
const upload = makeDocUploader('service-voucher-docs');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (v) => parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));

const SELECT = `
  SELECT v.*, s.name AS supplier_name, s.tax_id AS supplier_tax_id, s.phone AS supplier_phone, s.email AS supplier_email,
         s.address AS supplier_address, s.city AS supplier_city, s.zip AS supplier_zip,
         ve.vin AS vehicle_vin, ve.make AS vehicle_make, ve.model AS vehicle_model, ve.year AS vehicle_year,
         c.name AS customer_name, wo.number AS work_order_number, u.name AS created_by_name,
         b.status AS bill_status, b.due_date AS bill_due_date,
         ROUND((SELECT COALESCE(SUM(p.amount),0) FROM supplier_bill_payments p WHERE p.bill_id = v.bill_id), 2) AS paid
  FROM service_vouchers v
  LEFT JOIN suppliers s ON s.id = v.supplier_id
  LEFT JOIN vehicles ve ON ve.id = v.vehicle_id
  LEFT JOIN customers c ON c.id = ve.customer_id
  LEFT JOIN work_orders wo ON wo.id = v.work_order_id
  LEFT JOIN users u ON u.id = v.created_by
  LEFT JOIN supplier_bills b ON b.id = v.bill_id`;

function createBill(supplierId, number, date, dueDate, amount, paid) {
  return run(
    `INSERT INTO supplier_bills (supplier_id, bill_number, bill_date, due_date, amount, status, notes) VALUES (?,?,?,?,?,?,?)`,
    [supplierId, number, date, dueDate || date, amount, paid ? 'pagada' : 'pendiente', `Comprobante de pago sin factura ${number}`]
  ).lastInsertRowid;
}
function refreshBill(billId) {
  const bill = get('SELECT * FROM supplier_bills WHERE id = ?', [billId]);
  if (!bill || bill.status === 'anulada') return;
  const paid = round2(get('SELECT COALESCE(SUM(amount),0) s FROM supplier_bill_payments WHERE bill_id = ?', [billId]).s);
  const st = paid >= bill.amount - 0.004 && bill.amount > 0 ? 'pagada' : paid > 0 ? 'parcial' : 'pendiente';
  run('UPDATE supplier_bills SET status = ? WHERE id = ?', [st, billId]);
}
// Estado del comprobante: borrador (le falta monto o descripción), pendiente, parcial, pagada.
function voucherStatus(v) {
  if (!(v.amount > 0) || !String(v.description || '').trim()) return 'borrador';
  return v.bill_status || 'pendiente';
}

function getFull(id) {
  const v = get(`${SELECT} WHERE v.id = ?`, [id]);
  if (!v) return v;
  v.balance = round2(v.amount - (v.paid || 0));
  v.status = voucherStatus(v);
  v.missing = [!(v.amount > 0) && 'monto', !String(v.description || '').trim() && 'descripción'].filter(Boolean);
  v.payments = v.bill_id ? attachFiles(all('SELECT * FROM supplier_bill_payments WHERE bill_id = ? ORDER BY payment_date, id', [v.bill_id]), 'bill') : [];
  v.files = all('SELECT * FROM service_voucher_files WHERE voucher_id = ? ORDER BY id', [id]);
  return v;
}

// Proveedor: uno existente (supplierId) o uno nuevo con los datos escritos (se busca por nombre
// para no duplicarlo).
function resolveSupplier(b) {
  if (b.supplierId) return Number(b.supplierId);
  const name = String(b.providerName || '').trim();
  if (!name) return null;
  const found = get('SELECT id FROM suppliers WHERE lower(trim(name)) = lower(?)', [name]);
  if (found) {
    // Completa datos que falten.
    run(`UPDATE suppliers SET tax_id = COALESCE(tax_id, ?), phone = COALESCE(phone, ?), address = COALESCE(address, ?), email = COALESCE(email, ?) WHERE id = ?`,
      [b.providerTaxId || null, b.providerPhone || null, b.providerAddress || null, b.providerEmail || null, found.id]);
    return found.id;
  }
  return run(`INSERT INTO suppliers (name, tax_id, phone, address, email, notes) VALUES (?,?,?,?,?,?)`,
    [name, b.providerTaxId || null, b.providerPhone || null, b.providerAddress || null, b.providerEmail || null,
     'Proveedor de servicios (sin factura) — creado desde un comprobante de pago']).lastInsertRowid;
}

router.get('/', (req, res) => {
  const { vehicleId, workOrderId, supplierId } = req.query;
  let sql = `${SELECT} WHERE 1=1`; const params = [];
  if (vehicleId) { sql += ' AND v.vehicle_id = ?'; params.push(vehicleId); }
  if (workOrderId) { sql += ' AND v.work_order_id = ?'; params.push(workOrderId); }
  if (supplierId) { sql += ' AND v.supplier_id = ?'; params.push(supplierId); }
  sql += ' ORDER BY COALESCE(v.service_date, v.created_at) DESC, v.id DESC';
  res.json(all(sql, params).map((v) => ({ ...v, balance: round2(v.amount - (v.paid || 0)), status: voucherStatus(v) })));
});

router.get('/:id', (req, res) => {
  const v = getFull(req.params.id);
  if (!v) return res.status(404).json({ error: 'Comprobante no encontrado' });
  res.json(v);
});

// Crear: multipart (campos + files). payNow=1 registra el pago en el mismo momento.
router.post('/', upload.array('files', 10), (req, res) => {
  const b = req.body || {};
  // Se puede guardar incompleto (borrador): sin monto, sin descripción y sin pago; lo único
  // indispensable es saber a quién se le va a pagar.
  const amount = Math.max(0, round2(money(b.amount)) || 0);
  let woId = b.workOrderId ? Number(b.workOrderId) : null;
  let vehicleId = b.vehicleId ? Number(b.vehicleId) : null;
  if (woId) {
    const wo = get('SELECT id, vehicle_id FROM work_orders WHERE id = ?', [woId]);
    if (!wo) return res.status(400).json({ error: 'La orden de trabajo no existe.' });
    if (!vehicleId) vehicleId = wo.vehicle_id;
  }
  const date = String(b.serviceDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const payNow = String(b.payNow ?? '0') === '1' && amount > 0;
  db.exec('BEGIN');
  try {
    const supplierId = resolveSupplier(b);
    if (!supplierId) throw Object.assign(new Error('Elige el proveedor o escribe su nombre.'), { status: 400 });
    const number = nextDocNumber('service_vouchers', 'PS');
    // La cuenta por pagar se crea cuando ya hay monto (si es borrador sin monto, se crea al editarlo).
    const billId = amount > 0 ? createBill(supplierId, number, date, String(b.dueDate || '').slice(0, 10) || date, amount, payNow) : null;
    if (payNow) {
      run(`INSERT INTO supplier_bill_payments (bill_id, payment_date, amount, method, reference, notes, created_by) VALUES (?,?,?,?,?,?,?)`,
        [billId, String(b.paymentDate || '').slice(0, 10) || date, amount, b.method || null, b.reference || null, 'Pago sin factura', req.user ? req.user.id : null]);
    }
    const id = run(
      `INSERT INTO service_vouchers (number, supplier_id, service_date, service_type, description, amount, vehicle_id, work_order_id, bill_id, received_by, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [number, supplierId, date, b.serviceType || null, String(b.description || '').trim(), amount, vehicleId, woId, billId,
       b.receivedBy || null, b.notes || null, req.user ? req.user.id : null]
    ).lastInsertRowid;
    for (const f of req.files || []) {
      run('INSERT INTO service_voucher_files (voucher_id, file_url, original_name) VALUES (?,?,?)', [id, `/uploads/service-voucher-docs/${f.filename}`, f.originalname]);
    }
    db.exec('COMMIT');
    res.status(201).json(getFull(id));
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Editar los datos del comprobante (descripción, fecha, vehículo/orden, monto si aún no se ha
// pagado más de lo nuevo). El monto se refleja en su cuenta por pagar.
router.put('/:id', upload.array('files', 10), (req, res) => {
  const v = get('SELECT * FROM service_vouchers WHERE id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Comprobante no encontrado' });
  const b = req.body || {};
  const amount = b.amount !== undefined ? Math.max(0, round2(money(b.amount)) || 0) : v.amount;
  const paidSoFar = v.bill_id ? round2(get('SELECT COALESCE(SUM(amount),0) s FROM supplier_bill_payments WHERE bill_id = ?', [v.bill_id]).s) : 0;
  if (amount < paidSoFar - 0.004) return res.status(400).json({ error: `Ya se pagaron $${paidSoFar.toLocaleString('en-US')}; el monto no puede ser menor.` });
  const val = (x, old) => (x === undefined ? old : (String(x).trim() === '' ? null : String(x).trim()));
  let woId = b.workOrderId !== undefined ? (b.workOrderId ? Number(b.workOrderId) : null) : v.work_order_id;
  let vehicleId = b.vehicleId !== undefined ? (b.vehicleId ? Number(b.vehicleId) : null) : v.vehicle_id;
  if (woId && !vehicleId) { const wo = get('SELECT vehicle_id FROM work_orders WHERE id = ?', [woId]); if (wo) vehicleId = wo.vehicle_id; }
  const description = val(b.description, v.description) || '';
  run(`UPDATE service_vouchers SET service_date=?, service_type=?, description=?, amount=?, vehicle_id=?, work_order_id=?, received_by=?, notes=? WHERE id=?`,
    [val(b.serviceDate, v.service_date), val(b.serviceType, v.service_type), description, amount, vehicleId, woId,
     val(b.receivedBy, v.received_by), val(b.notes, v.notes), v.id]);
  if (b.supplierId) run('UPDATE service_vouchers SET supplier_id = ? WHERE id = ?', [Number(b.supplierId), v.id]);
  const supplierNow = b.supplierId ? Number(b.supplierId) : v.supplier_id;
  if (v.bill_id) {
    run('UPDATE supplier_bills SET amount = ?, bill_date = ?, supplier_id = ? WHERE id = ?', [amount, val(b.serviceDate, v.service_date), supplierNow, v.bill_id]);
    refreshBill(v.bill_id);
  } else if (amount > 0) {
    const d = val(b.serviceDate, v.service_date) || new Date().toISOString().slice(0, 10);
    const billId = createBill(supplierNow, v.number, d, String(b.dueDate || '').slice(0, 10) || d, amount, false);
    run('UPDATE service_vouchers SET bill_id = ? WHERE id = ?', [billId, v.id]);
  }
  for (const f of req.files || []) {
    run('INSERT INTO service_voucher_files (voucher_id, file_url, original_name) VALUES (?,?,?)', [v.id, `/uploads/service-voucher-docs/${f.filename}`, f.originalname]);
  }
  res.json(getFull(v.id));
});

// Registrar el pago (total o parcial) del comprobante, con comprobantes adjuntos opcionales.
router.post('/:id/payments', upload.array('files', 10), (req, res) => {
  const v = get('SELECT * FROM service_vouchers WHERE id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Comprobante no encontrado' });
  if (!(v.amount > 0)) return res.status(400).json({ error: 'Primero escribe el monto del servicio (botón Editar).' });
  const b = req.body || {};
  const amount = round2(money(b.amount));
  if (!(amount > 0)) return res.status(400).json({ error: 'El monto del pago debe ser mayor que cero.' });
  let billId = v.bill_id;
  if (!billId) {
    billId = createBill(v.supplier_id, v.number, v.service_date, v.service_date, v.amount, false);
    run('UPDATE service_vouchers SET bill_id = ? WHERE id = ?', [billId, v.id]);
  }
  const paid = round2(get('SELECT COALESCE(SUM(amount),0) s FROM supplier_bill_payments WHERE bill_id = ?', [billId]).s);
  if (amount - (v.amount - paid) > 0.004) return res.status(400).json({ error: `El pago es mayor que el saldo ($${round2(v.amount - paid).toLocaleString('en-US')}).` });
  const pid = run(`INSERT INTO supplier_bill_payments (bill_id, payment_date, amount, method, reference, notes, created_by) VALUES (?,?,?,?,?,?,?)`,
    [billId, String(b.paymentDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10), amount, b.method || null, b.reference || null, b.notes || null, req.user ? req.user.id : null]).lastInsertRowid;
  for (const f of req.files || []) {
    run('INSERT INTO payment_files (kind, payment_id, file_url, original_name) VALUES (?,?,?,?)', ['bill', pid, `/uploads/service-voucher-docs/${f.filename}`, f.originalname]);
  }
  refreshBill(billId);
  res.status(201).json(getFull(v.id));
});

router.delete('/:id/files/:fileId', (req, res) => {
  run('DELETE FROM service_voucher_files WHERE id = ? AND voucher_id = ?', [req.params.fileId, req.params.id]);
  res.json(getFull(req.params.id));
});

// Borrar el comprobante y su cuenta por pagar (con sus pagos). Solo administrador.
router.delete('/:id', (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede borrar un comprobante.' });
  const v = get('SELECT * FROM service_vouchers WHERE id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Comprobante no encontrado' });
  run('DELETE FROM service_vouchers WHERE id = ?', [v.id]);
  if (v.bill_id) run('DELETE FROM supplier_bills WHERE id = ?', [v.bill_id]);
  res.status(204).end();
});

module.exports = router;
