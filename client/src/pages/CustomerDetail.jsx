import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import CustomerForm, { customerToForm, ContactFields, EMPTY_CONTACT } from '../crm/CustomerForm.jsx';
import { RolePills, StatusPill } from '../crm/CustomerSnapshot.jsx';
import RequestModal from '../crm/RequestModal.jsx';
import OpportunityModal from '../crm/OpportunityModal.jsx';
import ResendMessage, { canResend } from '../crm/ResendMessage.jsx';
import {
  CONTACT_TYPES, INTERACTION_TYPES, contactTypeLabel, interactionIcon, interactionLabel, channelIcon, money, shortDate,
} from '../crm/constants.js';

const STAGES = ['nuevo', 'calificado', 'propuesta', 'negociacion', 'ganado', 'perdido'];
const KIND = {
  interaccion: { icon: '💬', label: 'Interacción' }, solicitud: { icon: '📥', label: 'Solicitud' }, pedido: { icon: '🧾', label: 'Orden de pedido' },
  factura: { icon: '💵', label: 'Factura' }, pago: { icon: '✅', label: 'Pago' }, vehiculo: { icon: '🚚', label: 'Vehículo recibido' },
  servicio: { icon: '🔧', label: 'Orden de trabajo' }, garantia: { icon: '🛡️', label: 'Garantía' },
};

export default function CustomerDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState(params.get('tab') || 'resumen');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [tlFilter, setTlFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [resend, setResend] = useState(null);
  const [opp, setOpp] = useState(null); // 'nueva' o id
  const openReq = params.get('solicitud');

  function load() { api.get(`/crm/customers/${id}/360`).then(setD).catch((e) => setError(e.message)); }
  useEffect(() => { load(); }, [id]);

  const vehiclesByContact = useMemo(() => {
    const m = {};
    if (d) d.vehicles.forEach((v) => { if (v.contact_id) (m[v.contact_id] = m[v.contact_id] || []).push(v); });
    return m;
  }, [d]);

  if (!d) return <div className="content">{error ? <div className="error-banner">{error}</div> : t('Cargando…')}</div>;
  const c = d.customer; const s = d.summary;

  async function remove() {
    if (!window.confirm(t('¿Eliminar este cliente y todo su historial?'))) return;
    try { await api.del(`/customers/${id}`); navigate('/clientes'); } catch (e) { if (!e.pendingApproval) setError(e.message); }
  }
  const open = (type, initial = {}) => { setForm(initial); setError(''); setModal(type); };
  const submit = (fn) => async (e) => { e.preventDefault(); setError(''); try { await fn(); setModal(null); load(); } catch (err) { if (!err.pendingApproval) setError(err.message); } };

  const saveCustomer = submit(() => api.put(`/customers/${id}`, form));
  const saveContact = submit(() => (form.id ? api.put(`/customers/contacts/${form.id}`, form) : api.post(`/customers/${id}/contacts`, form)));
  const saveInteraction = submit(() => api.post(`/customers/${id}/activities`, { ...form, occurredAt: form.occurredAt ? form.occurredAt.replace('T', ' ') + ':00' : undefined }));
  const saveOpportunity = submit(() => api.post(`/customers/${id}/opportunities`, { stage: 'nuevo', ...form }));

  const editContact = (k) => open('contact', { id: k.id, name: k.name, contactType: k.contact_type || '', role: k.role || '', phone: k.phone || '', mobile: k.mobile || '', email: k.email || '', notes: k.notes || '', isPrimary: !!k.is_primary, active: k.active !== 0 });
  async function delContact(k) { if (window.confirm(`${t('¿Eliminar a')} ${k.name}?`)) { try { await api.del(`/customers/contacts/${k.id}`); load(); } catch (e) { if (!e.pendingApproval) setError(e.message); } } }
  async function toggleDone(a) { await api.put(`/customers/activities/${a.id}`, { done: !a.done }); load(); }
  async function delActivity(a) { try { await api.del(`/customers/activities/${a.id}`); load(); } catch (e) { if (!e.pendingApproval) setError(e.message); } }
  async function setVehicleContact(v, contactId) { await api.put(`/crm/vehicles/${v.id}/contact`, { contactId }); load(); }
  async function updateStage(o, stage) { await api.put(`/customers/opportunities/${o.id}`, { stage }); load(); }
  async function delOpp(o) { try { await api.del(`/customers/opportunities/${o.id}`); load(); } catch (e) { if (!e.pendingApproval) setError(e.message); } }

  const TABS = [
    ['resumen', t('Historial completo')], ['contactos', `${t('Personas')} (${d.contacts.length})`], ['solicitudes', `${t('Solicitudes')} (${d.requests.length})`],
    ['interacciones', `${t('Interacciones')} (${d.interactions.length})`], ['vehiculos', `${t('Vehículos y equipos')} (${d.vehicles.length})`],
    ['ventas', t('Cotizaciones, facturas y pagos')], ['oportunidades', t('Oportunidades')], ['info', t('Datos')],
  ];
  const timeline = d.timeline.filter((e) => !tlFilter || e.kind === tlFilter);
  const filteredReqs = d.requests.filter((r) => !contactFilter || String(r.contact_id) === contactFilter);
  const filteredInts = d.interactions.filter((a) => !contactFilter || String(a.contact_id) === contactFilter);
  const filteredVeh = d.vehicles.filter((v) => !contactFilter || String(v.contact_id) === contactFilter);
  const ContactFilter = () => d.contacts.length > 1 && (
    <select value={contactFilter} onChange={(e) => setContactFilter(e.target.value)} style={{ width: 220 }}>
      <option value="">{t('Todas las personas')}</option>
      {d.contacts.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
    </select>
  );

  return (
    <>
      <div className="topbar">
        <div style={{ minWidth: 0 }}>
          <h1>{c.name}</h1>
          <div className="sub"><RolePills roles={c.roles} /> <StatusPill status={c.status} /> {c.industry && `· ${c.industry}`} {c.aliases && <span className="muted"> · {t('También:')} {c.aliases}</span>}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/clientes" className="btn">{t('← Volver')}</Link>
          <Link to={`/crm/llamada?cliente=${c.id}`} className="btn btn-primary">{t('📞 Nueva solicitud')}</Link>
          <Link to={`/clientes/${c.id}/informe`} className="btn">{t('🖨️ Informe del cliente')}</Link>
          <button className="btn" onClick={() => open('edit', customerToForm(c))}>{t('Editar')}</button>
          <button className="btn btn-danger" onClick={remove}>{t('Eliminar')}</button>
        </div>
      </div>
      <div className="content">
        {error && !modal && <div className="error-banner">{error}</div>}
        <div className="kpi-row">
          <div className="kpi"><div className="label">{t('Facturado total')}</div><div className="value">{money(s.total_invoiced)}</div></div>
          <div className="kpi"><div className="label">{t('Pagado')}</div><div className="value">{money(s.total_paid)}</div></div>
          <div className="kpi"><div className="label">{t('Saldo por cobrar')}</div><div className={`value ${s.balance_due > 0 ? 'alert' : ''}`}>{money(s.balance_due)}</div>{s.overdue > 0 && <div className="text-danger" style={{ fontSize: 12 }}>{t('vencido')} {money(s.overdue)}</div>}</div>
          <div className="kpi"><div className="label">{t('Solicitudes abiertas')}</div><div className="value">{s.open_requests}</div><div className="muted" style={{ fontSize: 12 }}>{s.open_quotes} {t('cotizaciones abiertas')}</div></div>
          <div className="kpi"><div className="label">{t('Vehículos / equipos')}</div><div className="value">{s.vehicles} / {s.equipment}</div><div className="muted" style={{ fontSize: 12 }}>{s.work_orders} {t('órdenes de trabajo')}</div></div>
          <div className="kpi"><div className="label">{t('Última interacción')}</div><div className="value" style={{ fontSize: 18 }}>{shortDate(s.last_interaction)}</div></div>
        </div>

        <div className="tabs" style={{ flexWrap: 'wrap' }}>
          {TABS.map(([k, l]) => <div key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</div>)}
        </div>

        {tab === 'resumen' && (
          <div className="card">
            <div className="card-title">
              {t('Todo lo que ha pasado con este cliente')}
              <select value={tlFilter} onChange={(e) => setTlFilter(e.target.value)} style={{ width: 200 }}>
                <option value="">{t('Todo')}</option>
                {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.icon} {t(v.label)}</option>)}
              </select>
            </div>
            {timeline.length === 0 ? <div className="empty-state">{t('Todavía no hay movimientos.')}</div> : (
              <div className="timeline">
                {timeline.map((e, i) => (
                  <div key={i} className="tl-item">
                    <div className="tl-icon">{e.kind === 'interaccion' ? interactionIcon(e.type) : KIND[e.kind].icon}</div>
                    <div className="tl-body">
                      <div className="tl-top">
                        <span className="muted">{String(e.date || '').slice(0, 16)}</span>
                        <span className="tl-kind">{e.kind === 'interaccion' ? `${t(interactionLabel(e.type))}${e.direction ? ` ${t(e.direction)}` : ''}` : t(KIND[e.kind].label)}</span>
                        {e.status && <Pill value={e.status} />}
                      </div>
                      <div>{e.link ? <Link to={e.link}>{e.title}</Link> : e.title}{e.who && <span className="muted"> — {e.who}</span>}</div>
                      {e.detail && <div className="muted tl-detail" title={t('Clic para ver todo')} onClick={(ev) => ev.currentTarget.classList.toggle('open')}>{e.detail}</div>}
                      {e.by && <div className="muted" style={{ fontSize: 11 }}>{t('registró')} {e.by}</div>}
                      {canResend(e.activity) && <button type="button" className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setResend(e.activity)}>{t('↻ Reenviar')}</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'contactos' && (
          <div className="card">
            <div className="card-title">{t('Personas de este cliente')} <button className="btn btn-sm btn-primary" onClick={() => open('contact', { ...EMPTY_CONTACT })}>{t('+ Agregar persona')}</button></div>
            {d.contacts.length === 0 ? <div className="empty-state">{t('Sin contactos.')}</div> : (
              <div className="contact-cards">
                {d.contacts.map((k) => {
                  const reqs = d.requests.filter((r) => r.contact_id === k.id);
                  const veh = vehiclesByContact[k.id] || [];
                  return (
                    <div key={k.id} className="contact-card" style={{ opacity: k.active === 0 ? 0.55 : 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <strong style={{ fontSize: 15 }}>{k.name}</strong> {k.is_primary ? <span className="pill blue">{t('Principal')}</span> : null} {k.active === 0 && <span className="pill gray">{t('Inactivo')}</span>}
                          <div className="muted" style={{ fontSize: 12.5 }}>{[t(contactTypeLabel(k.contact_type)), k.role].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                        <div className="row-actions">
                          <button className="btn-row-action edit" onClick={() => editContact(k)}>{t('Editar')}</button>
                          <button className="btn-row-action delete" onClick={() => delContact(k)}>{t('Eliminar')}</button>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 6 }}>
                        {k.mobile && <div>📱 <a href={`tel:${k.mobile}`}>{k.mobile}</a></div>}
                        {k.phone && <div>☎️ <a href={`tel:${k.phone}`}>{k.phone}</a></div>}
                        {k.email && <div>✉️ <a href={`mailto:${k.email}`}>{k.email}</a></div>}
                        {k.notes && <div className="muted">{k.notes}</div>}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        {reqs.length} {t('solicitudes')} · {veh.length} {t('vehículos asignados')}
                        {veh.length > 0 && <div>{veh.map((v) => v.vin).join(', ')}</div>}
                      </div>
                      <div className="row-actions" style={{ marginTop: 8 }}>
                        <Link className="btn btn-sm" to={`/crm/llamada?cliente=${c.id}&contacto=${k.id}`}>{t('📞 Nueva solicitud de esta persona')}</Link>
                        <button className="btn btn-sm" onClick={() => { setContactFilter(String(k.id)); setTab('solicitudes'); }}>{t('Ver lo suyo')}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'solicitudes' && (
          <div className="card">
            <div className="card-title">{t('Solicitudes del cliente')} <div style={{ display: 'flex', gap: 8 }}><ContactFilter /><Link className="btn btn-sm btn-primary" to={`/crm/llamada?cliente=${c.id}`}>{t('+ Nueva solicitud')}</Link></div></div>
            {filteredReqs.length === 0 ? <div className="empty-state">{t('Sin solicitudes.')}</div> : (
              <table>
                <thead><tr><th>{t('Número')}</th><th>{t('Fecha')}</th><th>{t('Persona')}</th><th>{t('Lo que pide')}</th><th>{t('Estado')}</th><th>{t('Cotización')}</th></tr></thead>
                <tbody>
                  {filteredReqs.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => setParams({ tab: 'solicitudes', solicitud: r.id })}>
                      <td className="mono">{channelIcon(r.channel)} {r.number}</td><td className="muted">{shortDate(r.created_at)}</td>
                      <td>{r.contact_name || '—'}</td><td>{r.items.map((i) => i.description).join(', ') || r.subject}{r.files && r.files.length > 0 && <span className="muted" style={{ fontSize: 12 }}> · 📎 {r.files.length}</span>}</td>
                      <td><Pill value={r.status} /></td><td>{r.sales_order_number ? `${r.sales_order_number} · ${money(r.sales_order_total)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'interacciones' && (
          <div className="card">
            <div className="card-title">{t('Interacciones y tareas')} <div style={{ display: 'flex', gap: 8 }}><ContactFilter /><button className="btn btn-sm btn-primary" onClick={() => open('interaction', { type: 'llamada', direction: 'entrante' })}>{t('+ Registrar')}</button></div></div>
            {filteredInts.length === 0 ? <div className="empty-state">{t('Sin interacciones.')}</div> : (
              <table>
                <thead><tr><th>✓</th><th>{t('Fecha')}</th><th>{t('Tipo')}</th><th>{t('Persona')}</th><th>{t('Tema')}</th><th>{t('Registró')}</th><th></th></tr></thead>
                <tbody>
                  {filteredInts.map((a) => (
                    <tr key={a.id} style={{ opacity: a.type === 'tarea' && a.done ? 0.5 : 1 }}>
                      <td>{a.type === 'tarea' ? <input type="checkbox" checked={!!a.done} onChange={() => toggleDone(a)} /> : ''}</td>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{String(a.occurred_at || a.created_at).slice(0, 16)}{a.due_date && <div>{t('vence')} {a.due_date}</div>}</td>
                      <td>{interactionIcon(a.type)} {t(interactionLabel(a.type))}{a.direction && <div className="muted" style={{ fontSize: 11 }}>{t(a.direction)}</div>}</td>
                      <td>{a.contact_name || '—'}</td>
                      <td>{a.subject}{a.notes && <div className="muted" style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{a.notes}</div>}</td>
                      <td className="muted">{a.created_by_name || '—'}</td>
                      <td>
                        <div className="row-actions">
                          {canResend(a) && <button className="btn-row-action" onClick={() => setResend(a)}>{t('↻ Reenviar')}</button>}
                          <button className="btn-row-action delete" onClick={() => delActivity(a)}>{t('Eliminar')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'vehiculos' && (
          <>
            <div className="toolbar"><ContactFilter /><Link className="btn btn-sm" to="/vehiculos">{t('Recibir un vehículo')}</Link></div>
            {filteredVeh.length === 0 && <div className="card empty-state">{t('Sin vehículos recibidos.')}</div>}
            {filteredVeh.map((v) => (
              <div key={v.id} className="card">
                <div className="card-title">
                  <span><Link to={`/vehiculos/${v.id}`} className="mono">{v.vin}</Link> <span className="muted" style={{ fontWeight: 400 }}>{[v.year, v.make, v.model, v.plate].filter(Boolean).join(' · ')}</span> <Pill value={v.status} /></span>
                  <select value={v.contact_id || ''} onChange={(e) => setVehicleContact(v, e.target.value)} style={{ width: 220 }} title={t('Persona responsable de este vehículo')}>
                    <option value="">{t('— Persona responsable —')}</option>
                    {d.contacts.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                  </select>
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{t('Recibido')} {shortDate(v.received_at)}</div>
                <div className="form-section" style={{ marginTop: 0 }}>{t('Equipos instalados')}</div>
                {v.equipment.length === 0 ? <div className="muted">—</div> : (
                  <table><thead><tr><th>{t('Equipo')}</th><th>{t('No. de serie')}</th><th>{t('Fabricante')}</th><th>{t('Modelo')}</th></tr></thead>
                    <tbody>{v.equipment.map((e) => <tr key={e.id}><td>{e.type_name || '—'}</td><td className="mono">{e.serial_number || '—'}</td><td>{e.manufacturer || '—'}</td><td>{e.model || '—'}</td></tr>)}</tbody>
                  </table>
                )}
                <div className="form-section">{t('Historial de servicio')}</div>
                {v.work_orders.length === 0 ? <div className="muted">{t('Sin órdenes de trabajo.')}</div> : v.work_orders.map((w) => (
                  <div key={w.id} className="snap-line">
                    <Link to={`/ordenes-trabajo/${w.id}/documento`} className="mono">{w.number}</Link> <Pill value={w.status} /> <span className="muted">{shortDate(w.created_at)} · {w.mechanic_name || w.supplier_name || '—'} · {money(w.total)}{w.invoice_number && ` · ${t('factura')} ${w.invoice_number}`}</span>
                    {(w.services.length > 0 || w.parts.length > 0) && <div style={{ fontSize: 12.5 }}>{[...w.services.map((x) => x.description), ...w.parts.map((x) => `${x.description}${x.serial ? ` S/N ${x.serial}` : ''}`)].join(' · ')}</div>}
                    {w.diagnosis && <div className="muted" style={{ fontSize: 12 }}>{t('Diagnóstico:')} {w.diagnosis}</div>}
                  </div>
                ))}
                {v.warranties.length > 0 && (
                  <>
                    <div className="form-section">{t('Garantías')}</div>
                    {v.warranties.map((w) => <div key={w.id} className="snap-line"><Link to={`/garantias/${w.id}/documento`} className="mono">{w.number}</Link> <Pill value={w.status} /> {w.item_description} {w.serial_number && `S/N ${w.serial_number}`}</div>)}
                  </>
                )}
              </div>
            ))}
            {d.serials.length > 0 && (
              <div className="card">
                <div className="card-title">{t('Equipos vendidos con número de serie')}</div>
                <table><thead><tr><th>{t('Producto')}</th><th>{t('No. de serie')}</th><th>{t('Estado')}</th><th>{t('Factura')}</th><th>VIN</th></tr></thead>
                  <tbody>{d.serials.map((x) => <tr key={x.id}><td>{x.product_name}</td><td className="mono">{x.serial}</td><td><Pill value={x.status} /></td><td>{x.invoice_number || '—'}</td><td className="mono">{x.vin || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'ventas' && (
          <>
            <div className="card">
              <div className="card-title">{t('Órdenes de pedido / cotizaciones')}</div>
              {d.salesOrders.length === 0 ? <div className="muted">—</div> : (
                <table><thead><tr><th>{t('Número')}</th><th>{t('Fecha')}</th><th>{t('Persona')}</th><th>{t('Solicitud')}</th><th>{t('Estado')}</th><th className="text-right">{t('Total')}</th></tr></thead>
                  <tbody>{d.salesOrders.map((so) => (
                    <tr key={so.id}><td><Link to={`/pedidos/${so.id}/documento`} className="mono">{so.number}</Link></td><td className="muted">{shortDate(so.created_at)}</td><td>{so.contact_name || '—'}</td><td className="mono">{so.request_number || '—'}</td><td><Pill value={so.status} /></td><td className="text-right">{money(so.total)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="card">
              <div className="card-title">{t('Facturas')}</div>
              {d.invoices.length === 0 ? <div className="muted">—</div> : (
                <table><thead><tr><th>{t('Número')}</th><th>{t('Fecha')}</th><th>{t('Vence')}</th><th>{t('Estado')}</th><th className="text-right">{t('Total')}</th><th className="text-right">{t('Pagado')}</th><th className="text-right">{t('Saldo')}</th></tr></thead>
                  <tbody>{d.invoices.map((i) => (
                    <tr key={i.id}><td><Link to={`/facturas/${i.id}`} className="mono">{i.number}</Link></td><td className="muted">{shortDate(i.issue_date)}</td><td className="muted">{shortDate(i.due_date)}</td><td><Pill value={i.status} /></td>
                      <td className="text-right">{money(i.total)}</td><td className="text-right">{money(i.paid)}</td><td className={`text-right ${i.balance > 0.004 ? 'text-danger' : ''}`}>{money(i.balance)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="card">
              <div className="card-title">{t('Pagos recibidos')}</div>
              {d.payments.length === 0 ? <div className="muted">—</div> : (
                <table><thead><tr><th>{t('Fecha')}</th><th>{t('Factura')}</th><th>{t('Método')}</th><th>{t('Referencia')}</th><th className="text-right">{t('Monto')}</th></tr></thead>
                  <tbody>{d.payments.map((p) => <tr key={p.id}><td className="muted">{shortDate(p.payment_date)}</td><td><Link to={`/facturas/${p.invoice_id}`} className="mono">{p.invoice_number}</Link></td><td>{p.method || '—'}</td><td>{p.reference || '—'}</td><td className="text-right">{money(p.amount)}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'oportunidades' && (
          <div className="card">
            <div className="card-title">{t('Oportunidades')} <button className="btn btn-sm btn-primary" onClick={() => setOpp('nueva')}>{t('+ Agregar')}</button></div>
            {d.opportunities.length === 0 ? <div className="empty-state">{t('Sin oportunidades.')}</div> : (
              <table>
                <thead><tr><th>{t('Título')}</th><th>{t('Valor')}</th><th>{t('Prob.')}</th><th>{t('Cierre esperado')}</th><th>{t('Etapa')}</th><th>{t('Documentos')}</th><th>{t('Cotización ERP')}</th><th></th></tr></thead>
                <tbody>{d.opportunities.map((o) => (
                  <tr key={o.id} className="clickable" onClick={() => setOpp(o.id)}><td><strong>{o.title}</strong></td><td>{o.value ? money(o.value) : '—'}</td><td>{o.probability != null ? `${o.probability}%` : '—'}</td><td>{o.expected_close || '—'}</td>
                    <td onClick={(e) => e.stopPropagation()}><select value={o.stage} onChange={(e) => updateStage(o, e.target.value)} style={{ width: 150 }}>{STAGES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></td>
                    <td>{o.files_count ? `📎 ${o.files_count}` : <span className="muted">—</span>}</td>
                    <td onClick={(e) => e.stopPropagation()}>{o.sales_order_id ? <Link to={`/pedidos?abrir=${o.sales_order_id}`} className="mono">{o.sales_order_number}</Link> : <span className="muted">—</span>}</td>
                    <td onClick={(e) => e.stopPropagation()}><div className="row-actions"><button className="btn-row-action" onClick={() => setOpp(o.id)}>{t('Abrir')}</button><button className="btn-row-action delete" onClick={() => delOpp(o)}>{t('Eliminar')}</button></div></td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'info' && (
          <div className="card grid grid-2">
            <div><strong>{t('Email:')}</strong> {c.email || '—'}</div>
            <div><strong>{t('Teléfono:')}</strong> {[c.phone, c.phone2].filter(Boolean).join(' · ') || '—'}</div>
            <div><strong>{t('Dirección:')}</strong> {[c.address, c.city, c.state, c.zip].filter(Boolean).join(', ') || '—'}</div>
            <div><strong>{t('NIT / ID:')}</strong> {c.tax_id || '—'}</div>
            <div><strong>{t('Sitio web')}:</strong> {c.website || '—'}</div>
            <div><strong>{t('Fuente:')}</strong> {c.source || '—'}</div>
            <div><strong>{t('Idioma para los correos')}:</strong> {c.preferred_language === 'es' ? 'Español' : 'English'}</div>
            <div><strong>{t('Proveedor enlazado')}:</strong> {c.supplier ? `${c.supplier.name}${c.supplier.code ? ` (${c.supplier.code})` : ''}` : '—'}</div>
            <div><strong>{t('Cliente desde')}:</strong> {shortDate(s.first_invoice || c.created_at)}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>{t('Notas:')}</strong> {c.notes || '—'}</div>
          </div>
        )}
      </div>

      {modal === 'edit' && (
        <Modal title={t('Registro de Contacto')} onClose={() => setModal(null)} wide>
          <form onSubmit={saveCustomer}>
            {error && <div className="error-banner">{error}</div>}
            <CustomerForm form={form} setForm={setForm} excludeId={c.id} onUseExisting={(x) => { setModal(null); navigate(`/clientes/${x.id}`); }} />
            <div className="modal-footer"><button type="button" className="btn" onClick={() => setModal(null)}>{t('Cancelar')}</button><button type="submit" className="btn btn-primary">{t('Guardar')}</button></div>
          </form>
        </Modal>
      )}

      {modal === 'contact' && (
        <Modal title={form.id ? t('Editar persona') : t('Nueva persona')} onClose={() => setModal(null)} wide>
          <form onSubmit={saveContact}>
            {error && <div className="error-banner">{error}</div>}
            <ContactFields value={form} onChange={setForm} required />
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <label className="check-line"><input type="checkbox" checked={!!form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })} /> {t('Contacto principal')}</label>
            {form.id && <label className="check-line"><input type="checkbox" checked={form.active !== false} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> {t('Activo (desmarcar si ya no trabaja ahí)')}</label>}
            <div className="modal-footer"><button type="button" className="btn" onClick={() => setModal(null)}>{t('Cancelar')}</button><button type="submit" className="btn btn-primary">{t('Guardar')}</button></div>
          </form>
        </Modal>
      )}

      {modal === 'interaction' && (
        <Modal title={t('Registrar interacción o tarea')} onClose={() => setModal(null)}>
          <form onSubmit={saveInteraction}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field"><label>{t('Tipo *')}</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {INTERACTION_TYPES.map((x) => <option key={x.key} value={x.key}>{x.icon} {t(x.label)}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Persona')}</label>
                <select value={form.contactId || ''} onChange={(e) => setForm({ ...form, contactId: e.target.value })}>
                  <option value="">—</option>
                  {d.contacts.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              {form.type !== 'nota' && form.type !== 'tarea' && (
                <div className="field"><label>{t('Dirección')}</label>
                  <select value={form.direction || ''} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                    <option value="entrante">{t('entrante')}</option><option value="saliente">{t('saliente')}</option>
                  </select>
                </div>
              )}
              <div className="field"><label>{t('Fecha y hora')}</label><input type="datetime-local" value={form.occurredAt || ''} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} /></div>
              {form.type === 'tarea' && <div className="field"><label>{t('Fecha límite')}</label><input type="date" value={form.dueDate || ''} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>}
            </div>
            <div className="field"><label>{t('Tema de la conversación *')}</label><input required value={form.subject || ''} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t('p. ej. Preguntó por grúa 10 ton para F-550')} /></div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-footer"><button type="button" className="btn" onClick={() => setModal(null)}>{t('Cancelar')}</button><button type="submit" className="btn btn-primary">{t('Guardar')}</button></div>
          </form>
        </Modal>
      )}

      {modal === 'opportunity' && (
        <Modal title={t('Nueva oportunidad')} onClose={() => setModal(null)}>
          <form onSubmit={saveOpportunity}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>{t('Título *')}</label><input required onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Valor estimado ($)')}</label><input type="number" step="0.01" onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div className="field"><label>{t('Probabilidad (%)')}</label><input type="number" min="0" max="100" onChange={(e) => setForm({ ...form, probability: e.target.value })} /></div>
              <div className="field"><label>{t('Etapa')}</label><select value={form.stage || 'nuevo'} onChange={(e) => setForm({ ...form, stage: e.target.value })}>{STAGES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></div>
              <div className="field"><label>{t('Cierre esperado')}</label><input type="date" onChange={(e) => setForm({ ...form, expectedClose: e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-footer"><button type="button" className="btn" onClick={() => setModal(null)}>{t('Cancelar')}</button><button type="submit" className="btn btn-primary">{t('Guardar')}</button></div>
          </form>
        </Modal>
      )}

      {opp && <OpportunityModal customerId={c.id} opportunityId={opp === 'nueva' ? null : opp} onClose={() => setOpp(null)} onChanged={load} />}
      {resend && <ResendMessage activity={resend} customerId={c.id} onClose={() => setResend(null)} onSent={load} />}
      {openReq && <RequestModal id={openReq} onClose={() => setParams({ tab: 'solicitudes' })} onChanged={load} />}
    </>
  );
}
