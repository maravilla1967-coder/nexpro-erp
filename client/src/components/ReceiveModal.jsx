import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

// Recepción de mercancía contra una orden de compra: por cada línea se indica cuánto llegó
// (por omisión, lo que falta). Si el producto maneja seriales se escribe un número de serie
// por unidad (uno por línea, o separados por coma; sirve un lector de código de barras).
export default function ReceiveModal({ po, onDone, onClose }) {
  const { t } = useI18n();
  const pendingOf = (it) => Math.max(0, Number(it.quantity) - Number(it.received_qty || 0));
  const [lines, setLines] = useState(
    po.items.filter((it) => pendingOf(it) > 0).map((it) => ({ item: it, quantity: pendingOf(it), serialsText: '' }))
  );
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parseSerials = (txt) => txt.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const upd = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const updated = await api.post(`/purchase-orders/${po.id}/receipts`, {
        receiptDate, notes,
        lines: lines.map((l) => ({ itemId: l.item.id, quantity: parseFloat(l.quantity) || 0, serials: parseSerials(l.serialsText) })),
      });
      onDone(updated);
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <Modal title={`${t('Recibir mercancía')} · ${t('OC')} ${po.number}`} onClose={onClose} wide>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        {lines.length === 0 ? <div className="empty-state">{t('Esta orden ya se recibió completa.')}</div> : (
          <table>
            <thead><tr><th>{t('Descripción')}</th><th className="text-right">{t('Pedido')}</th><th className="text-right">{t('Ya recibido')}</th><th className="text-right">{t('Pendiente')}</th><th style={{ width: 120 }}>{t('Llegó ahora')}</th></tr></thead>
            <tbody>
              {lines.map((l, i) => {
                const n = parseFloat(l.quantity) || 0;
                const sn = parseSerials(l.serialsText);
                return (
                  <React.Fragment key={l.item.id}>
                    <tr>
                      <td>{l.item.description}{l.item.track_serials ? <div className="muted" style={{ fontSize: 12 }}>🔢 {t('Maneja números de serie')}</div> : null}</td>
                      <td className="text-right">{l.item.quantity}</td>
                      <td className="text-right muted">{l.item.received_qty || 0}</td>
                      <td className="text-right">{pendingOf(l.item)}</td>
                      <td><input type="number" min="0" step="any" max={pendingOf(l.item)} value={l.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} /></td>
                    </tr>
                    {l.item.track_serials && n > 0 ? (
                      <tr>
                        <td colSpan={5} style={{ background: '#f8fafc' }}>
                          <label style={{ fontSize: 12, fontWeight: 600 }}>
                            {t('Números de serie')} <span className={sn.length === n ? '' : 'text-danger'}>({sn.length}/{n})</span>
                          </label>
                          <textarea rows={Math.min(6, Math.max(2, n))} className="mono" placeholder={t('Un serial por línea (o separados por coma)')}
                            value={l.serialsText} onChange={(e) => upd(i, { serialsText: e.target.value })} />
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <div className="field"><label>{t('Fecha de recepción')}</label><input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} /></div>
          <div className="field"><label>{t('Notas (guía, transportista…)')}</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>{t('El inventario sube solo por lo que llegó. Si falta algo, la orden queda "parcial" y se recibe el resto después.')}</div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
          {lines.length > 0 && <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : t('Registrar recepción')}</button>}
        </div>
      </form>
    </Modal>
  );
}
