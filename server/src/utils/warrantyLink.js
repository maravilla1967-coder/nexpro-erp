const { get, run } = require('../../db');
const { nextDocNumber } = require('./numbering');

// Enlace orden de compra ↔ reclamo de garantía.
// Una orden de compra "por garantía" (purchase_orders.is_warranty = 1) queda amarrada a un
// reclamo (purchase_orders.warranty_id). Un reclamo puede tener varias órdenes (p. ej. piezas
// pedidas en dos órdenes); warranties.purchase_order_id guarda la orden principal.
// Ambos comparten el vehículo (VIN): lo que tenga uno se copia al otro si está vacío.
function linkPoWarranty(poId, warrantyId) {
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
  const w = get('SELECT * FROM warranties WHERE id = ?', [warrantyId]);
  if (!po || !w) return;
  run('UPDATE purchase_orders SET is_warranty = 1, payment_terms_days = NULL, warranty_id = ?, vehicle_id = COALESCE(vehicle_id, ?) WHERE id = ?',
    [w.id, w.vehicle_id || null, po.id]);
  const vehicleId = w.vehicle_id || po.vehicle_id || null;
  const v = vehicleId ? get('SELECT vin, customer_id FROM vehicles WHERE id = ?', [vehicleId]) : null;
  run(`UPDATE warranties SET purchase_order_id = COALESCE(purchase_order_id, ?), vehicle_id = COALESCE(vehicle_id, ?),
         vin = COALESCE(NULLIF(vin, ''), ?), customer_id = COALESCE(customer_id, ?), supplier_id = COALESCE(supplier_id, ?)
       WHERE id = ?`,
    [po.id, vehicleId, v ? v.vin : null, v ? v.customer_id : null, po.supplier_id, w.id]);
}

// Quita el enlace de una orden con su reclamo (la orden deja de ser "por garantía" solo si se pide).
function unlinkPo(poId, { clearFlag = false } = {}) {
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
  if (!po) return;
  if (po.warranty_id) {
    // Si el reclamo apuntaba a esta orden como principal, pasa a otra orden enlazada (o a ninguna).
    const other = get('SELECT id FROM purchase_orders WHERE warranty_id = ? AND id != ? ORDER BY id LIMIT 1', [po.warranty_id, po.id]);
    run('UPDATE warranties SET purchase_order_id = ? WHERE id = ? AND purchase_order_id = ?', [other ? other.id : null, po.warranty_id, po.id]);
  }
  run(`UPDATE purchase_orders SET warranty_id = NULL${clearFlag ? ', is_warranty = 0' : ''} WHERE id = ?`, [po.id]);
}

// Crea un reclamo de garantía nuevo a partir de una orden de compra por garantía.
function createClaimForPo(poId) {
  const po = get(`SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?`, [poId]);
  if (!po) return null;
  const items = require('../../db').all('SELECT description FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id', [po.id]);
  const v = po.vehicle_id ? get('SELECT * FROM vehicles WHERE id = ?', [po.vehicle_id]) : null;
  const number = nextDocNumber('warranties', 'WC');
  const id = run(
    `INSERT INTO warranties (number, kind, status, vehicle_id, purchase_order_id, supplier_id, customer_id, item_description,
                             vin, manufacturer, model, year, claim_date, problem_description)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [number, 'reclamo', 'abierta', po.vehicle_id || null, po.id, po.supplier_id, v ? v.customer_id : null,
     items.map((i) => i.description).filter(Boolean).join('; ') || null,
     v ? v.vin : null, po.supplier_name || null, v ? v.model : null, v ? v.year : null,
     new Date().toISOString().slice(0, 10), po.notes || null]
  ).lastInsertRowid;
  linkPoWarranty(po.id, id);
  return id;
}

module.exports = { linkPoWarranty, unlinkPo, createClaimForPo };
