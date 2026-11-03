import React, { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { useBankAccounts, BankAccountSelect, defaultAccount } from './PaymentModal.jsx';
import { useI18n } from '../i18n.jsx';

// Recepción de mercancía contra una orden de compra: por cada línea se indica cuánto llegó
// (por omisión, lo que falta). Si el producto maneja seriales se escribe un número de serie
// por unidad (uno por línea, o separados por coma; sirve un lector de código de barras).
export default function ReceiveModal({ po, onDone, onClose }) {
  const { t } = useI18n();
  const pendingOf = (it) => Math.max(0, Number(it.quantity) - Number(it.received_qty || 0) - Number(it.short_qty || 0));
  const [lines, setLines] = useState(
    po.items.filter((it) => pendingOf(it) > 0).map((it) => ({ item: it, quantity: pendingOf(it), serialsText: '', hasSerials: it.track_serials ? true : null }))
  );
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const terms = po.effective_terms_days !== undefined ? po.effective_terms_days : po.supplier_terms_days; // null = sin definir, 0 = contado
  const [billMode, setBillMode] = useState(terms === 0 ? 'pagada' : 'credito');
  const [billNumber, setBillNumber] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [payMethod, setPayMethod] = useState('transferencia');
  const [payRef, setPayRef] = useState('');
  const [closeShort, setCloseShort] = useState(false);
  const accounts = useBankAccounts();
  const [bankAccountId, setBankAccountId] = useState(null);
  React.useEffect(() => { if (bankAccountId === null && accounts) setBankAccountId(defaultAccount(accounts)); }, [accounts]);
  const [shortNote, setShortNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const parseSerials = (txt) => txt.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const upd = (i, patch) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const money = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const receivedValue = Math.round(lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * Number(l.item.unit_cost || 0), 0) * 100) / 100;
  const leftAfter = lines.reduce((s, l) => s + Math.max(0, pendingOf(l.item) - (parseFloat(l.quantity) || 0)), 0);
  const addDays = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const autoDue = receiptDate ? addDays(receiptDate, terms == null ? 30 : terms) : '';

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const unanswered = lines.filter((l) => (parseFloat(l.quantity) || 0) > 0 && l.hasSerials === null);
      if (unanswered.length) { setError(`${t('Indica si tiene número de serie:')} ${unanswered.map((l) => l.item.description).join(', ')}`); setSaving(false); return; }
      const incomplete = lines.filter((l) => l.hasSerials && (parseFloat(l.quantity) || 0) > 0 && parseSerials(l.serialsText).length !== (parseFloat(l.quantity) || 0));
      if (incomplete.length) { setError(`${t('Falta escribir un serial por unidad en:')} ${incomplete.map((l) => l.item.description).join(', ')}`); setSaving(false); return; }
      if (closeShort && leftAfter > 0 && !shortNote.trim()) { setError(t('Escribe el motivo del faltante.')); setSaving(false); return; }
      const updated = await api.post(`/purchase-orders/${po.id}/receipts`, {
        receiptDate, notes,
        bill: { mode: billMode, billNumber, amount: billAmount === '' ? undefined : billAmount, dueDate: billMode === 'credito' ? (dueDate || autoDue) : undefined, method: payMethod, reference: payRef, bankAccountId: bankAccountId || '' },
        closeShort: closeShort && leftAfter > 0 ? { note: shortNote } : undefined,
        lines: lines.map((l) => ({ itemId: l.item.id, quantity: parseFloat(l.quantity) || 0, hasSerials: l.hasSerials === true, serials: l.hasSerials ? parseSerials(l.serialsText) : [] })),
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
                      <td>{l.item.description}
                        {n > 0 && (l.item.track_serials
                          ? <div className="muted" style={{ fontSize: 12 }}>🔢 {t('Maneja números de serie')}</div>
                          : <div style={{ fontSize: 12, marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span className="muted">{t('¿Tiene número de serie?')}</span>
                              <button type="button" className={`btn btn-sm ${l.hasSerials === true ? 'btn-primary' : ''}`} style={{ padding: '1px 10px' }} onClick={() => upd(i, { hasSerials: true })}>{t('Sí')}</button>
                              <button type="button" className={`btn btn-sm ${l.hasSerials === false ? 'btn-primary' : ''}`} style={{ padding: '1px 10px' }} onClick={() => upd(i, { hasSerials: false })}>{t('No')}</button>
                            </div>)}
                      </td>
                      <td className="text-right">{l.item.quantity}</td>
                      <td className="text-right muted">{l.item.received_qty || 0}</td>
                      <td className="text-right">{pendingOf(l.item)}</td>
                      <td><input type="number" min="0" step="any" max={pendingOf(l.item)} value={l.quantity} onChange={(e) => upd(i, { quantity: e.target.value })} /></td>
                    </tr>
                    {l.hasSerials && n > 0 ? (
                      <tr>
                        <td colSpan={5} style={{ background: '#f8fafc' }}>
                          <label style={{ fontSize: 12, fontWeight: 600 }}>
                            {t('Números de serie de')} {l.item.description} <span className={sn.length === n ? '' : 'text-danger'}>({sn.length}/{n})</span>
                            {sn.length === n && <span style={{ color: 'var(--green, #15803d)' }}> ✓</span>}
                          </label>
                          <textarea rows={Math.min(6, Math.max(2, n))} className="mono" autoFocus placeholder={t('Un serial por línea (o separados por coma)')}
                            value={l.serialsText} onChange={(e) => upd(i, { serialsText: e.target.value })} />
                          {!l.item.product_id && <div className="muted" style={{ fontSize: 12 }}>{t('Esta línea no tiene producto de inventario: se creará el producto con esta descripción para llevar sus seriales.')}</div>}
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

        {lines.length > 0 && leftAfter > 0 && (
          <div className="form-section" style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={closeShort} onChange={(e) => setCloseShort(e.target.checked)} />
              {t('Lo que falta ya no va a llegar (cerrar faltante)')}
            </label>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{t('Quedan')} {leftAfter} {t('unidad(es) pendientes después de esta recepción. Si no marcas esto, la orden queda "parcial" esperando el resto.')}</div>
            {closeShort && <div className="field" style={{ marginTop: 8 }}><label>{t('Motivo del faltante *')}</label><input value={shortNote} placeholder={t('Ej.: el proveedor no tiene la pieza; llegó dañado y se devolvió…')} onChange={(e) => setShortNote(e.target.value)} /></div>}
          </div>
        )}

        {lines.length > 0 && (
          <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{t('Cuenta por pagar al proveedor')} <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {terms == null ? t('condiciones sin definir en el proveedor (se usan 30 días)') : terms === 0 ? t('proveedor de contado') : `${t('crédito')} ${terms} ${t('días')}`}</span></div>
            <div className="seg" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {[['credito', t('A crédito: crear cuenta por pagar')], ['pagada', t('Ya está pagada (contado / prepago)')], ['ninguna', t('No crear ahora')]].map(([k, label]) => (
                <button key={k} type="button" className={`btn btn-sm ${billMode === k ? 'btn-primary' : ''}`} onClick={() => setBillMode(k)}>{label}</button>
              ))}
            </div>
            {billMode !== 'ninguna' && (
              <div className="grid grid-2">
                <div className="field"><label>{t('No. de factura del proveedor')}</label><input value={billNumber} placeholder={t('Opcional')} onChange={(e) => setBillNumber(e.target.value)} /></div>
                <div className="field"><label>{t('Monto')} <span className="muted" style={{ fontWeight: 400 }}>({t('valor de lo recibido')}: {money(receivedValue)})</span></label><input inputMode="decimal" placeholder={receivedValue.toFixed(2)} value={billAmount} onChange={(e) => setBillAmount(e.target.value)} /></div>
                {billMode === 'credito' && <div className="field"><label>{t('Vence')}</label><input type="date" value={dueDate || autoDue} onChange={(e) => setDueDate(e.target.value)} /></div>}
                {billMode === 'pagada' && <>
                  <div className="field"><label>{t('Forma de pago')}</label>
                    <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                      {['transferencia', 'ach', 'cheque', 'tarjeta', 'efectivo', 'otro'].map((m) => <option key={m} value={m}>{t(m)}</option>)}
                    </select></div>
                  <div className="field"><label>{t('Referencia del pago')}</label><input value={payRef} onChange={(e) => setPayRef(e.target.value)} /></div>
                  <BankAccountSelect accounts={accounts} value={bankAccountId} onChange={setBankAccountId} label={t('Cuenta bancaria de donde salió el pago')} />
                </>}
              </div>
            )}
            {billMode === 'ninguna' && <div className="muted" style={{ fontSize: 12 }}>{t('Podrás registrar la factura del proveedor después desde la orden; quedará marcado como "recibido sin facturar".')}</div>}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
          {lines.length > 0 && <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : t('Registrar recepción')}</button>}
        </div>
      </form>
    </Modal>
  );
}
