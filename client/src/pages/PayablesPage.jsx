import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import PaymentModal, { money, methodLabel, uploadPaymentFiles, PaymentFiles, sendPayment } from '../components/PaymentModal.jsx';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
import { BUCKETS } from './ReceivablesPage.jsx';

// Cuentas por pagar: facturas de proveedores, cuándo vencen, qué se ha pagado y qué falta.
const BUCKET_LABEL = { corriente: 'Por vencer', '1-30': '1–30 días', '31-60': '31–60 días', '61-90': '61–90 días', '+90': 'Más de 90' };
const plusDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { supplierId: '', purchaseOrderId: '', billNumber: '', billDate: today(), dueDate: plusDays(today(), 30), amount: '', notes: '' };

const bDate = (r) => r.due_date || r.bill_date;
const bNumber = (r) => r.bill_number;
const B_COLUMNS = [
  { label: 'Proveedor', value: (r) => r.supplier_name },
  { label: 'Factura proveedor', value: (r) => r.bill_number, mono: true },
  { label: 'Orden de compra', value: (r) => r.purchase_order_number },
  { label: 'Fecha', value: (r) => r.bill_date },
  { label: 'Vence', value: (r) => r.due_date },
  { label: 'Días vencida', value: (r) => (r.days_overdue > 0 ? r.days_overdue : 0), type: 'number' },
  { label: 'Estado', value: (r) => r.status },
  { label: 'Monto', value: (r) => r.amount, type: 'money' },
  { label: 'Pagado', value: (r) => r.paid, type: 'money' },
  { label: 'Saldo', value: (r) => r.balance, type: 'money' },
];

export default function PayablesPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [showPaid, setShowPaid] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [bucket, setBucket] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [pos, setPos] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(null);
  const [uploading, setUploading] = useState(false);

  function load() { return api.get('/payables').then(setList).catch(console.error); }
  useEffect(() => {
    load();
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/purchase-orders').then(setPos).catch(() => {});
  }, []);

  // /cuentas-por-pagar?nuevo=1&oc=ID (desde una orden de compra)  ·  ?ver=ID
  useEffect(() => {
    const ver = params.get('ver');
    if (ver) { openEdit({ id: ver }); setParams({}, { replace: true }); return; }
    if (params.get('nuevo')) {
      const oc = params.get('oc');
      (async () => {
        let f = { ...EMPTY };
        if (oc) {
          const po = await api.get(`/purchase-orders/${oc}`);
          const total = (po.items || []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0);
          f = { ...f, supplierId: po.supplier_id, purchaseOrderId: po.id, amount: total.toFixed(2) };
        }
        setEditing(null); setForm(f); setError(''); setModal(true);
        setParams({}, { replace: true });
      })();
    }
  }, [params]);

  const open = list.filter((b) => b.status !== 'anulada' && b.balance > 0.004);
  const totals = useMemo(() => {
    const o = { all: 0 }; BUCKETS.forEach((b) => { o[b] = 0; });
    open.forEach((r) => { o[r.bucket] += r.balance; o.all += r.balance; });
    return o;
  }, [list]);
  const dueThisWeek = open.filter((b) => b.days_overdue > -7 && b.days_overdue <= 0).reduce((s, b) => s + b.balance, 0);

  const rows = (showPaid ? list : open).filter((r) => (!supplierFilter || String(r.supplier_id) === supplierFilter) && (!bucket || r.bucket === bucket));
  const ex = useListExport({ rows, getDate: bDate, getNumber: bNumber });

  async function openEdit(b) {
    const full = await api.get(`/payables/${b.id}`);
    setEditing(full);
    setForm({ supplierId: full.supplier_id, purchaseOrderId: full.purchase_order_id || '', billNumber: full.bill_number || '', billDate: full.bill_date || '', dueDate: full.due_date || '', amount: full.amount, notes: full.notes || '' });
    setError(''); setModal(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      const saved = editing ? await api.put(`/payables/${editing.id}`, form) : await api.post('/payables', form);
      await load();
      if (!editing) { setEditing(saved); } else { setModal(false); setEditing(null); }
    } catch (err) { setError(err.message); }
  }

  async function voidBill() {
    if (!window.confirm(t('¿Anular esta factura de proveedor?'))) return;
    await api.put(`/payables/${editing.id}`, { status: 'anulada' });
    setModal(false); setEditing(null); load();
  }

  async function upload(files) {
    if (!files || !files.length) return;
    const fd = new FormData(); Array.from(files).forEach((f) => fd.append('files', f));
    setUploading(true);
    try { setEditing(await api.postForm(`/payables/${editing.id}/attachments`, fd)); } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function addProof(pid, files) {
    try { const u = await uploadPaymentFiles(`/payables/${editing.id}`, pid, files); if (u) setEditing(u); } catch (err) { setError(err.message); }
  }
  async function removeProof(pid, f) {
    if (!window.confirm(t('¿Eliminar este archivo adjunto?'))) return;
    setEditing(await api.del(`/payables/${editing.id}/payments/${pid}/files/${f.id}`));
  }

  async function savePayment(payload, files) {
    const updated = await sendPayment('post', `/payables/${paying.id}/payments`, payload, files);
    if (editing && editing.id === paying.id) setEditing(updated);
    setPaying(null); load();
  }

  async function deletePayment(pid) {
    if (!window.confirm(t('¿Borrar este pago?'))) return;
    try { setEditing(await api.del(`/payables/${editing.id}/payments/${pid}`)); load(); } catch (err) { alert(err.message); }
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const supplierPos = pos.filter((p) => !form.supplierId || String(p.supplier_id) === String(form.supplierId));

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Cuentas por pagar')}</h1><div className="sub">{t('Facturas de proveedores y pagos')}</div></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm({ ...EMPTY }); setError(''); setModal(true); }}>{t('+ Factura de proveedor')}</button>
      </div>
      <div className="content">
        <div className="aging-cards">
          <button className={`aging-card ${bucket === '' ? 'active' : ''}`} onClick={() => setBucket('')}>
            <span>{t('Total por pagar')}</span><strong>{money(totals.all)}</strong>
          </button>
          {BUCKETS.map((b) => (
            <button key={b} className={`aging-card b-${b.replace('+', 'p')} ${bucket === b ? 'active' : ''}`} onClick={() => setBucket(bucket === b ? '' : b)}>
              <span>{t(BUCKET_LABEL[b])}</span><strong>{money(totals[b])}</strong>
            </button>
          ))}
        </div>
        {dueThisWeek > 0 && <div className="notice-banner">{t('Vence en los próximos 7 días:')} <strong>{money(dueThisWeek)}</strong></div>}

        <div className="toolbar">
          <select style={{ width: 260 }} value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
            <option value="">{t('Todos los proveedores')}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} style={{ width: 'auto' }} /> {t('Mostrar pagadas y anuladas')}
          </label>
        </div>
        <div className="card">
          {rows.length === 0 ? <div className="empty-state">{t('No hay facturas de proveedores pendientes.')}</div> : (
            <>
              <ListExportBar ex={ex} title={t('Cuentas por pagar')} filename="cuentas-por-pagar" columns={B_COLUMNS} />
              <table>
                <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Proveedor')}</th><th>{t('Factura proveedor')}</th><th>{t('OC')}</th><th>{t('Vence')}</th><th>{t('Estado')}</th><th className="text-right">{t('Monto')}</th><th className="text-right">{t('Saldo')}</th><th></th></tr></thead>
                <tbody>
                  {ex.visible.map((b) => (
                    <tr key={b.id}>
                      <td><RowBox ex={ex} row={b} /></td>
                      <td className="clickable" onClick={() => openEdit(b)}><strong>{b.supplier_name}</strong></td>
                      <td className="mono clickable" onClick={() => openEdit(b)}>{b.bill_number || '—'}</td>
                      <td className="mono muted">{b.purchase_order_number || '—'}</td>
                      <td className="muted">{b.due_date || '—'}{b.balance > 0.004 && b.days_overdue > 0 && <> <span className={`aging-pill b-${b.bucket.replace('+', 'p')}`}>{b.days_overdue} {t('días')}</span></>}</td>
                      <td><Pill value={b.status} /></td>
                      <td className="text-right">{money(b.amount)}</td>
                      <td className="text-right"><strong>{money(b.balance)}</strong></td>
                      <td style={{ display: 'flex', gap: 10 }}>
                        {b.balance > 0.004 && b.status !== 'anulada' && <button className="link-btn" onClick={() => setPaying(b)}>{t('Pagar')}</button>}
                        <button className="link-btn" onClick={() => openEdit(b)}>{t('Ver')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {modal && (
        <Modal title={editing ? `${t('Factura de proveedor')} ${editing.bill_number || ''}` : t('Nueva factura de proveedor')} onClose={() => { setModal(false); setEditing(null); }} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            {editing && <div style={{ marginBottom: 10 }}><Pill value={editing.status} /> · {t('Pagado')} {money(editing.paid)} · {t('Saldo')} <strong>{money(editing.balance)}</strong></div>}
            <div className="grid grid-2">
              <div className="field"><label>{t('Proveedor *')}</label>
                <select required value={form.supplierId} onChange={set('supplierId')}>
                  <option value="">{t('— Seleccionar —')}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Orden de compra')}</label>
                <select value={form.purchaseOrderId} onChange={set('purchaseOrderId')}>
                  <option value="">{t('— Ninguna —')}</option>
                  {supplierPos.map((p) => <option key={p.id} value={p.id}>{p.number} · {money(p.total)}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('No. de factura del proveedor')}</label><input className="mono" value={form.billNumber} onChange={set('billNumber')} /></div>
              <div className="field"><label>{t('Monto *')}</label><input type="number" step="0.01" required value={form.amount} onChange={set('amount')} /></div>
              <div className="field"><label>{t('Fecha de la factura')}</label><input type="date" value={form.billDate} onChange={(e) => setForm({ ...form, billDate: e.target.value, dueDate: form.dueDate || plusDays(e.target.value, 30) })} /></div>
              <div className="field"><label>{t('Vence')}</label><input type="date" value={form.dueDate} onChange={set('dueDate')} /></div>
            </div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={set('notes')} /></div>

            {editing && (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)', marginTop: 10, display: 'block' }}>{t('Factura escaneada / archivos')}</label>
                <div className="file-list">
                  {(editing.attachments || []).map((a) => (
                    <div className="file-list-item" key={a.id}><a href={a.file_url} target="_blank" rel="noreferrer">{a.original_name || a.file_url.split('/').pop()}</a></div>
                  ))}
                  <label className="btn btn-sm" style={{ marginTop: 6, display: 'inline-block', cursor: 'pointer' }}>
                    {uploading ? t('Subiendo…') : t('+ Adjuntar archivo')}
                    <input type="file" multiple hidden disabled={uploading} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
                  </label>
                </div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)', marginTop: 14, display: 'block' }}>{t('Pagos')}</label>
                {(editing.payments || []).length === 0 ? <div className="muted" style={{ fontSize: 13 }}>{t('Sin pagos todavía.')}</div> : (
                  <table>
                    <thead><tr><th>{t('Fecha')}</th><th>{t('Forma de pago')}</th><th>{t('Referencia')}</th><th className="text-right">{t('Monto')}</th><th></th></tr></thead>
                    <tbody>
                      {editing.payments.map((p) => (
                        <tr key={p.id}><td>{p.payment_date}</td><td>{methodLabel(t, p.method)}</td><td>{p.reference || '—'}
                          <PaymentFiles files={p.files} onRemove={isAdmin ? (f) => removeProof(p.id, f) : null} />
                          <label className="link-btn" style={{ fontSize: 12, cursor: 'pointer' }}>{t('+ comprobante')}<input type="file" multiple hidden onChange={(e) => { addProof(p.id, e.target.files); e.target.value = ''; }} /></label>
                        </td><td className="text-right">{money(p.amount)}</td>
                          <td>{isAdmin && <button type="button" className="link-btn" onClick={() => deletePayment(p.id)}>✕</button>}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
            {!editing && <div className="muted" style={{ fontSize: 13 }}>{t('Al guardar podrás adjuntar la factura escaneada y registrar pagos.')}</div>}

            <div className="modal-footer">
              {editing && editing.status !== 'anulada' && <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={voidBill}>{t('Anular')}</button>}
              {editing && editing.balance > 0.004 && editing.status !== 'anulada' && <button type="button" className="btn" onClick={() => setPaying(editing)}>{t('💵 Registrar pago')}</button>}
              <button type="button" className="btn" onClick={() => { setModal(false); setEditing(null); }}>{editing ? t('Cerrar') : t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{editing ? t('Guardar cambios') : t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}
      {paying && <PaymentModal title={`${t('Pago a')} ${paying.supplier_name}${paying.bill_number ? ` · ${paying.bill_number}` : ''}`} balance={paying.balance} onSave={savePayment} onClose={() => setPaying(null)} />}
    </>
  );
}
