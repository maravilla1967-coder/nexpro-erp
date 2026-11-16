import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
import CustomerForm, { EMPTY_CUSTOMER, EMPTY_CONTACT } from '../crm/CustomerForm.jsx';
import { RolePills, StatusPill } from '../crm/CustomerSnapshot.jsx';
import { ROLES, CUSTOMER_STATUSES, shortDate } from '../crm/constants.js';
import { useOpenOptions } from '../crm/OpenSelect.jsx';
const CUSTOMER_COLUMNS = [
  { label: 'Nombre', value: (r) => r.name },
  { label: 'Tipo', value: (r) => r.type },
  { label: 'Relación', value: (r) => r.roles },
  { label: 'Otros nombres', value: (r) => r.aliases },
  { label: 'NIT', value: (r) => r.tax_id },
  { label: 'Industria', value: (r) => r.industry },
  { label: 'Email', value: (r) => r.email },
  { label: 'Teléfono', value: (r) => r.phone },
  { label: 'Dirección', value: (r) => r.address },
  { label: 'Ciudad', value: (r) => r.city },
  { label: 'ZIP', value: (r) => r.zip },
  { label: 'Estado', value: (r) => r.status },
];

export default function CustomersList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const ex = useListExport({ rows: list });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [statusOptions] = useOpenOptions('customer_status', CUSTOMER_STATUSES);
  const [role, setRole] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_CUSTOMER);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [error, setError] = useState('');

  function load() {
    api.get('/customers', { q, status, role }).then(setList).catch(console.error);
  }
  useEffect(() => { load(); }, [q, status, role]);

  function openNew() { setForm({ ...EMPTY_CUSTOMER, name: q }); setContact(EMPTY_CONTACT); setError(''); setModalOpen(true); }

  async function save(e) {
    e.preventDefault();
    try {
      const c = await api.post('/customers', { ...form, firstContact: contact });
      setModalOpen(false);
      navigate(`/clientes/${c.id}`);
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t('Clientes (CRM)')}</h1>
          <div className="sub">{t('Clientes, clientes potenciales, proveedores y dealers')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/crm/llamada" className="btn">{t('📞 Atender llamada')}</Link>
          <button className="btn btn-primary" onClick={openNew}>{t('+ Nuevo contacto')}</button>
        </div>
      </div>
      <div className="content">
        <div className="toolbar">
          <input className="search-input" placeholder={t('Buscar por nombre, alias, persona, email, teléfono…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="seg">
            <button type="button" className={`seg-btn ${role === '' ? 'active' : ''}`} onClick={() => setRole('')}>{t('Todos')}</button>
            {ROLES.map((r) => <button key={r.key} type="button" className={`seg-btn ${role === r.key ? 'active' : ''}`} onClick={() => setRole(r.key)}>{t(r.label)}</button>)}
          </div>
          <select style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('Todos los estados')}</option>
            {statusOptions.map((o) => <option key={o.key} value={o.key}>{t(o.label)}</option>)}
          </select>
        </div>
        <div className="card">
          {list.length === 0 ? (
            <div className="empty-state">{t('No hay clientes todavía. Crea el primero con "+ Nuevo cliente".')}</div>
          ) : (
            <><ListExportBar ex={ex} title={t('Clientes')} filename="clientes" columns={CUSTOMER_COLUMNS} />
            <table>
              <thead>
                <tr><th><SelectAllBox ex={ex} /></th><th>{t('Nombre')}</th><th>{t('Relación')}</th><th>{t('Contacto')}</th><th>{t('Personas')}</th><th>{t('Solicitudes abiertas')}</th><th>{t('Última interacción')}</th><th>{t('Estado')}</th></tr>
              </thead>
              <tbody>
                {ex.visible.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td onClick={(e) => e.stopPropagation()}><RowBox ex={ex} row={c} /></td>
                    <td><Link to={`/clientes/${c.id}`}>{c.name}</Link>{c.aliases && <div className="muted" style={{ fontSize: 11.5 }}>{c.aliases}</div>}</td>
                    <td><RolePills roles={c.roles} /></td>
                    <td className="muted">{c.phone || c.email || '—'}{c.city && <div style={{ fontSize: 11.5 }}>{c.city}</div>}</td>
                    <td className="muted">{c.contacts_count || 0}</td>
                    <td>{c.open_requests ? <span className="pill amber">{c.open_requests}</span> : <span className="muted">—</span>}</td>
                    <td className="muted">{shortDate(c.last_interaction)}</td>
                    <td><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table></>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={t('Registro Nuevo Contacto')} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <CustomerForm form={form} setForm={setForm} withContact contact={contact} setContact={setContact}
              onUseExisting={(d) => { setModalOpen(false); navigate(`/clientes/${d.id}`); }} />
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
