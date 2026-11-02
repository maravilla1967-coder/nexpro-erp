import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import CatalogQuickPick from './CatalogQuickPick.jsx';
import MessageComposer from './MessageComposer.jsx';
import RequestFiles from './RequestFiles.jsx';
import { REQUEST_STATUSES, PRIORITIES, CHANNELS, channelIcon, interactionIcon, contactTypeLabel, money, shortDate } from './constants.js';

const toForm = (i) => ({ kind: i.kind, productId: i.product_id, serviceId: i.service_id, productTypeId: i.product_type_id, equipmentTypeId: i.equipment_type_id, description: i.description, quantity: i.quantity });

// Detalle de una solicitud: revisar lo que pidió, ajustar, crear/completar la orden de pedido,
// enviar acuse o cotización por el mismo medio por donde llegó, y cambiar el estado.
export default function RequestModal({ id, onClose, onChanged }) {
  const { t } = useI18n();
  const [r, setR] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [editItems, setEditItems] = useState(null);
  const [composer, setComposer] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get(`/crm/requests/${id}`).then((x) => {
      setR(x);
      api.get(`/customers/${x.customer_id}`).then((c) => setContacts(c.contacts)).catch(() => {});
    }).catch((e) => setError(e.message));
  }
  const loadCatalog = () => api.get('/crm/catalog').then(setCatalog).catch(() => {});
  useEffect(() => { load(); loadCatalog(); }, [id]);

  async function update(patch) {
    setError('');
    try { const x = await api.put(`/crm/requests/${id}`, patch); setR(x); onChanged && onChanged(); } catch (e) { if (!e.pendingApproval) setError(e.message); }
  }
  async function saveItems() {
    await update({ items: editItems.map((i) => ({ ...i, quantity: parseFloat(i.quantity) || 1 })) });
    setEditItems(null);
  }
  async function makeQuote() {
    setError('');
    try { const x = await api.post(`/crm/requests/${id}/quote`, {}); setR(x.request); onChanged && onChanged(); } catch (e) { setError(e.message); }
  }
  async function remove() {
    if (!window.confirm(t('¿Eliminar esta solicitud? La orden de pedido (si existe) no se borra.'))) return;
    try { await api.del(`/crm/requests/${id}`); onChanged && onChanged(); onClose(); } catch (e) { if (!e.pendingApproval) setError(e.message); }
  }

  if (!r) return <Modal title={t('Solicitud')} onClose={onClose}>{error ? <div className="error-banner">{error}</div> : t('Cargando…')}</Modal>;
  const soEditable = r.sales_order_id && r.sales_order_status === 'borrador';

  return (
    <Modal title={`${t('Solicitud')} ${r.number}`} onClose={onClose} xwide>
      {error && <div className="error-banner">{error}</div>}
      <div className="req-head">
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}><Link to={`/clientes/${r.customer_id}`}>{r.customer_name}</Link></div>
          <div className="muted" style={{ fontSize: 13 }}>
            {channelIcon(r.channel)} {t(CHANNELS.find((c) => c.key === r.channel)?.label || r.channel)} · {shortDate(r.created_at)} {String(r.created_at).slice(11, 16)}
            {r.created_by_name && ` · ${t('registró')} ${r.created_by_name}`}
            {r.vehicle_vin && ` · VIN ${r.vehicle_vin}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={r.status} onChange={(e) => update({ status: e.target.value })} style={{ width: 140 }}>
            {REQUEST_STATUSES.map((s) => <option key={s} value={s}>{t(s.replace('_', ' '))}</option>)}
          </select>
          <select value={r.priority} onChange={(e) => update({ priority: e.target.value })} style={{ width: 120 }}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{t(p)}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 12 }}>
        <div>
          <div className="field">
            <label>{t('Persona')}</label>
            <select value={r.contact_id || ''} onChange={(e) => update({ contactId: e.target.value })}>
              <option value="">—</option>
              {contacts.map((k) => <option key={k.id} value={k.id}>{k.name}{k.contact_type ? ` (${t(contactTypeLabel(k.contact_type))})` : ''}</option>)}
            </select>
            {r.contact_id && <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{[r.contact_mobile || r.contact_phone, r.contact_email].filter(Boolean).join(' · ')}</div>}
          </div>
          <div className="field"><label>{t('Responder a')}</label><input defaultValue={r.reply_to || ''} onBlur={(e) => e.target.value !== (r.reply_to || '') && update({ replyTo: e.target.value })} /></div>
          <div className="field"><label>{t('Asunto')}</label><input defaultValue={r.subject || ''} onBlur={(e) => e.target.value !== (r.subject || '') && update({ subject: e.target.value })} /></div>
          <div className="field"><label>{t('Detalles')}</label><textarea rows={4} defaultValue={r.notes || ''} onBlur={(e) => e.target.value !== (r.notes || '') && update({ notes: e.target.value })} /></div>
        </div>
        <div>
          <div className="form-section" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('Lo que pide')}</span>
            {!editItems && <button type="button" className="link-btn" onClick={() => setEditItems(r.items.map(toForm))}>{t('Editar')}</button>}
          </div>
          {editItems ? (
            <>
              <CatalogQuickPick catalog={catalog} value={editItems} onChange={setEditItems} onCatalogChange={loadCatalog} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-sm" onClick={() => setEditItems(null)}>{t('Cancelar')}</button>
                <button type="button" className="btn btn-sm btn-primary" onClick={saveItems}>{t('Guardar')}</button>
              </div>
            </>
          ) : (
            r.items.length === 0 ? <div className="muted">{t('Nada escogido todavía.')}</div> : (
              <table>
                <tbody>
                  {r.items.map((i) => (
                    <tr key={i.id}><td style={{ width: 60 }} className="muted">{i.quantity}</td><td>{i.description}</td><td className="muted" style={{ fontSize: 12 }}>{t({ producto: 'Producto', servicio: 'Servicio', categoria: 'Categoría', equipo: 'Equipo', libre: 'Otro' }[i.kind])}</td></tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          <div className="form-section">{t('Cotización')}</div>
          {r.sales_order_id ? (
            <div>
              <div><Link to={`/pedidos?abrir=${r.sales_order_id}`} className="mono">{r.sales_order_number}</Link> <Pill value={r.sales_order_status} /> · {money(r.sales_order_total)}</div>
              <div className="row-actions" style={{ marginTop: 8 }}>
                <Link className="btn btn-sm" to={`/pedidos?abrir=${r.sales_order_id}`}>{t('Revisar precios')}</Link>
                <Link className="btn btn-sm" to={`/pedidos/${r.sales_order_id}/documento`}>{t('🖨️ PDF de la cotización')}</Link>
                {soEditable && <button type="button" className="btn btn-sm" onClick={makeQuote}>{t('Traer ítems nuevos de la solicitud')}</button>}
              </div>
              {soEditable && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t('Está en borrador: revisa cada precio (lo "por cotizar" va en $0) antes de enviarla.')}</div>}
            </div>
          ) : (
            <button type="button" className="btn btn-sm btn-primary" onClick={makeQuote} disabled={!r.items.length}>{t('Crear orden de pedido para cotizar')}</button>
          )}
        </div>
      </div>

      <div className="form-section">{t('Documentos y fotos')} ({(r.files || []).length})</div>
      <RequestFiles request={r} onChanged={(x) => { setR(x); onChanged && onChanged(); }} />

      <div className="form-section">{t('Historial de esta solicitud')}</div>
      {r.interactions.length === 0 ? <div className="muted">—</div> : r.interactions.map((a) => (
        <div key={a.id} className="snap-line">
          {interactionIcon(a.type)} <span className="muted">{String(a.occurred_at || a.created_at).slice(0, 16)}</span> {a.subject}
          {a.created_by_name && <span className="muted"> — {a.created_by_name}</span>}
        </div>
      ))}

      <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-danger" onClick={remove} style={{ marginRight: 'auto' }}>{t('Eliminar')}</button>
        <button type="button" className="btn" onClick={() => setComposer('acuse')}>{r.ack_sent_at ? t('✓ Acuse enviado — reenviar') : t('✉️ Enviar acuse de recibo')}</button>
        <button type="button" className="btn btn-primary" onClick={() => setComposer('cotizacion')} disabled={!r.sales_order_id}>
          {r.quote_sent_at ? t('✓ Cotización enviada — reenviar') : t('📤 Enviar cotización')}
        </button>
      </div>
      {composer && <MessageComposer request={r} kind={composer} onClose={() => setComposer(null)} onSent={(x) => { setR(x); onChanged && onChanged(); }} />}
    </Modal>
  );
}
