const multer = require('multer');
const { get, run } = require('../../db');

// Control de cambios: los usuarios que no son administradores pueden crear documentos y hacer
// los movimientos normales del día a día (registrar, recibir, cobrar, pagar, cambiar el estado),
// pero NO pueden modificar ni borrar un documento ya existente. Esos cambios se guardan como una
// solicitud en "Aprobaciones" y solo se aplican cuando un administrador los autoriza.
//
// Pedidos (sales-orders) y facturas (invoices) ya tienen su propia lógica de aprobación, por eso
// este middleware no los toca.

const SKIP = [/^\/(sales-orders|invoices|approvals|users|auth)(\/|$)/];

// Ediciones (PUT/PATCH) que necesitan autorización: el documento en sí, no los datos maestros
// de contacto (clientes, proveedores, mecánicos, servicios), que los usuarios pueden actualizar.
const EDIT_RULES = [
  { re: /^\/purchase-orders\/(\d+)$/, entity: 'purchase_order', label: 'Orden de compra' },
  { re: /^\/work-orders\/(\d+)$/, entity: 'work_order', label: 'Orden de trabajo' },
  { re: /^\/warranties\/(\d+)$/, entity: 'warranty', label: 'Garantía' },
  { re: /^\/payables\/(\d+)$/, entity: 'payable', label: 'Cuenta por pagar' },
  { re: /^\/service-vouchers\/(\d+)$/, entity: 'service_voucher', label: 'Pago sin factura' },
  { re: /^\/vehicles\/(\d+)$/, entity: 'vehicle', label: 'Vehículo' },
  { re: /^\/products\/(\d+)$/, entity: 'product', label: 'Producto' },
  { re: /^\/bank\/transactions\/(\d+)$/, entity: 'bank_transaction', label: 'Movimiento bancario' },
  { re: /^\/bank\/loans\/(\d+)$/, entity: 'loan', label: 'Préstamo' },
  { re: /^\/bank\/accounts\/(\d+)$/, entity: 'bank_account', label: 'Cuenta bancaria' },
];

// Nombre legible para cualquier borrado (todos los borrados necesitan autorización).
const DELETE_LABELS = [
  [/^\/purchase-orders/, 'purchase_order', 'Orden de compra'], [/^\/work-orders/, 'work_order', 'Orden de trabajo'],
  [/^\/warranties/, 'warranty', 'Garantía'], [/^\/payables/, 'payable', 'Cuenta por pagar'],
  [/^\/service-vouchers/, 'service_voucher', 'Pago sin factura'], [/^\/vehicles/, 'vehicle', 'Vehículo'],
  [/^\/products/, 'product', 'Producto'], [/^\/bank\/transactions/, 'bank_transaction', 'Movimiento bancario'],
  [/^\/bank\/loans/, 'loan', 'Préstamo'], [/^\/bank\/accounts/, 'bank_account', 'Cuenta bancaria'],
  [/^\/customers/, 'customer', 'Cliente'], [/^\/suppliers/, 'supplier', 'Proveedor'], [/^\/services/, 'service', 'Servicio'],
  [/^\/mechanics/, 'mechanic', 'Mecánico'], [/^\/serials/, 'serial', 'Número de serie'],
];

// Cambiar solo el estado es un movimiento normal, salvo anular o cancelar (equivale a borrar).
const CANCEL_STATES = ['cancelado', 'cancelada', 'anulado', 'anulada'];
function isPlainStatusChange(body) {
  const keys = Object.keys(body || {});
  return keys.length > 0 && keys.every((k) => k === 'status') && !CANCEL_STATES.includes(String(body.status));
}

const parseMultipart = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }).any();

function docName(entity, id) {
  const q = {
    purchase_order: 'SELECT number AS n FROM purchase_orders WHERE id = ?', work_order: 'SELECT number AS n FROM work_orders WHERE id = ?',
    payable: 'SELECT bill_number AS n FROM supplier_bills WHERE id = ?', service_voucher: 'SELECT number AS n FROM service_vouchers WHERE id = ?',
    vehicle: 'SELECT vin AS n FROM vehicles WHERE id = ?', product: "SELECT COALESCE(sku, name) AS n FROM products WHERE id = ?",
    loan: 'SELECT number AS n FROM loans WHERE id = ?', bank_account: 'SELECT name AS n FROM bank_accounts WHERE id = ?',
    customer: 'SELECT name AS n FROM customers WHERE id = ?', supplier: 'SELECT name AS n FROM suppliers WHERE id = ?',
  }[entity];
  if (!q || !id) return id ? `#${id}` : '';
  try { const r = get(q, [id]); return r && r.n ? r.n : `#${id}`; } catch (_) { return `#${id}`; }
}

function changeControl(req, res, next) {
  if (!req.user || req.user.role === 'admin') return next();
  if (!['PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const path = req.path; // relativo a /api
  if (SKIP.some((re) => re.test(path))) return next();

  let entity; let label; let entityId; let action;
  if (req.method === 'DELETE') {
    const hit = DELETE_LABELS.find(([re]) => re.test(path));
    entity = hit ? hit[1] : 'otro'; label = hit ? hit[2] : 'Documento';
    const m = path.match(/^\/[a-z-]+(?:\/(?:transactions|loans|accounts))?\/(\d+)/);
    entityId = m ? Number(m[1]) : 0;
    action = 'delete';
  } else {
    const rule = EDIT_RULES.find((r) => r.re.test(path));
    if (!rule) return next();
    entity = rule.entity; label = rule.label; entityId = Number(path.match(rule.re)[1]); action = 'update';
  }

  const queue = () => {
    const body = { ...(req.body || {}) };
    if (action === 'update' && isPlainStatusChange(body)) return next();
    const droppedFiles = (req.files || []).length;
    const isSub = action === 'delete' && !/^\/[a-z-]+(?:\/(?:transactions|loans|accounts))?\/\d+$/.test(path);
    const what = isSub ? 'Borrar un elemento de' : action === 'delete' ? 'Eliminar' : 'Cambios en';
    const summary = `${what} ${label.toLowerCase()} ${docName(entity, entityId)}`.trim() + (droppedFiles ? ' (los archivos adjuntos se deben volver a subir después)' : '');
    const result = run(
      `INSERT INTO approval_requests (entity_type, entity_id, action, payload, summary, requested_by) VALUES (?,?,?,?,?,?)`,
      [entity, entityId, action, JSON.stringify({ replay: { method: req.method, url: req.originalUrl, body } }), summary, req.user.id]
    );
    res.status(202).json({
      pending: true, approvalRequired: true, approvalId: result.lastInsertRowid,
      message: action === 'delete'
        ? 'No tienes permiso para borrar: la solicitud se envió al administrador para que la autorice.'
        : 'No tienes permiso para modificar este documento: los cambios se enviaron al administrador para que los autorice.',
    });
  };

  if (req.is('multipart/form-data')) return parseMultipart(req, res, (err) => (err ? res.status(400).json({ error: err.message }) : queue()));
  return queue();
}

module.exports = { changeControl };
