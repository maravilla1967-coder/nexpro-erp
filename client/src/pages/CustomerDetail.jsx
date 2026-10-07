import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';

const STAGES = ['nuevo', 'calificado', 'propuesta', 'negociacion', 'ganado', 'perdido'];

export default function CustomerDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [tab, setTab] = useState('info');
  const [modal, setModal] = useState(null); // 'contact' | 'opportunity' | 'activity'
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  function load() {
    api.get(`/customers/${id}`).then(setCustomer).catch(console.error);
  }
  useEffect(() => { load(); }, [id]);

  async function remove() {
    if (!window.confirm(t('¿Eliminar este cliente y todo su historial?'))) return;
    await api.del(`/customers/${id}`);
    navigate('/clientes');
  }

  function openModal(type, initial = {}) { setForm(initial); setError(''); setModal(type); }

  async function submitContact(e) {
    e.preventDefault();
    try { await api.post(`/customers/${id}/contacts`, form); setModal(null); load(); }
    catch (err) { setError(err.message); }
  }
  async function submitOpportunity(e) {
    e.preventDefault();
    try { await api.post(`/customers/${id}/opportunities`, form); setModal(null); load(); }
    catch (err) { setError(err.message); }
  }
  async function submitActivity(e) {
    e.preventDefault();
    try { await api.post(`/customers/${id}/activities`, form); setModal(null); load(); }
    catch (err) { setError(err.message); }
  }

  async function updateOpportunityStage(oppId, stage) {
    await api.put(`/customers/opportunities/${oppId}`, { stage });
    load();
  }
  async function toggleActivityDone(act) {
    await api.put(`/customers/activities/${act.id}`, { done: !act.done });
    load();
  }
  async function deleteContact(cid) { await api.del(`/customers/contacts/${cid}`); load(); }
  async function deleteOpportunity(oid) { await api.del(`/customers/opportunities/${oid}`); load(); }
  async function deleteActivity(aid) { await api.del(`/customers/activities/${aid}`); load(); }

  if (!customer) return <div className="content">{t('Cargando…')}</div>;

  const TAB_LABELS = {
    info: t('Info'),
    contactos: t('Contactos'),
    oportunidades: t('Oportunidades'),
    actividades: t('Actividades'),
    vehiculos: t('Vehiculos'),
  };

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{customer.name}</h1>
          <div className="sub">{customer.industry || t('Sin industria')} · <Pill value={customer.status} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/clientes" className="btn">{t('← Volver')}</Link>
          <button className="btn btn-danger" onClick={remove}>{t('Eliminar')}</button>
        </div>
      </div>
      <div className="content">
        <div className="tabs">
          {['info', 'contactos', 'oportunidades', 'actividades', 'vehiculos'].map((tk) => (
            <div key={tk} className={`tab ${tab === tk ? 'active' : ''}`} onClick={() => setTab(tk)}>
              {TAB_LABELS[tk]}
            </div>
          ))}
        </div>

        {tab === 'info' && (
          <div className="card grid grid-2">
            <div><strong>{t('Email:')}</strong> {customer.email || '—'}</div>
            <div><strong>{t('Teléfono:')}</strong> {customer.phone || '—'}</div>
            <div><strong>{t('Dirección:')}</strong> {customer.address || '—'}</div>
            <div><strong>{t('Ciudad')}:</strong> {customer.city || '—'}</div>
            <div><strong>{t('NIT / ID:')}</strong> {customer.tax_id || '—'}</div>
            <div><strong>{t('Fuente:')}</strong> {customer.source || '—'}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>{t('Notas:')}</strong> {customer.notes || '—'}</div>
          </div>
        )}

        {tab === 'contactos' && (
          <div className="card">
            <div className="card-title">{t('Contactos')} <button className="btn btn-sm btn-primary" onClick={() => openModal('contact')}>{t('+ Agregar')}</button></div>
            {customer.contacts.length === 0 ? <div className="empty-state">{t('Sin contactos.')}</div> : (
              <table>
                <thead><tr><th>{t('Nombre')}</th><th>{t('Cargo')}</th><th>{t('Email')}</th><th>{t('Teléfono')}</th><th></th></tr></thead>
                <tbody>
                  {customer.contacts.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td><td>{c.role || '—'}</td><td>{c.email || '—'}</td><td>{c.phone || '—'}</td>
                      <td><button className="link-btn" onClick={() => deleteContact(c.id)}>{t('Eliminar')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'oportunidades' && (
          <div className="card">
            <div className="card-title">{t('Oportunidades')} <button className="btn btn-sm btn-primary" onClick={() => openModal('opportunity')}>{t('+ Agregar')}</button></div>
            {customer.opportunities.length === 0 ? <div className="empty-state">{t('Sin oportunidades.')}</div> : (
              <table>
                <thead><tr><th>{t('Título')}</th><th>{t('Valor')}</th><th>{t('Prob.')}</th><th>{t('Cierre esperado')}</th><th>{t('Etapa')}</th><th></th></tr></thead>
                <tbody>
                  {customer.opportunities.map((o) => (
                    <tr key={o.id}>
                      <td>{o.title}</td>
                      <td>{o.value ? `$${Number(o.value).toLocaleString()}` : '—'}</td>
                      <td>{o.probability != null ? `${o.probability}%` : '—'}</td>
                      <td>{o.expected_close || '—'}</td>
                      <td>
                        <select value={o.stage} onChange={(e) => updateOpportunityStage(o.id, e.target.value)} style={{ width: 150 }}>
                          {STAGES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                        </select>
                      </td>
                      <td><button className="link-btn" onClick={() => deleteOpportunity(o.id)}>{t('Eliminar')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'actividades' && (
          <div className="card">
            <div className="card-title">{t('Actividades')} / {t('Tarea')} <button className="btn btn-sm btn-primary" onClick={() => openModal('activity')}>{t('+ Agregar')}</button></div>
            {customer.activities.length === 0 ? <div className="empty-state">{t('Sin actividades.')}</div> : (
              <table>
                <thead><tr><th>✓</th><th>{t('Tipo')}</th><th>{t('Asunto')}</th><th>{t('Fecha')}</th><th>{t('Notas')}</th><th></th></tr></thead>
                <tbody>
                  {customer.activities.map((a) => (
                    <tr key={a.id} style={{ opacity: a.done ? 0.5 : 1 }}>
                      <td><input type="checkbox" checked={!!a.done} onChange={() => toggleActivityDone(a)} /></td>
                      <td>{a.type}</td><td>{a.subject}</td><td>{a.due_date || '—'}</td><td className="muted">{a.notes || '—'}</td>
                      <td><button className="link-btn" onClick={() => deleteActivity(a.id)}>{t('Eliminar')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'vehiculos' && (
          <div className="card">
            <div className="card-title">{t('Vehículos de este cliente')}</div>
            {customer.vehicles.length === 0 ? <div className="empty-state">{t('Sin vehículos recibidos.')}</div> : (
              <table>
                <thead><tr><th>VIN</th><th>{t('Vehículo')}</th><th>{t('Estado')}</th></tr></thead>
                <tbody>
                  {customer.vehicles.map((v) => (
                    <tr key={v.id}>
                      <td><Link to={`/vehiculos/${v.id}`}>{v.vin}</Link></td>
                      <td>{v.make} {v.model} {v.year}</td>
                      <td><Pill value={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {modal === 'contact' && (
        <Modal title={t('Nuevo contacto')} onClose={() => setModal(null)}>
          <form onSubmit={submitContact}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>{t('Nombre *')}</label><input required onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>{t('Cargo')}</label><input onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
            <div className="field"><label>{t('Email')}</label><input type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>{t('Teléfono')}</label><input onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModal(null)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'opportunity' && (
        <Modal title={t('Nueva oportunidad')} onClose={() => setModal(null)}>
          <form onSubmit={submitOpportunity}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>{t('Título *')}</label><input required onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Valor estimado ($)')}</label><input type="number" step="0.01" onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
              <div className="field"><label>{t('Probabilidad (%)')}</label><input type="number" min="0" max="100" onChange={(e) => setForm({ ...form, probability: e.target.value })} /></div>
              <div className="field"><label>{t('Etapa')}</label>
                <select onChange={(e) => setForm({ ...form, stage: e.target.value })} defaultValue="nuevo">
                  {STAGES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Cierre esperado')}</label><input type="date" onChange={(e) => setForm({ ...form, expectedClose: e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModal(null)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'activity' && (
        <Modal title={t('Nueva actividad')} onClose={() => setModal(null)}>
          <form onSubmit={submitActivity}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field"><label>{t('Tipo *')}</label>
                <select required onChange={(e) => setForm({ ...form, type: e.target.value })} defaultValue="llamada">
                  <option value="llamada">{t('Llamada')}</option>
                  <option value="email">{t('Email')}</option>
                  <option value="reunion">{t('Reunión')}</option>
                  <option value="nota">{t('Nota')}</option>
                  <option value="tarea">{t('Tarea')}</option>
                </select>
              </div>
              <div className="field"><label>{t('Fecha límite')}</label><input type="date" onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Asunto *')}</label><input required onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModal(null)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
