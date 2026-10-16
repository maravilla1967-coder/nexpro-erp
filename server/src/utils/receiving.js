const { db, all, get, run } = require('../../db');
const { nextDocNumber } = require('./numbering');

// Recepción de mercancía contra una orden de compra.
//   lines: [{ itemId, quantity, serials: ['ABC123', …] }]
// Suma al inventario solo lo recibido, actualiza lo recibido por línea, deja la orden en
// 'parcial' o 'recibida', y si el producto maneja seriales da de alta cada unidad.
// Todo en una transacción: o se graba completa o no se graba nada.
function receivePurchaseOrder(poId, { lines, receiptDate, notes, userId }) {
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
  if (!po) throw httpError(404, 'Orden de compra no encontrada');
  if (po.status === 'cancelado') throw httpError(400, 'La orden de compra está cancelada');
  const items = all(
    `SELECT i.*, p.track_serials, p.name AS product_name FROM purchase_order_items i
     LEFT JOIN products p ON p.id = i.product_id WHERE i.purchase_order_id = ?`,
    [poId]
  );
  const byId = new Map(items.map((i) => [i.id, i]));
  const clean = [];
  for (const l of lines || []) {
    const item = byId.get(Number(l.itemId));
    const qty = Number(l.quantity) || 0;
    if (!item || qty <= 0) continue;
    const pending = Number(item.quantity) - Number(item.received_qty || 0);
    if (qty - pending > 0.0001) throw httpError(400, `"${item.description}": se pidieron ${item.quantity}, ya se recibieron ${item.received_qty || 0}; no se pueden recibir ${qty} más.`);
    const serials = [...new Set((l.serials || []).map((s) => String(s).trim()).filter(Boolean))];
    if (item.track_serials) {
      if (serials.length !== qty) throw httpError(400, `"${item.description}" maneja números de serie: ingresa ${qty} serial(es) (uno por unidad); hay ${serials.length}.`);
      for (const sn of serials) {
        const dup = get('SELECT id FROM product_serials WHERE product_id = ? AND serial = ?', [item.product_id, sn]);
        if (dup) throw httpError(400, `El serial ${sn} ya existe para "${item.product_name || item.description}".`);
      }
    }
    clean.push({ item, qty, serials: item.track_serials ? serials : [] });
  }
  if (clean.length === 0) throw httpError(400, 'Indica la cantidad recibida de al menos una línea.');

  const date = receiptDate || new Date().toISOString().slice(0, 10);
  db.exec('BEGIN');
  try {
    const number = nextDocNumber('goods_receipts', 'GR');
    const rid = run('INSERT INTO goods_receipts (number, purchase_order_id, receipt_date, notes, created_by) VALUES (?,?,?,?,?)',
      [number, poId, date, notes || null, userId || null]).lastInsertRowid;
    for (const { item, qty, serials } of clean) {
      run('INSERT INTO goods_receipt_items (goods_receipt_id, purchase_order_item_id, product_id, description, quantity) VALUES (?,?,?,?,?)',
        [rid, item.id, item.product_id || null, item.description, qty]);
      run('UPDATE purchase_order_items SET received_qty = received_qty + ? WHERE id = ?', [qty, item.id]);
      if (item.product_id) run('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?', [qty, item.product_id]);
      for (const sn of serials) {
        const sid = run(
          `INSERT INTO product_serials (product_id, serial, status, purchase_order_id, goods_receipt_id, supplier_id, received_date, unit_cost, status_date)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [item.product_id, sn, 'disponible', poId, rid, po.supplier_id, date, item.unit_cost, date]
        ).lastInsertRowid;
        run('INSERT INTO serial_events (serial_id, event, reference, created_by) VALUES (?,?,?,?)',
          [sid, 'recibido', `${number} · OC ${po.number}`, userId || null]);
      }
    }
    refreshPoStatus(poId);
    db.exec('COMMIT');
    return get('SELECT * FROM goods_receipts WHERE id = ?', [rid]);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function refreshPoStatus(poId) {
  const rows = all('SELECT quantity, received_qty FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
  const any = rows.some((r) => Number(r.received_qty) > 0);
  const all_ = rows.length > 0 && rows.every((r) => Number(r.received_qty) >= Number(r.quantity) - 0.0001);
  const po = get('SELECT status FROM purchase_orders WHERE id = ?', [poId]);
  let status = po.status;
  if (all_) status = 'recibida';
  else if (any) status = 'parcial';
  if (status !== po.status) run('UPDATE purchase_orders SET status = ? WHERE id = ?', [status, poId]);
}

// Migración única: las órdenes que ya estaban "recibida" antes de existir la recepción por
// líneas quedan con todo lo pedido como recibido (su inventario ya se había sumado).
function backfillReceivedQty() {
  const done = get("SELECT value FROM app_settings WHERE key = 'po_received_qty_backfill_v1'");
  if (done) return;
  const r = run(`UPDATE purchase_order_items SET received_qty = quantity
                 WHERE received_qty = 0 AND purchase_order_id IN (SELECT id FROM purchase_orders WHERE status = 'recibida')`);
  run("INSERT INTO app_settings (key, value) VALUES ('po_received_qty_backfill_v1', ?)", [String(r.changes)]);
}

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

module.exports = { receivePurchaseOrder, refreshPoStatus, backfillReceivedQty };
