const { all, get, run } = require('../../db');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Suma de pagos y saldo de una factura.
function invoiceBalance(invoiceId) {
  const inv = get('SELECT id, total, status FROM invoices WHERE id = ?', [invoiceId]);
  if (!inv) return null;
  const paid = round2(get('SELECT COALESCE(SUM(amount),0) AS s FROM invoice_payments WHERE invoice_id = ?', [invoiceId]).s);
  return { paid, balance: round2(inv.total - paid), total: inv.total, status: inv.status };
}

// Recalcula el estado de cobro (pendiente / parcial / pagada) según los pagos registrados.
// No toca facturas anuladas/canceladas.
function refreshInvoiceStatus(invoiceId) {
  const b = invoiceBalance(invoiceId);
  if (!b || ['cancelado', 'anulada'].includes(b.status)) return b;
  let status = 'pendiente';
  if (b.paid > 0 && b.balance > 0.004) status = 'parcial';
  if (b.balance <= 0.004 && b.total > 0) status = 'pagada';
  if (b.total <= 0 && b.paid <= 0) status = b.status; // factura en cero: no se toca
  run('UPDATE invoices SET status = ? WHERE id = ?', [status, invoiceId]);
  return { ...b, status };
}

// Migración única: las facturas que ya estaban marcadas "pagada" antes de existir el
// registro de pagos reciben un pago por el total, para que su saldo quede en cero y la
// cartera no las muestre como pendientes.
function backfillLegacyPaidInvoices() {
  const done = get("SELECT value FROM app_settings WHERE key = 'invoice_payments_backfill_v1'");
  if (done) return;
  const legacy = all(`SELECT i.id, i.total, i.issue_date FROM invoices i
                      WHERE i.status = 'pagada' AND NOT EXISTS (SELECT 1 FROM invoice_payments p WHERE p.invoice_id = i.id)`);
  for (const inv of legacy) {
    run(`INSERT INTO invoice_payments (invoice_id, payment_date, amount, method, notes) VALUES (?,?,?,?,?)`,
      [inv.id, String(inv.issue_date || '').slice(0, 10), inv.total, 'otro', 'Marcada como pagada antes del registro de cobros']);
  }
  run("INSERT INTO app_settings (key, value) VALUES ('invoice_payments_backfill_v1', ?)", [String(legacy.length)]);
}

module.exports = { round2, invoiceBalance, refreshInvoiceStatus, backfillLegacyPaidInvoices };
