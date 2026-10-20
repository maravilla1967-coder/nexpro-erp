import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import DocumentBrand from '../components/DocumentBrand.jsx';
import Modal from '../components/Modal.jsx';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import PaymentModal, { methodLabel, readFilesNow, sendPayment, PaymentFiles } from '../components/PaymentModal.jsx';

const money = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Documento imprimible del comprobante de pago sin factura, con espacio para firmas.
export default function ServiceVoucherDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [v, setV] = useState(null);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);

  function load() { api.get(`/service-vouchers/${id}`).then(setV).catch((e) => setError(e.message)); }
  useEffect(load, [id]);

  function openEdit() {
    api.get('/vehicles').then((r) => setVehicles(r.rows || r)).catch(() => {});
    api.get('/work-orders').then(setWorkOrders).catch(() => {});
    setEditing({ serviceDate: v.service_date || '', serviceType: v.service_type || '', description: v.description || '', amount: String(v.amount),
      vehicleId: v.vehicle_id ? String(v.vehicle_id) : '', workOrderId: v.work_order_id ? String(v.work_order_id) : '', receivedBy: v.received_by || '', notes: v.notes || '', files: [] });
    setError('');
  }
  async function saveEdit(e) {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(editing).forEach(([k, val]) => { if (k !== 'files') fd.append(k, String(val ?? '')); });
    editing.files.forEach((f) => fd.append('files', f, f.name));
    try { setV(await api.putForm(`/service-vouchers/${id}`, fd)); setEditing(null); } catch (err) { setError(err.message); }
  }
  async function removeFile(fid) { setV(await api.del(`/service-vouchers/${id}/files/${fid}`)); }
  async function del() {
    if (!window.confirm(t('¿Eliminar este comprobante y su cuenta por pagar?'))) return;
    try { await api.del(`/service-vouchers/${id}`); navigate('/pagos-sin-factura'); } catch (err) { setError(err.message); }
  }

  if (!v) return <div className="content">{error || t('Cargando…')}</div>;
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <>
      <div className="topbar no-print">
        <div><h1>{t('Comprobante de pago')} {v.number}</h1><div className="sub"><Pill value={v.status} /></div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/pagos-sin-factura" className="btn">{t('← Volver')}</Link>
          <button className="btn" onClick={openEdit}>{t('✏️ Editar')}</button>
          {v.amount > 0 && v.balance > 0.004 && <button className="btn btn-primary" onClick={() => setPaying(true)}>{t('💵 Registrar pago')}</button>}
          {isAdmin && <button className="btn btn-danger" onClick={del}>{t('Eliminar')}</button>}
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        {error && <div className="error-banner no-print">{error}</div>}
        {v.missing && v.missing.length > 0 && (
          <div className="error-banner no-print" style={{ background: '#fff7ed', color: '#9a3412' }}>
            📝 {t('Borrador — falta:')} <strong>{v.missing.map((m) => t(m)).join(', ')}</strong>. {t('Complétalo con "Editar".')}
          </div>
        )}
        {!v.vehicle_id && !v.work_order_id && <div className="muted no-print" style={{ fontSize: 13, marginBottom: 10 }}>ℹ️ {t('No está enlazado a ningún vehículo ni orden de trabajo (puedes enlazarlo con "Editar").')}</div>}
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('COMPROBANTE DE PAGO')}</h2>
              <div className="muted" style={{ fontSize: 12 }}>{t('Servicio sin factura del proveedor')}</div>
              <div><strong>No.</strong> {v.number}</div>
              <div><strong>{t('Fecha:')}</strong> {v.service_date}</div>
            </div>
          </div>

          <div className="doc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="invoice-bill-to">
              <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t('Pagado a')}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{v.supplier_name}</div>
              {v.supplier_tax_id && <div className="muted">{t('ID / EIN:')} {v.supplier_tax_id}</div>}
              {v.supplier_address && <div className="muted">{v.supplier_address} {v.supplier_city || ''} {v.supplier_zip || ''}</div>}
              {(v.supplier_phone || v.supplier_email) && <div className="muted">{v.supplier_phone} {v.supplier_email}</div>}
            </div>
            <div className="invoice-bill-to">
              <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t('Trabajo realizado en')}</div>
              {v.vehicle_id ? (
                <>
                  <div style={{ fontWeight: 700 }} className="mono"><Link to={`/vehiculos/${v.vehicle_id}`}>{v.vehicle_vin}</Link></div>
                  <div className="muted">{[v.vehicle_make, v.vehicle_model, v.vehicle_year].filter(Boolean).join(' ')}</div>
                  {v.customer_name && <div className="muted">{t('Cliente:')} {v.customer_name}</div>}
                </>
              ) : <div className="muted">—</div>}
              {v.work_order_number && <div><strong>{t('Orden de trabajo:')}</strong> <span className="mono">{v.work_order_number}</span></div>}
            </div>
          </div>

          <div style={{ marginTop: 18, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('Descripción del trabajo')}{v.service_type ? ` — ${v.service_type}` : ''}</div>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.45 }}>{v.description || <span className="muted">{t('(pendiente de describir)')}</span>}</div>
          </div>

          <table style={{ marginTop: 18 }}>
            <thead><tr><th>{t('Fecha del pago')}</th><th>{t('Forma de pago')}</th><th>{t('Referencia')}</th><th className="text-right">{t('Monto')}</th></tr></thead>
            <tbody>
              {v.payments.length === 0
                ? <tr><td colSpan={4} className="muted">{t('Pendiente de pago')}{v.bill_due_date ? ` · ${t('vence')} ${v.bill_due_date}` : ''}</td></tr>
                : v.payments.map((p) => <tr key={p.id}><td>{p.payment_date}</td><td>{methodLabel(t, p.method)}</td><td>{p.reference || '—'}{p.notes ? <div className="muted" style={{ fontSize: 12 }}>{p.notes}</div> : null}<PaymentFiles files={p.files} /></td><td className="text-right">{money(p.amount)}</td></tr>)}
            </tbody>
          </table>
          <div className="invoice-totals">
            <div className="invoice-total-grand"><span>{t('Total del servicio')}</span><span>{money(v.amount)}</span></div>
            {v.balance > 0.004 && <div><span>{t('Saldo por pagar')}</span><span>{money(v.balance)}</span></div>}
          </div>
          {v.notes && <div style={{ marginTop: 10 }}><strong>{t('Notas:')}</strong> {v.notes}</div>}

          <div style={{ marginTop: 18, fontSize: 12 }} className="muted">
            {t('El proveedor declara haber realizado el trabajo descrito y haber recibido el pago indicado como pago total por el servicio, sin expedir factura.')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 50 }}>
            <div style={{ borderTop: '1px solid #0f2742', paddingTop: 6, fontSize: 13 }}>{t('Firma de quien recibe el pago')}<div className="muted">{v.supplier_name}</div></div>
            <div style={{ borderTop: '1px solid #0f2742', paddingTop: 6, fontSize: 13 }}>{t('Autorizado por Nexpro')}<div className="muted">{v.received_by || v.created_by_name || ''}</div></div>
          </div>

          {v.files.length > 0 && (
            <div className="no-print" style={{ marginTop: 20 }}>
              <strong>{t('Archivos adjuntos:')}</strong>
              <div className="file-list">{v.files.map((f, i) => (
                <div className="file-list-item" key={f.id}><a href={f.file_url} target="_blank" rel="noreferrer" title={f.original_name}>📎 {t('Adjunto')} {i + 1}{f.original_name ? ` — ${f.original_name}` : ''}</a>
                  <button type="button" className="link-btn" onClick={() => removeFile(f.id)}>✕</button></div>
              ))}</div>
            </div>
          )}
        </div>
      </div>

      {paying && (
        <PaymentModal title={`${t('Registrar pago')} · ${v.number}`} balance={v.balance} onClose={() => setPaying(false)}
          onSave={async (payload, files) => { setV(await sendPayment('post', `/service-vouchers/${id}/payments`, payload, files)); setPaying(false); }} />
      )}

      {editing && (
        <Modal title={`${t('Editar comprobante')} ${v.number}`} onClose={() => setEditing(null)} wide>
          <form onSubmit={saveEdit} noValidate>
            <div className="grid grid-2">
              <div className="field"><label>{t('Fecha del trabajo')}</label><input type="date" value={editing.serviceDate} onChange={set('serviceDate')} /></div>
              <div className="field"><label>{t('Tipo de servicio')}</label><input value={editing.serviceType} onChange={set('serviceType')} /></div>
              <div className="field"><label>{t('Vehículo (VIN)')}</label>
                <select value={editing.vehicleId} onChange={(e) => setEditing({ ...editing, vehicleId: e.target.value, workOrderId: '' })}>
                  <option value="">{t('— Ninguno —')}</option>
                  {vehicles.map((x) => <option key={x.id} value={x.id}>{x.vin} · {[x.make, x.model, x.year].filter(Boolean).join(' ')}</option>)}
                </select></div>
              <div className="field"><label>{t('Orden de trabajo')}</label>
                <select value={editing.workOrderId} onChange={(e) => { const wo = workOrders.find((w) => String(w.id) === e.target.value); setEditing({ ...editing, workOrderId: e.target.value, vehicleId: wo ? String(wo.vehicle_id) : editing.vehicleId }); }}>
                  <option value="">{t('— Ninguna —')}</option>
                  {workOrders.filter((w) => !editing.vehicleId || String(w.vehicle_id) === String(editing.vehicleId)).map((w) => <option key={w.id} value={w.id}>{w.number} · {w.vin}</option>)}
                </select></div>
              <div className="field"><label>{t('Monto del servicio')}</label><input inputMode="decimal" value={editing.amount} onChange={set('amount')} /></div>
              <div className="field"><label>{t('Recibido / aprobado por (Nexpro)')}</label><input value={editing.receivedBy} onChange={set('receivedBy')} /></div>
            </div>
            <div className="field"><label>{t('Descripción del trabajo realizado')}</label><textarea rows={5} value={editing.description} onChange={set('description')} /></div>
            <div className="field"><label>{t('Notas')}</label><input value={editing.notes} onChange={set('notes')} /></div>
            <div className="field"><label>{t('Agregar fotos o documentos')}</label>
              <input type="file" multiple onChange={async (e) => { const l = Array.from(e.target.files || []); let r = l; try { r = await readFilesNow(l); } catch (_) {} setEditing((cur) => ({ ...cur, files: r })); }} /></div>
            <div className="modal-footer">
              {error && <div className="error-banner" style={{ margin: 0, flexBasis: '100%' }}>{error}</div>}
              <button type="button" className="btn" onClick={() => setEditing(null)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar cambios')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
