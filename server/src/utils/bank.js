const { get, run } = require('../../db');

// Enlaza un cobro (invoice_payments) o un pago (supplier_bill_payments) a una cuenta bancaria.
// accountId: id de la cuenta, '' / null = sin cuenta, undefined = usar la cuenta por defecto
// solo si el pago aún no tiene cuenta.
const TABLE = { invoice: 'invoice_payments', bill: 'supplier_bill_payments' };
function defaultAccountId() {
  const d = get('SELECT id FROM bank_accounts WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1');
  return d ? d.id : null;
}
function setPaymentBank(kind, paymentId, accountId) {
  if (!paymentId || !TABLE[kind]) return;
  if (accountId === undefined) {
    const cur = get(`SELECT bank_account_id FROM ${TABLE[kind]} WHERE id = ?`, [paymentId]);
    if (cur && cur.bank_account_id) return;
    accountId = defaultAccountId();
  }
  const id = accountId === '' || accountId === null ? null : parseInt(accountId, 10);
  run(`UPDATE ${TABLE[kind]} SET bank_account_id = ? WHERE id = ?`, [Number.isNaN(id) ? null : id, paymentId]);
}
module.exports = { setPaymentBank, defaultAccountId };
