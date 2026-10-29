const express = require('express');
const { db, all, get, run } = require('../../db');
const { makeDocUploader } = require('../middleware/upload');
const { nextDocNumber } = require('../utils/numbering');
const { setPaymentBank } = require('../utils/bank');

// Finanzas / Bancos: cuentas con saldo y su registro de movimientos (como Microsoft Money).
// El registro junta tres fuentes:
//   - cobros de facturas (invoice_payments con bank_account_id)       → ingresos
//   - pagos a proveedores y pagos sin factura (supplier_bill_payments) → egresos
//   - movimientos propios del banco (bank_transactions): préstamos y abonos, nómina,
//     transferencias, comisiones, impuestos, aportes y otros.
// Así cada movimiento queda amarrado a su documento, y si se corrige el pago en la factura
// el banco se actualiza solo.
const router = express.Router();
const upload = makeDocUploader('bank-docs');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (v) => round2(parseFloat(String(v ?? '').replace(/[$,\s]/g, '')));

// Lista mínima de cuentas para los formularios de pago (cualquier usuario que registra pagos).
router.get('/accounts/options', (req, res) => {
  res.json(all(`SELECT id, name, bank_name, account_type, substr(COALESCE(account_number,''), -4) AS last4, is_default
                FROM bank_accounts WHERE active = 1 ORDER BY is_default DESC, name`));
});

// El resto del módulo: solo administrador o quien tenga permiso de "Bancos y finanzas"
// (también para ver, porque son saldos de la empresa).
router.use((req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role === 'admin' || req.user.permissions.finanzas) return next();
  return res.status(403).json({ error: 'No tienes acceso a Bancos y finanzas. Pídeselo al administrador.' });
});

const IN_CATEGORIES = ['cobro_factura', 'prestamo_socio', 'prestamo_tercero', 'aporte_capital', 'intereses_ganados', 'reembolso', 'transferencia_entrada', 'otro_ingreso'];
const OUT_CATEGORIES = ['pago_proveedor', 'pago_sin_factura', 'nomina', 'abono_prestamo', 'intereses_prestamo', 'comision_bancaria', 'impuestos', 'gasto_general', 'retiro_socio', 'transferencia_salida', 'otro_egreso'];

// Movimientos de una cuenta (o de todas si accountId es null), ya normalizados.
function movements(accountId, { from, to } = {}) {
  const acc = accountId ? 'AND p.bank_account_id = ?' : 'AND p.bank_account_id IS NOT NULL';
  const accT = accountId ? 'AND t.account_id = ?' : '';
  const params = (n) => (accountId ? [accountId] : []).concat(n || []);
  const inv = all(`
    SELECT 'invoice' AS kind, p.id, p.bank_account_id AS account_id, p.payment_date AS date, 'in' AS direction, 'cobro_factura' AS category,
           ROUND(p.amount + COALESCE(p.surcharge,0) - COALESCE(p.processor_fee,0), 2) AS amount,
           c.name AS payee, p.method, p.reference, p.notes AS description, p.bank_cleared AS cleared,
           i.id AS doc_id, i.number AS doc_number, p.amount AS doc_amount, p.surcharge, p.processor_fee
    FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN customers c ON c.id = i.customer_id
    WHERE 1=1 ${acc}`, params());
  const bills = all(`
    SELECT 'bill' AS kind, p.id, p.bank_account_id AS account_id, p.payment_date AS date, 'out' AS direction,
           CASE WHEN sv.id IS NOT NULL THEN 'pago_sin_factura' ELSE 'pago_proveedor' END AS category,
           p.amount, s.name AS payee, p.method, p.reference, COALESCE(p.notes, b.notes) AS description, p.bank_cleared AS cleared,
           b.id AS bill_id, b.bill_number, po.number AS po_number, po.id AS po_id, sv.id AS voucher_id, sv.number AS voucher_number
    FROM supplier_bill_payments p JOIN supplier_bills b ON b.id = p.bill_id LEFT JOIN suppliers s ON s.id = b.supplier_id
    LEFT JOIN purchase_orders po ON po.id = b.purchase_order_id LEFT JOIN service_vouchers sv ON sv.bill_id = b.id
    WHERE 1=1 ${acc}`, params());
  const own = all(`
    SELECT 'manual' AS kind, t.id, t.account_id, t.tx_date AS date, t.direction, t.category, t.amount, t.payee, NULL AS method,
           t.reference, t.description, t.cleared, t.period, t.loan_id, l.number AS loan_number, t.transfer_group,
           (SELECT COUNT(*) FROM bank_transaction_files f WHERE f.transaction_id = t.id) AS files_count
    FROM bank_transactions t LEFT JOIN loans l ON l.id = t.loan_id WHERE 1=1 ${accT}`, params());
  let rows = [...inv, ...bills, ...own].map((r) => {
    let doc = null;
    if (r.kind === 'invoice') doc = { type: 'Factura', number: r.doc_number, link: `/facturas/${r.doc_id}` };
    if (r.kind === 'bill') {
      if (r.voucher_id) doc = { type: 'Pago sin factura', number: r.voucher_number, link: `/pagos-sin-factura/${r.voucher_id}/documento` };
      else doc = { type: r.po_number ? 'Factura proveedor · OC' : 'Factura proveedor', number: [r.bill_number, r.po_number && `OC ${r.po_number}`].filter(Boolean).join(' · ') || `#${r.bill_id}`, link: `/cuentas-por-pagar?ver=${r.bill_id}` };
    }
    if (r.kind === 'manual' && r.loan_id) doc = { type: 'Préstamo', number: r.loan_number, link: `/finanzas/prestamos?ver=${r.loan_id}` };
    return { ...r, date: String(r.date || '').slice(0, 10), amount: round2(r.amount), signed: round2(r.direction === 'in' ? r.amount : -r.amount), doc, cleared: !!r.cleared };
  });
  if (from) rows = rows.filter((r) => r.date >= from);
  if (to) rows = rows.filter((r) => r.date <= to);
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.direction === b.direction ? 0 : a.direction === 'in' ? -1 : 1)));
  return rows;
}

function accountWithBalance(a) {
  const rows = movements(a.id);
  const sum = round2(rows.reduce((s, r) => s + r.signed, 0));
  const cleared = round2(rows.filter((r) => r.cleared).reduce((s, r) => s + r.signed, 0));
  const masked = a.account_number ? `••••${String(a.account_number).slice(-4)}` : '';
  return { ...a, balance: round2(a.opening_balance + sum), cleared_balance: round2(a.opening_balance + cleared), movements: rows.length,
    pending_clear: rows.filter((r) => !r.cleared).length, account_masked: masked,
    last_date: rows.length ? rows[rows.length - 1].date : null };
}

router.get('/categories', (req, res) => res.json({ in: IN_CATEGORIES, out: OUT_CATEGORIES }));

router.get('/accounts', (req, res) => {
  const list = all('SELECT * FROM bank_accounts ORDER BY active DESC, is_default DESC, name').map(accountWithBalance);
  res.json(list);
});

function accFields(b) {
  return {
    name: String(b.name || '').trim(), bank_name: b.bankName || null, account_type: b.accountType || 'corriente',
    account_number: b.accountNumber ? String(b.accountNumber).trim() : null, routing_number: b.routingNumber || null,
    currency: b.currency || 'USD', opening_balance: money(b.openingBalance) || 0, opening_date: b.openingDate || null, notes: b.notes || null,
  };
}
router.post('/accounts', (req, res) => {
  const f = accFields(req.body || {});
  if (!f.name) return res.status(400).json({ error: 'Ponle un nombre a la cuenta (ej. Chase Operativa).' });
  const first = !get('SELECT id FROM bank_accounts LIMIT 1');
  const cols = Object.keys(f);
  const id = run(`INSERT INTO bank_accounts (${cols.join(',')}, is_default) VALUES (${cols.map(() => '?').join(',')}, ?)`, [...cols.map((c) => f[c]), first || req.body.isDefault ? 1 : 0]).lastInsertRowid;
  if (req.body.isDefault) run('UPDATE bank_accounts SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END', [id]);
  res.status(201).json(accountWithBalance(get('SELECT * FROM bank_accounts WHERE id = ?', [id])));
});
router.put('/accounts/:id', (req, res) => {
  const a = get('SELECT * FROM bank_accounts WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Cuenta no encontrada' });
  const b = req.body || {};
  const f = accFields({ name: a.name, bankName: a.bank_name, accountType: a.account_type, accountNumber: a.account_number, routingNumber: a.routing_number,
    currency: a.currency, openingBalance: a.opening_balance, openingDate: a.opening_date, notes: a.notes, ...b });
  if (!f.name) return res.status(400).json({ error: 'La cuenta necesita un nombre.' });
  run(`UPDATE bank_accounts SET name=?, bank_name=?, account_type=?, account_number=?, routing_number=?, currency=?, opening_balance=?, opening_date=?, notes=?, active=? WHERE id=?`,
    [f.name, f.bank_name, f.account_type, f.account_number, f.routing_number, f.currency, f.opening_balance, f.opening_date, f.notes,
     b.active === undefined ? a.active : (b.active === false || b.active === 'false' || b.active === 0 ? 0 : 1), a.id]);
  if (b.isDefault) run('UPDATE bank_accounts SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END', [a.id]);
  res.json(accountWithBalance(get('SELECT * FROM bank_accounts WHERE id = ?', [a.id])));
});
// Borrar una cuenta. Si tiene movimientos, se pueden pasar todos a otra cuenta (?moveTo=<id>) antes de borrarla.
router.delete('/accounts/:id', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede borrar una cuenta.' });
  const a = get('SELECT * FROM bank_accounts WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Cuenta no encontrada' });
  const count = movements(a.id).length;
  const moveTo = req.query.moveTo ? Number(req.query.moveTo) : null;
  if (count && !moveTo) return res.status(400).json({ error: `La cuenta tiene ${count} movimiento(s): elige a qué cuenta pasarlos antes de borrarla.`, movements: count });
  let target = null;
  if (moveTo) {
    target = get('SELECT * FROM bank_accounts WHERE id = ?', [moveTo]);
    if (!target || target.id === a.id) return res.status(400).json({ error: 'Elige otra cuenta para pasar los movimientos.' });
    const selfTransfer = get(`SELECT t1.transfer_group FROM bank_transactions t1 JOIN bank_transactions t2 ON t2.transfer_group = t1.transfer_group AND t2.id <> t1.id
      WHERE t1.account_id = ? AND t2.account_id = ? AND t1.transfer_group IS NOT NULL LIMIT 1`, [a.id, target.id]);
    if (selfTransfer) return res.status(400).json({ error: `Hay transferencias entre "${a.name}" y "${target.name}": bórralas primero o elige otra cuenta.` });
  }
  db.exec('BEGIN');
  try {
    if (target) {
      run('UPDATE bank_transactions SET account_id = ? WHERE account_id = ?', [target.id, a.id]);
      run('UPDATE invoice_payments SET bank_account_id = ? WHERE bank_account_id = ?', [target.id, a.id]);
      run('UPDATE supplier_bill_payments SET bank_account_id = ? WHERE bank_account_id = ?', [target.id, a.id]);
    }
    run('DELETE FROM bank_accounts WHERE id = ?', [a.id]);
    if (a.is_default) {
      const next = target || get('SELECT id FROM bank_accounts WHERE active = 1 ORDER BY id LIMIT 1');
      if (next) run('UPDATE bank_accounts SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END', [next.id]);
    }
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); return res.status(500).json({ error: err.message }); }
  res.json({ ok: true, moved: target ? count : 0, movedTo: target ? target.name : null });
});

// Registro de una cuenta con saldo corrido (como la chequera / Money).
router.get('/accounts/:id/register', (req, res) => {
  const a = get('SELECT * FROM bank_accounts WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Cuenta no encontrada' });
  const all_ = movements(a.id);
  const { from, to } = req.query;
  let running = a.opening_balance;
  const withBal = all_.map((r) => { running = round2(running + r.signed); return { ...r, balance: running }; });
  const start = from ? round2(a.opening_balance + all_.filter((r) => r.date < from).reduce((s, r) => s + r.signed, 0)) : a.opening_balance;
  const rows = withBal.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
  res.json({ account: accountWithBalance(a), startBalance: start, rows: rows.reverse() });
});

// Conciliar (marcar como visto en el extracto del banco).
router.post('/cleared', (req, res) => {
  const { kind, id, cleared } = req.body || {};
  const v = cleared ? 1 : 0;
  if (kind === 'invoice') run('UPDATE invoice_payments SET bank_cleared = ? WHERE id = ?', [v, id]);
  else if (kind === 'bill') run('UPDATE supplier_bill_payments SET bank_cleared = ? WHERE id = ?', [v, id]);
  else if (kind === 'manual') run('UPDATE bank_transactions SET cleared = ? WHERE id = ?', [v, id]);
  else return res.status(400).json({ error: 'Movimiento inválido' });
  res.json({ ok: true });
});

// Cobros y pagos ya registrados que todavía no tienen cuenta bancaria (para asignarlos).
router.get('/unassigned', (req, res) => {
  const inv = all(`SELECT 'invoice' AS kind, p.id, p.payment_date AS date, ROUND(p.amount + COALESCE(p.surcharge,0) - COALESCE(p.processor_fee,0),2) AS amount,
                          'in' AS direction, c.name AS payee, i.number AS doc_number, i.id AS doc_id, p.method
                   FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id LEFT JOIN customers c ON c.id = i.customer_id
                   WHERE p.bank_account_id IS NULL ORDER BY p.payment_date DESC`);
  const bills = all(`SELECT 'bill' AS kind, p.id, p.payment_date AS date, p.amount, 'out' AS direction, s.name AS payee,
                            COALESCE(sv.number, b.bill_number, po.number, '#' || b.id) AS doc_number, b.id AS doc_id, sv.id AS voucher_id, p.method
                     FROM supplier_bill_payments p JOIN supplier_bills b ON b.id = p.bill_id LEFT JOIN suppliers s ON s.id = b.supplier_id
                     LEFT JOIN purchase_orders po ON po.id = b.purchase_order_id LEFT JOIN service_vouchers sv ON sv.bill_id = b.id
                     WHERE p.bank_account_id IS NULL ORDER BY p.payment_date DESC`);
  res.json([...inv, ...bills].sort((a, b) => (a.date < b.date ? 1 : -1)));
});
router.post('/assign', (req, res) => {
  const { kind, id, accountId } = req.body || {};
  if (!['invoice', 'bill'].includes(kind)) return res.status(400).json({ error: 'Movimiento inválido' });
  setPaymentBank(kind, id, accountId || null);
  res.json({ ok: true });
});

// ---- Movimientos propios del banco ----
// Préstamos, desembolsos y abonos: solo un administrador los puede modificar o borrar.
function adminOnly(req, res) {
  if (req.user && req.user.role === 'admin') return false;
  res.status(403).json({ error: 'Solo el administrador puede modificar préstamos, desembolsos y abonos.' });
  return true;
}
// Cuenta "sin banco" para lo que un socio paga directamente por Nexpro: el préstamo del socio
// entra ahí y el pago sale de ahí el mismo día, así que su saldo siempre queda en cero y no
// afecta ningún banco real.
const DIRECT_NAME = 'Pagos directos de socios (sin banco)';
function directAccount() {
  let a = get('SELECT * FROM bank_accounts WHERE is_direct = 1 ORDER BY id LIMIT 1');
  if (!a) {
    const id = run('INSERT INTO bank_accounts (name, account_type, notes, is_direct) VALUES (?,?,?,1)',
      [DIRECT_NAME, 'otra', 'Pagos que un socio hizo directamente por Nexpro: no pasan por ningún banco.']).lastInsertRowid;
    a = get('SELECT * FROM bank_accounts WHERE id = ?', [id]);
  }
  return a;
}
router.get('/direct-account', (req, res) => res.json(accountWithBalance(directAccount())));

function txFields(b) {
  const direction = b.direction === 'in' ? 'in' : 'out';
  const category = String(b.category || (direction === 'in' ? 'otro_ingreso' : 'otro_egreso'));
  return { direction, category, amount: money(b.amount), tx_date: String(b.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    payee: b.payee || null, description: b.description || null, reference: b.reference || null, period: b.period || null };
}
function insertTx(accountId, f, extra = {}, userId) {
  return run(`INSERT INTO bank_transactions (account_id, tx_date, direction, category, amount, payee, description, reference, period, loan_id, transfer_group, created_by)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [accountId, f.tx_date, f.direction, f.category, f.amount, f.payee, f.description, f.reference, f.period, extra.loanId || null, extra.transferGroup || null, userId || null]).lastInsertRowid;
}
function saveTxFiles(txId, files) {
  for (const f of files || []) run('INSERT INTO bank_transaction_files (transaction_id, file_url, original_name) VALUES (?,?,?)', [txId, `/uploads/bank-docs/${f.filename}`, f.originalname]);
}

router.post('/transactions', upload.array('files', 10), (req, res) => {
  const b = req.body || {};
  const acc = get('SELECT id FROM bank_accounts WHERE id = ?', [b.accountId]);
  if (!acc) return res.status(400).json({ error: 'Elige la cuenta bancaria.' });
  const f = txFields(b);
  if (!(f.amount > 0)) return res.status(400).json({ error: 'El monto debe ser mayor que cero.' });
  const id = insertTx(acc.id, f, {}, req.user.id);
  saveTxFiles(id, req.files);
  res.status(201).json({ id });
});

// Nómina: varios empleados en un solo registro (un egreso por persona, mismo periodo).
router.post('/payroll', (req, res) => {
  const b = req.body || {};
  const acc = get('SELECT id FROM bank_accounts WHERE id = ?', [b.accountId]);
  if (!acc) return res.status(400).json({ error: 'Elige la cuenta bancaria.' });
  const lines = (b.lines || []).map((l) => ({ payee: String(l.payee || '').trim(), amount: money(l.amount), reference: l.reference || null })).filter((l) => l.payee && l.amount > 0);
  if (!lines.length) return res.status(400).json({ error: 'Agrega al menos una persona con su monto.' });
  db.exec('BEGIN');
  try {
    for (const l of lines) insertTx(acc.id, { ...txFields({ ...b, direction: 'out', category: 'nomina' }), payee: l.payee, amount: l.amount, reference: l.reference || b.reference || null }, {}, req.user.id);
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  res.status(201).json({ created: lines.length, total: round2(lines.reduce((s, l) => s + l.amount, 0)) });
});

router.get('/transactions/:id', (req, res) => {
  const t = get('SELECT * FROM bank_transactions WHERE id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Movimiento no encontrado' });
  t.files = all('SELECT * FROM bank_transaction_files WHERE transaction_id = ? ORDER BY id', [t.id]);
  res.json(t);
});
router.put('/transactions/:id', upload.array('files', 10), (req, res) => {
  const t = get('SELECT * FROM bank_transactions WHERE id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Movimiento no encontrado' });
  if (t.loan_id && adminOnly(req, res)) return;
  const b = req.body || {};
  if (b.accountId && !get('SELECT id FROM bank_accounts WHERE id = ?', [b.accountId])) return res.status(400).json({ error: 'Cuenta no encontrada.' });
  const f = txFields({ direction: t.direction, category: t.category, amount: t.amount, date: t.tx_date, payee: t.payee, description: t.description, reference: t.reference, period: t.period, ...b });
  if (!(f.amount > 0)) return res.status(400).json({ error: 'El monto debe ser mayor que cero.' });
  if (t.transfer_group) f.direction = t.direction; // una transferencia no cambia de sentido
  run(`UPDATE bank_transactions SET account_id=?, tx_date=?, direction=?, category=?, amount=?, payee=?, description=?, reference=?, period=? WHERE id=?`,
    [b.accountId || t.account_id, f.tx_date, f.direction, f.category, f.amount, f.payee, f.description, f.reference, f.period, t.id]);
  if (t.transfer_group) run('UPDATE bank_transactions SET amount = ?, tx_date = ? WHERE transfer_group = ? AND id != ?', [f.amount, f.tx_date, t.transfer_group, t.id]);
  // El desembolso es el préstamo mismo: su fecha y monto son los del préstamo.
  if (t.loan_id && t.direction === 'in') run('UPDATE loans SET loan_date = ?, principal = ? WHERE id = ?', [f.tx_date, f.amount, t.loan_id]);
  saveTxFiles(t.id, req.files);
  res.json({ ok: true });
});
router.delete('/transactions/:id/files/:fid', (req, res) => {
  run('DELETE FROM bank_transaction_files WHERE id = ? AND transaction_id = ?', [req.params.fid, req.params.id]);
  res.json({ ok: true });
});
router.delete('/transactions/:id', (req, res) => {
  const t = get('SELECT * FROM bank_transactions WHERE id = ?', [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Movimiento no encontrado' });
  if (t.loan_id && adminOnly(req, res)) return;
  if (t.loan_id && ['prestamo_socio', 'prestamo_tercero'].includes(t.category)) return res.status(400).json({ error: 'Este es el desembolso del préstamo: bórralo desde Préstamos.' });
  if (t.transfer_group) run('DELETE FROM bank_transactions WHERE transfer_group = ?', [t.transfer_group]);
  else run('DELETE FROM bank_transactions WHERE id = ?', [t.id]);
  res.status(204).end();
});

// Transferencia entre cuentas propias: un egreso y un ingreso enlazados.
router.post('/transfers', (req, res) => {
  const b = req.body || {};
  const from = get('SELECT * FROM bank_accounts WHERE id = ?', [b.fromAccountId]);
  const to = get('SELECT * FROM bank_accounts WHERE id = ?', [b.toAccountId]);
  if (!from || !to || from.id === to.id) return res.status(400).json({ error: 'Elige dos cuentas distintas.' });
  const amount = money(b.amount);
  if (!(amount > 0)) return res.status(400).json({ error: 'El monto debe ser mayor que cero.' });
  const group = `TR-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const date = String(b.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  db.exec('BEGIN');
  try {
    insertTx(from.id, { direction: 'out', category: 'transferencia_salida', amount, tx_date: date, payee: to.name, description: b.description || `Transferencia a ${to.name}`, reference: b.reference || null, period: null }, { transferGroup: group }, req.user.id);
    insertTx(to.id, { direction: 'in', category: 'transferencia_entrada', amount, tx_date: date, payee: from.name, description: b.description || `Transferencia desde ${from.name}`, reference: b.reference || null, period: null }, { transferGroup: group }, req.user.id);
    db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); throw err; }
  res.status(201).json({ ok: true });
});

// ---- Préstamos de socios y terceros ----
// Interés simple por días sobre el saldo de capital: cada tramo entre abonos a capital genera
// saldo × tasa anual × días / base (365 o 360). Intereses pendientes = causados − pagados.
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
function interestAccrued(l, txs, asOf) {
  const rate = Number(l.interest_rate) || 0;
  const basis = Number(l.day_basis) || 365;
  // Los intereses corren desde que entró el dinero: la fecha del préstamo o la del desembolso
  // en el banco si es anterior (p. ej. un préstamo antiguo registrado hoy con su fecha real).
  const inDates = txs.filter((t) => t.direction === 'in').map((t) => String(t.tx_date).slice(0, 10));
  const start = [String(l.loan_date || '').slice(0, 10), ...inDates].filter(Boolean).sort()[0] || '';
  // Solo se acepta una fecha AAAA-MM-DD como corte; cualquier otro valor usa hoy.
  const until = /^\d{4}-\d{2}-\d{2}/.test(String(asOf || '')) ? String(asOf).slice(0, 10) : new Date().toISOString().slice(0, 10);
  if (!rate || !start || until <= start) return { accrued: 0, days: Math.max(0, dayDiff(start || until, until)), segments: [] };
  const caps = txs.filter((t) => t.category === 'abono_prestamo' && String(t.tx_date).slice(0, 10) <= until)
    .map((t) => ({ date: String(t.tx_date).slice(0, 10) < start ? start : String(t.tx_date).slice(0, 10), amount: t.amount })).sort((a, b) => (a.date < b.date ? -1 : 1));
  let bal = Number(l.principal) || 0; let from = start; let total = 0; const segments = [];
  const close = (to) => {
    const d = dayDiff(from, to);
    if (d > 0 && bal > 0) { const i = bal * (rate / 100) * d / basis; total += i; segments.push({ from, to, days: d, balance: round2(bal), interest: round2(i) }); }
    from = to;
  };
  for (const c of caps) { close(c.date); bal = Math.max(0, bal - c.amount); }
  close(until);
  return { accrued: round2(total), days: dayDiff(start, until), segments };
}
function loanFull(l, asOf) {
  const txs = all(`SELECT t.*, a.name AS account_name FROM bank_transactions t LEFT JOIN bank_accounts a ON a.id = t.account_id WHERE t.loan_id = ? ORDER BY t.tx_date, t.id`, [l.id]);
  const received = round2(txs.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0));
  const repaid = round2(txs.filter((t) => t.direction === 'out' && t.category === 'abono_prestamo').reduce((s, t) => s + t.amount, 0));
  const interest = round2(txs.filter((t) => t.direction === 'out' && t.category === 'intereses_prestamo').reduce((s, t) => s + t.amount, 0));
  const acc = interestAccrued(l, txs, asOf);
  const lastInt = txs.filter((t) => t.category === 'intereses_prestamo').map((t) => String(t.tx_date).slice(0, 10)).sort().pop() || null;
  const startDate = [String(l.loan_date || '').slice(0, 10), ...txs.filter((t) => t.direction === 'in').map((t) => String(t.tx_date).slice(0, 10))].filter(Boolean).sort()[0] || l.loan_date;
  return { ...l, interest_start: startDate, transactions: txs, received, repaid, interest_paid: interest, balance: round2(l.principal - repaid), status: l.principal - repaid <= 0.004 ? 'pagado' : 'vigente',
    interest_accrued: acc.accrued, interest_due: round2(Math.max(0, acc.accrued - interest)), interest_days: acc.days, interest_segments: acc.segments,
    interest_as_of: /^\d{4}-\d{2}-\d{2}/.test(String(asOf || '')) ? String(asOf).slice(0, 10) : new Date().toISOString().slice(0, 10), last_interest_date: lastInt,
    daily_interest: round2((l.principal - repaid) * ((Number(l.interest_rate) || 0) / 100) / (Number(l.day_basis) || 365)) };
}
router.get('/loans', (req, res) => res.json(all('SELECT * FROM loans ORDER BY loan_date DESC, id DESC').map((l) => loanFull(l, req.query.asOf))));
router.get('/loans/:id', (req, res) => {
  const l = get('SELECT * FROM loans WHERE id = ?', [req.params.id]);
  if (!l) return res.status(404).json({ error: 'Préstamo no encontrado' });
  res.json(loanFull(l, req.query.asOf));
});
router.post('/loans', upload.array('files', 10), (req, res) => {
  const b = req.body || {};
  const lender = String(b.lenderName || '').trim();
  const principal = money(b.principal);
  if (!lender) return res.status(400).json({ error: 'Escribe quién prestó el dinero.' });
  if (!(principal > 0)) return res.status(400).json({ error: 'El monto del préstamo debe ser mayor que cero.' });
  const acc = get('SELECT id FROM bank_accounts WHERE id = ?', [b.accountId]);
  if (!acc) return res.status(400).json({ error: 'Elige la cuenta donde entró el dinero.' });
  const type = ['socio', 'tercero', 'banco'].includes(b.lenderType) ? b.lenderType : 'socio';
  const date = String(b.loanDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  db.exec('BEGIN');
  try {
    const number = nextDocNumber('loans', 'PR');
    const id = run('INSERT INTO loans (number, lender_name, lender_type, principal, loan_date, interest_rate, due_date, notes, created_by, day_basis) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [number, lender, type, principal, date, b.interestRate ? parseFloat(b.interestRate) : null, b.dueDate || null, b.notes || null, req.user.id, String(b.dayBasis) === '360' ? 360 : 365]).lastInsertRowid;
    const txId = insertTx(acc.id, { direction: 'in', category: type === 'socio' ? 'prestamo_socio' : 'prestamo_tercero', amount: principal, tx_date: date, payee: lender,
      description: `Préstamo ${number}${b.notes ? ` — ${b.notes}` : ''}`, reference: b.reference || null, period: null }, { loanId: id }, req.user.id);
    saveTxFiles(txId, req.files);
    db.exec('COMMIT');
    res.status(201).json(loanFull(get('SELECT * FROM loans WHERE id = ?', [id])));
  } catch (err) { db.exec('ROLLBACK'); res.status(500).json({ error: err.message }); }
});
router.put('/loans/:id', (req, res) => {
  if (adminOnly(req, res)) return;
  const l = get('SELECT * FROM loans WHERE id = ?', [req.params.id]);
  if (!l) return res.status(404).json({ error: 'Préstamo no encontrado' });
  const b = req.body || {};
  // Si cambia quién prestó o su tipo, el desembolso en el banco cambia con él.
  const newType = ['socio', 'tercero', 'banco'].includes(b.lenderType) ? b.lenderType : l.lender_type;
  const newName = String(b.lenderName || l.lender_name).trim();
  run(`UPDATE bank_transactions SET category = ?, payee = ? WHERE loan_id = ? AND direction = 'in'`, [newType === 'socio' ? 'prestamo_socio' : 'prestamo_tercero', newName, l.id]);
  run(`UPDATE bank_transactions SET payee = ? WHERE loan_id = ? AND direction = 'out'`, [newName, l.id]);
  run('UPDATE loans SET lender_name=?, lender_type=?, interest_rate=?, due_date=?, notes=?, day_basis=?, loan_date=? WHERE id=?',
    [newName, newType, b.interestRate !== undefined && b.interestRate !== '' ? parseFloat(b.interestRate) : l.interest_rate, b.dueDate ?? l.due_date, b.notes ?? l.notes,
     b.dayBasis !== undefined ? (String(b.dayBasis) === '360' ? 360 : 365) : l.day_basis, b.loanDate || l.loan_date, l.id]);
  res.json(loanFull(get('SELECT * FROM loans WHERE id = ?', [l.id])));
});
// Abono al préstamo (capital y, si hay, intereses aparte).
router.post('/loans/:id/payments', upload.array('files', 10), (req, res) => {
  const l = get('SELECT * FROM loans WHERE id = ?', [req.params.id]);
  if (!l) return res.status(404).json({ error: 'Préstamo no encontrado' });
  const b = req.body || {};
  // Pago hecho directamente por un socio: no sale de ningún banco de Nexpro; se registra un
  // préstamo nuevo de ese socio por el mismo monto y el abono, ambos en la cuenta sin banco.
  const partner = String(b.paidByPartner || '').trim();
  const acc = partner ? directAccount() : get('SELECT id FROM bank_accounts WHERE id = ?', [b.accountId]);
  if (!acc) return res.status(400).json({ error: 'Elige la cuenta de donde sale el pago.' });
  const date = String(b.date || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const full = loanFull(l, date);
  let capital = money(b.amount) || 0; let interest = money(b.interest) || 0;
  // Pago total: se aplica primero a los intereses pendientes a la fecha del pago y el resto a capital.
  const total = money(b.total) || 0;
  if (total > 0) {
    interest = round2(Math.min(total, full.interest_due));
    capital = round2(total - interest);
  }
  if (!(capital > 0 || interest > 0)) return res.status(400).json({ error: 'Escribe el monto pagado.' });
  const fmtUsd = (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (capital - full.balance > 0.004) {
    const owed = round2(full.balance + Math.max(0, full.interest_due - interest));
    return res.status(400).json({ error: total > 0
      ? `El pago es mayor que lo adeudado al ${date}: capital ${fmtUsd(full.balance)} + intereses ${fmtUsd(full.interest_due)} = ${fmtUsd(round2(full.balance + full.interest_due))}.`
      : `El abono a capital es mayor que el saldo (${fmtUsd(full.balance)}). Si el pago incluye intereses pendientes (${fmtUsd(full.interest_due)}), usa "Monto total pagado" para que se apliquen primero a intereses. Total adeudado: ${fmtUsd(owed)}.` });
  }
  let first = null;
  db.exec('BEGIN');
  try {
  if (partner) {
    const number = nextDocNumber('loans', 'PR');
    const pid = run('INSERT INTO loans (number, lender_name, lender_type, principal, loan_date, interest_rate, notes, created_by, day_basis) VALUES (?,?,?,?,?,?,?,?,?)',
      [number, partner, 'socio', round2(capital + interest), date, b.partnerRate ? parseFloat(b.partnerRate) : null,
       `Pagó directamente a ${l.lender_name} (${l.number})`, req.user.id, 365]).lastInsertRowid;
    insertTx(acc.id, { direction: 'in', category: 'prestamo_socio', amount: round2(capital + interest), tx_date: date, payee: partner,
      description: `Préstamo ${number} — pagó directamente a ${l.lender_name} (${l.number})`, reference: b.reference || null, period: null }, { loanId: pid }, req.user.id);
  }
  if (capital > 0) first = insertTx(acc.id, { direction: 'out', category: 'abono_prestamo', amount: capital, tx_date: date, payee: l.lender_name, description: `Abono a capital ${l.number}`, reference: b.reference || null, period: null }, { loanId: l.id }, req.user.id);
  if (interest > 0) { const i = insertTx(acc.id, { direction: 'out', category: 'intereses_prestamo', amount: interest, tx_date: date, payee: l.lender_name, description: `Intereses ${l.number}`, reference: b.reference || null, period: null }, { loanId: l.id }, req.user.id); first = first || i; }
  saveTxFiles(first, req.files);
  db.exec('COMMIT');
  } catch (err) { db.exec('ROLLBACK'); return res.status(500).json({ error: err.message }); }
  res.status(201).json(loanFull(get('SELECT * FROM loans WHERE id = ?', [l.id])));
});
router.delete('/loans/:id', (req, res) => {
  if (adminOnly(req, res)) return;
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede borrar un préstamo.' });
  run('DELETE FROM bank_transactions WHERE loan_id = ?', [req.params.id]);
  run('DELETE FROM loans WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// Resumen de ingresos y egresos por categoría en un periodo (todas las cuentas o una).
router.get('/summary', (req, res) => {
  const { from, to, accountId } = req.query;
  const rows = movements(accountId ? Number(accountId) : null, { from, to }).filter((r) => !['transferencia_entrada', 'transferencia_salida'].includes(r.category));
  const by = {};
  for (const r of rows) { const k = `${r.direction}:${r.category}`; by[k] = by[k] || { direction: r.direction, category: r.category, total: 0, count: 0 }; by[k].total = round2(by[k].total + r.amount); by[k].count += 1; }
  const cats = Object.values(by).sort((a, b) => b.total - a.total);
  const income = round2(cats.filter((c) => c.direction === 'in').reduce((s, c) => s + c.total, 0));
  const expense = round2(cats.filter((c) => c.direction === 'out').reduce((s, c) => s + c.total, 0));
  res.json({ income, expense, net: round2(income - expense), categories: cats });
});

module.exports = router;
