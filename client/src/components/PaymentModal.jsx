import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

// Formulario común para registrar un pago (abono) — se usa para cobros de clientes
// (facturas) y para pagos a proveedores (cuentas por pagar).
export const PAYMENT_METHODS = ['cheque', 'transferencia', 'ach', 'square', 'tarjeta', 'efectivo', 'otro'];
const METHOD_LABELS = { square: 'Tarjeta de crédito / Square' };
export function methodLabel(t, m) { return m ? t(METHOD_LABELS[m] || m) : '—'; }

// Sube los comprobantes de un pago (basePath: '/invoices/12' o '/payables/3'). Devuelve el
// documento actualizado, o null si no había archivos.
export async function uploadPaymentFiles(basePath, paymentId, files) {
  if (!files || files.length === 0 || !paymentId) return null;
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append('files', f));
  return api.postForm(`${basePath}/payments/${paymentId}/files`, fd);
}

// Lista de comprobantes de un pago, con enlace para abrirlos (y ✕ si se permite borrar).
export function PaymentFiles({ files, onRemove }) {
  if (!files || files.length === 0) return null;
  return (
    <div style={{ fontSize: 12, marginTop: 2 }}>
      {files.map((f) => (
        <span key={f.id} style={{ marginRight: 10, whiteSpace: 'nowrap' }}>
          📎 <a href={f.file_url} target="_blank" rel="noreferrer">{f.original_name || f.file_url.split('/').pop()}</a>
          {onRemove && <button type="button" className="link-btn no-print" style={{ marginLeft: 4 }} onClick={() => onRemove(f)}>✕</button>}
        </span>
      ))}
    </div>
  );
}

export function money(v) {
  return '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PaymentModal({ title, balance, onSave, onClose, initial, submitLabel }) {
  const { t } = useI18n();
  const [form, setForm] = useState(initial ? {
    paymentDate: initial.payment_date, amount: Number(initial.amount).toFixed(2),
    method: initial.method || 'cheque', reference: initial.reference || '', notes: initial.notes || '',
  } : {
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: balance > 0 ? Number(balance).toFixed(2) : '',
    method: 'cheque', reference: '', notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState([]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try { await onSave({ ...form, amount: parseFloat(form.amount) }, files); }
    catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        {!initial && <div className="muted" style={{ marginBottom: 10 }}>{t('Saldo pendiente:')} <strong>{money(balance)}</strong></div>}
        <div className="grid grid-2">
          <div className="field"><label>{t('Fecha del pago')}</label><input type="date" required value={form.paymentDate} onChange={set('paymentDate')} /></div>
          <div className="field"><label>{t('Monto *')}</label><input type="number" step="0.01" min="0.01" required value={form.amount} onChange={set('amount')} /></div>
          <div className="field"><label>{t('Forma de pago')}</label>
            <select value={form.method} onChange={set('method')}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(t, m)}</option>)}
            </select>
          </div>
          <div className="field"><label>{t('Referencia (no. de cheque, confirmación…)')}</label><input value={form.reference} onChange={set('reference')} /></div>
        </div>
        <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={set('notes')} /></div>
        <div className="field">
          <label>{t('Comprobante del pago (tiquete de la tarjeta, transferencia, cheque…)')}</label>
          {initial && <PaymentFiles files={initial.files} />}
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          {files.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{files.length} {t('archivo(s) para adjuntar')}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : (submitLabel || t('Registrar pago'))}</button>
        </div>
      </form>
    </Modal>
  );
}
