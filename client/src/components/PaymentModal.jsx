import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

// Formulario común para registrar un pago (abono) — se usa para cobros de clientes
// (facturas) y para pagos a proveedores (cuentas por pagar).
export const PAYMENT_METHODS = ['cheque', 'transferencia', 'ach', 'square', 'tarjeta', 'efectivo', 'otro'];
const METHOD_LABELS = { square: 'Tarjeta de crédito / Square' };
export function methodLabel(t, m) { return m ? t(METHOD_LABELS[m] || m) : '—'; }

// Guarda el pago y sus comprobantes en una sola petición (multipart). method: 'post' | 'put'.
export function sendPayment(method, path, payload, files) {
  const fd = new FormData();
  Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v); });
  Array.from(files || []).forEach((f) => fd.append('files', f));
  return method === 'put' ? api.putForm(path, fd) : api.postForm(path, fd);
}

// Sube los comprobantes de un pago (basePath: '/invoices/12' o '/payables/3'). Devuelve el
// documento actualizado, o null si no había archivos.
export async function uploadPaymentFiles(basePath, paymentId, files) {
  if (!files || files.length === 0 || !paymentId) return null;
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append('files', f));
  return api.postForm(`${basePath}/payments/${paymentId}/files`, fd);
}

// Lista de comprobantes de un pago, con enlace para abrirlos (y ✕ si se permite borrar).
// Se muestran como "Comprobante de pago" (1, 2…) en vez del nombre del archivo, que suele ser
// larguísimo (recibos de Square, del banco); el nombre original aparece al pasar el mouse.
export function PaymentFiles({ files, onRemove }) {
  const { t } = useI18n();
  if (!files || files.length === 0) return null;
  return (
    <div className="payment-files">
      {files.map((f, i) => (
        <span key={f.id} className="payment-file">
          📎 <a href={f.file_url} target="_blank" rel="noreferrer" title={f.original_name || ''}>{t('Comprobante de pago')}{files.length > 1 ? ` ${i + 1}` : ''}</a>
          {onRemove && <button type="button" className="link-btn no-print" style={{ marginLeft: 4 }} onClick={() => onRemove(f)}>✕</button>}
        </span>
      ))}
    </div>
  );
}

export function money(v) {
  return '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Acepta montos escritos como "9,342", "$9,342.00" o "9342".
export function parseAmount(v) {
  const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isNaN(n) ? NaN : Math.round(n * 100) / 100;
}

// showSurcharge: muestra el campo "Recargo cobrado al cliente" (solo cobros de facturas).
export default function PaymentModal({ title, balance, onSave, onClose, initial, submitLabel, showSurcharge }) {
  const { t } = useI18n();
  const [form, setForm] = useState(initial ? {
    paymentDate: initial.payment_date, amount: Number(initial.amount).toFixed(2),
    surcharge: initial.surcharge ? Number(initial.surcharge).toFixed(2) : '',
    processorFee: initial.processor_fee ? Number(initial.processor_fee).toFixed(2) : '',
    method: initial.method || 'cheque', reference: initial.reference || '', notes: initial.notes || '',
  } : {
    paymentDate: new Date().toISOString().slice(0, 10),
    amount: balance > 0 ? Number(balance).toFixed(2) : '',
    surcharge: '', processorFee: '', method: 'cheque', reference: '', notes: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState([]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const amountN = parseAmount(form.amount);
  const surchargeN = form.surcharge === '' ? 0 : parseAmount(form.surcharge);
  const feeN = form.processorFee === '' ? 0 : parseAmount(form.processorFee);
  const totalCharged = (amountN || 0) + (surchargeN || 0);
  const isCard = ['square', 'tarjeta'].includes(form.method);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.paymentDate) { setError(t('Indica la fecha del pago.')); return; }
    if (!(amountN > 0)) { setError(t('Escribe el monto del pago (por ejemplo 9070 o 9,070.00).')); return; }
    if (Number.isNaN(surchargeN) || surchargeN < 0) { setError(t('El recargo no es un número válido.')); return; }
    if (Number.isNaN(feeN) || feeN < 0) { setError(t('La comisión no es un número válida.')); return; }
    setSaving(true);
    try { await onSave({ ...form, amount: amountN, surcharge: surchargeN, processorFee: feeN }, files); }
    catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {!initial && <div className="muted" style={{ marginBottom: 10 }}>{t('Saldo pendiente:')} <strong>{money(balance)}</strong></div>}
        <div className="grid grid-2">
          <div className="field"><label>{t('Fecha del pago')}</label><input type="date" value={form.paymentDate} onChange={set('paymentDate')} /></div>
          <div className="field"><label>{showSurcharge ? t('Monto abonado a la factura *') : t('Monto *')}</label><input inputMode="decimal" value={form.amount} onChange={set('amount')} /></div>
          <div className="field"><label>{t('Forma de pago')}</label>
            <select value={form.method} onChange={set('method')}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(t, m)}</option>)}
            </select>
          </div>
          <div className="field"><label>{t('Referencia (no. de cheque, confirmación…)')}</label><input value={form.reference} onChange={set('reference')} /></div>
        </div>
        {showSurcharge && (
          <div className="field">
            <label>{t('Recargo cobrado al cliente (ej. 3% por tarjeta) — no reduce el saldo')}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input inputMode="decimal" placeholder="0.00" value={form.surcharge} onChange={set('surcharge')} />
              <button type="button" className="btn btn-sm" onClick={() => setForm({ ...form, surcharge: (Math.round((amountN || 0) * 3) / 100).toFixed(2) })}>3%</button>
              {form.surcharge !== '' && <button type="button" className="link-btn" onClick={() => setForm({ ...form, surcharge: '' })}>✕</button>}
            </div>
          </div>
        )}
        {showSurcharge && (isCard || feeN > 0) && (
          <div className="field">
            <label>{t('Comisión que nos cobra el procesador (Square)')}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input inputMode="decimal" placeholder="0.00" value={form.processorFee} onChange={set('processorFee')} />
              <button type="button" className="btn btn-sm" style={{ whiteSpace: 'nowrap' }}
                onClick={() => setForm({ ...form, processorFee: (Math.round((totalCharged * 0.035 + 0.15) * 100) / 100).toFixed(2) })}>Square 3.5% + $0.15</button>
            </div>
          </div>
        )}
        {showSurcharge && amountN > 0 && (surchargeN > 0 || feeN > 0) && (
          <div className="pay-breakdown">
            <div><span>{t('Abono a la factura')}</span><span>{money(amountN)}</span></div>
            {surchargeN > 0 && <div><span>+ {t('Recargo al cliente')}</span><span>{money(surchargeN)}</span></div>}
            <div className="strong"><span>{t('Total cobrado (recibo de Square)')}</span><span>{money(totalCharged)}</span></div>
            {feeN > 0 && <div><span>− {t('Comisión del procesador')}</span><span>{money(feeN)}</span></div>}
            {feeN > 0 && <div className="strong"><span>{t('Neto recibido en el banco')}</span><span>{money(totalCharged - feeN)}</span></div>}
          </div>
        )}
        <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={set('notes')} /></div>
        <div className="field">
          <label>{t('Comprobante del pago (tiquete de la tarjeta, transferencia, cheque…)')}</label>
          {initial && <PaymentFiles files={initial.files} />}
          <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          {files.length > 0 && <div className="muted" style={{ fontSize: 12 }}>{files.length} {t('archivo(s) para adjuntar')}</div>}
        </div>
        {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : (submitLabel || t('Registrar pago'))}</button>
        </div>
      </form>
    </Modal>
  );
}
