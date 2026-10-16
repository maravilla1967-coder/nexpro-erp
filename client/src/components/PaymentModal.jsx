import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { useI18n } from '../i18n.jsx';

// Formulario común para registrar un pago (abono) — se usa para cobros de clientes
// (facturas) y para pagos a proveedores (cuentas por pagar).
export const PAYMENT_METHODS = ['cheque', 'transferencia', 'ach', 'tarjeta', 'efectivo', 'otro'];

export function money(v) {
  return '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaymentModal({ title, balance, onSave, onClose }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: balance > 0 ? Number(balance).toFixed(2) : '',
    method: 'cheque', reference: '', notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave({ ...form, amount: parseFloat(form.amount) }); }
    catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="muted" style={{ marginBottom: 10 }}>{t('Saldo pendiente:')} <strong>{money(balance)}</strong></div>
        <div className="grid grid-2">
          <div className="field"><label>{t('Fecha del pago')}</label><input type="date" required value={form.paymentDate} onChange={set('paymentDate')} /></div>
          <div className="field"><label>{t('Monto *')}</label><input type="number" step="0.01" min="0.01" required value={form.amount} onChange={set('amount')} /></div>
          <div className="field"><label>{t('Forma de pago')}</label>
            <select value={form.method} onChange={set('method')}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{t(m)}</option>)}
            </select>
          </div>
          <div className="field"><label>{t('Referencia (no. de cheque, confirmación…)')}</label><input value={form.reference} onChange={set('reference')} /></div>
        </div>
        <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={set('notes')} /></div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : t('Registrar pago')}</button>
        </div>
      </form>
    </Modal>
  );
}
