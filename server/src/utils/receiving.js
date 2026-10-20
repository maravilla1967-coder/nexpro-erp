const { db, all, get, run } = require('../../db');
const { nextDocNumber } = require('./numbering');

// Recepción de mercancía contra una orden de compra.
//   lines: [{ itemId, quantity, serials: ['ABC123', …] }]
// Suma al inventario solo lo recibido, actualiza lo recibido por línea, deja la orden en
// 'parcial' o 'recibida', y si el producto maneja seriales da de alta cada unidad.
// Todo en una transacción: o se graba completa o no se graba nada.
//   bill: { mode: 'credito' | 'pagada' | 'ninguna', billNumber, billDate, dueDate, amount, method, reference }
//     credito → crea la cuenta por pagar (pendiente) por lo recibido, con vencimiento según
//               los días de crédito del proveedor; pagada → la crea y registra el pago.
//   closeShort: { note } → lo que quede pendiente después de esta recepción ya no va a llegar
//               (faltante): la orden queda "cerrada" con el faltante anotado.
function receivePurchaseOrder(poId, { lines, receiptDate, notes, userId, bill, closeShort }) {
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
    const pending = Number(item.quantity) - Number(item.received_qty || 0) - Number(item.short_qty || 0);
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
  const supplier = get('SELECT * FROM suppliers WHERE id = ?', [po.supplier_id]) || {};
  const mode = (bill && bill.mode) || 'ninguna';
  const received$ = round2(clean.reduce((s, c) => s + c.qty * Number(c.item.unit_cost || 0), 0));
  let billAmount = bill && bill.amount !== undefined && bill.amount !== '' ? round2(String(bill.amount).replace(/[$,\s]/g, '')) : received$;
  if (mode !== 'ninguna' && !(billAmount > 0)) throw httpError(400, 'El monto de la cuenta por pagar debe ser mayor que cero.');

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
    // Cuenta por pagar enlazada a esta recepción (y a la orden).
    if (mode === 'credito' || mode === 'pagada') {
      const billDate = (bill && bill.billDate) || date;
      const termsDays = po.payment_terms_days != null ? po.payment_terms_days : supplier.payment_terms_days;
      const dueDate = (bill && bill.dueDate) || (mode === 'pagada' ? billDate : addDays(billDate, termsDays == null ? 30 : termsDays));
      const billId = run(
        `INSERT INTO supplier_bills (supplier_id, purchase_order_id, goods_receipt_id, bill_number, bill_date, due_date, amount, status, notes)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [po.supplier_id, poId, rid, (bill && bill.billNumber) || null, billDate, dueDate, billAmount, 'pendiente',
         `Recepción ${number} · OC ${po.number}`]
      ).lastInsertRowid;
      if (mode === 'pagada') {
        run(`INSERT INTO supplier_bill_payments (bill_id, payment_date, amount, method, reference, notes, created_by) VALUES (?,?,?,?,?,?,?)`,
          [billId, billDate, billAmount, (bill && bill.method) || null, (bill && bill.reference) || null, 'Pagada al recibir', userId || null]);
        run(`UPDATE supplier_bills SET status = 'pagada' WHERE id = ?`, [billId]);
      }
    }
    if (closeShort) applyCloseShort(poId, closeShort.note);
    refreshPoStatus(poId);
    db.exec('COMMIT');
    return get('SELECT * FROM goods_receipts WHERE id = ?', [rid]);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Marca como faltante (no va a llegar) todo lo que esté pendiente en la orden.
function applyCloseShort(poId, note) {
  run(`UPDATE purchase_order_items SET short_qty = MAX(0, quantity - received_qty) WHERE purchase_order_id = ?`, [poId]);
  const po = get('SELECT short_note FROM purchase_orders WHERE id = ?', [poId]);
  const stamp = `${new Date().toISOString().slice(0, 10)}: ${String(note || 'Faltante cerrado').trim()}`;
  run('UPDATE purchase_orders SET short_note = ? WHERE id = ?', [po && po.short_note ? `${po.short_note}\n${stamp}` : stamp, poId]);
}
function closeShort(poId, note) {
  const po = get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
  if (!po) throw httpError(404, 'Orden de compra no encontrada');
  const pend = get('SELECT COALESCE(SUM(MAX(0, quantity - received_qty - short_qty)),0) AS p FROM purchase_order_items WHERE purchase_order_id = ?', [poId]).p;
  if (!(pend > 0)) throw httpError(400, 'La orden no tiene nada pendiente por recibir.');
  if (!String(note || '').trim()) throw httpError(400, 'Escribe el motivo del faltante (ej. el proveedor no tiene la pieza).');
  applyCloseShort(poId, note);
  refreshPoStatus(poId);
}
// Reabrir el faltante: lo marcado como "no llegará" vuelve a quedar pendiente.
function reopenShort(poId) {
  run('UPDATE purchase_order_items SET short_qty = 0 WHERE purchase_order_id = ?', [poId]);
  refreshPoStatus(poId);
}

function refreshPoStatus(poId) {
  const rows = all('SELECT quantity, received_qty, short_qty FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
  const any = rows.some((r) => Number(r.received_qty) > 0);
  const all_ = rows.length > 0 && rows.every((r) => Number(r.received_qty) >= Number(r.quantity) - 0.0001);
  const done = rows.length > 0 && rows.every((r) => Number(r.received_qty) + Number(r.short_qty || 0) >= Number(r.quantity) - 0.0001);
  const po = get('SELECT status FROM purchase_orders WHERE id = ?', [poId]);
  let status = po.status;
  if (all_) status = 'recibida';
  else if (done) status = 'cerrada';
  else if (any) status = 'parcial';
  else if (['parcial', 'recibida', 'cerrada'].includes(status)) status = 'enviada';
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

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function addDays(dateStr, days) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
}

function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

module.exports = { receivePurchaseOrder, refreshPoStatus, backfillReceivedQty, closeShort, reopenShort };
