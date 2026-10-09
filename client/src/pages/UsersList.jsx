import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';

const MODULES = [
  { key: 'clientes', label: 'Clientes (CRM)' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'compras', label: 'Órdenes de Compra' },
  { key: 'pedidos', label: 'Órdenes de Pedido' },
  { key: 'facturas', label: 'Facturación' },
  { key: 'vehiculos', label: 'Recepción de Vehículos' },
  { key: 'servicios', label: 'Catálogo de Servicios' },
  { key: 'mecanicos', label: 'Mecánicos' },
  { key: 'ordenes_trabajo', label: 'Órdenes de Trabajo' },
];

const EMPTY = { name: '', email: '', role: 'usuario', modules: {} };

export default function UsersList() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [inviteInfo, setInviteInfo] = useState(null); // { name, email, link }
  const [copied, setCopied] = useState(false);

  function load() { api.get('/users').then(setList).catch(console.error); }
  useEffect(() => { load(); }, []);

  function openNew() { setEditingId(null); setForm(EMPTY); setError(''); setModalOpen(true); }

  function openEdit(u) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, modules: { ...u.permissions } });
    setError('');
    setModalOpen(true);
  }

  function toggleModule(key) {
    setForm({ ...form, modules: { ...form.modules, [key]: !form.modules[key] } });
  }

  function buildLink(token) {
    return `${window.location.origin}/invitacion/${token}`;
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    const modulesPayload = Object.entries(form.modules)
      .filter(([, canEdit]) => canEdit)
      .map(([module]) => ({ module, canEdit: true }));
    try {
      if (editingId) {
        await api.put(`/users/${editingId}`, { name: form.name, role: form.role, modules: modulesPayload });
      } else {
        const res = await api.post('/users', { name: form.name, email: form.email, role: form.role, modules: modulesPayload });
        setInviteInfo({ name: res.name, email: res.email, link: buildLink(res.inviteToken) });
      }
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message); }
  }

  async function reinvite(u) {
    try {
      const res = await api.post(`/users/${u.id}/reinvite`);
      setInviteInfo({ name: u.name, email: u.email, link: buildLink(res.inviteToken) });
      load();
    } catch (err) { alert(err.message); }
  }

  async function toggleStatus(u) {
    const next = u.status === 'desactivado' ? 'activo' : 'desactivado';
    try {
      await api.put(`/users/${u.id}`, { status: next });
      load();
    } catch (err) { alert(err.message); }
  }

  async function removeUser(u) {
    if (!window.confirm(t('¿Eliminar este usuario?'))) return;
    try {
      await api.del(`/users/${u.id}`);
      load();
    } catch (err) { alert(err.message); }
  }

  function copyLink() {
    navigator.clipboard?.writeText(inviteInfo.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t('Usuarios')}</h1>
          <div className="sub">{t('Da acceso a tu equipo y controla qué puede editar cada uno')}</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>{t('+ Nuevo usuario')}</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? (
            <div className="empty-state">{t('No hay usuarios todavía.')}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('Nombre')}</th><th>Email</th><th>{t('Rol')}</th><th>{t('Estado')}</th>
                  <th>{t('Módulos con edición')}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td className="muted">{u.email}</td>
                    <td><Pill value={u.role} /></td>
                    <td><Pill value={u.status} /></td>
                    <td className="muted">
                      {u.role === 'admin'
                        ? t('Todos (administrador)')
                        : (Object.keys(u.permissions || {}).filter((k) => u.permissions[k]).length === 0
                          ? t('Solo lectura')
                          : MODULES.filter((m) => u.permissions?.[m.key]).map((m) => t(m.label)).join(', '))}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div className="row-actions">
                        <button type="button" className="btn-row-action edit" onClick={() => openEdit(u)}>{t('Editar')}</button>
                        {u.status === 'invitado' && (
                          <button type="button" className="btn-row-action" onClick={() => reinvite(u)}>{t('Reenviar invitación')}</button>
                        )}
                        {u.status !== 'invitado' && (
                          <button type="button" className="btn-row-action" onClick={() => toggleStatus(u)}>
                            {u.status === 'desactivado' ? t('Activar') : t('Desactivar')}
                          </button>
                        )}
                        <button type="button" className="btn-row-action delete" onClick={() => removeUser(u)}>{t('Eliminar')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editingId ? t('Editar usuario') : t('Nuevo usuario')} onClose={() => setModalOpen(false)}>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>{t('Nombre *')}</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Email *</label>
              <input
                type="email" required disabled={!!editingId}
                placeholder="nombre@nexprotrucks.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {!editingId && <div className="hint">{t('Debe ser un correo de la empresa (@nexprotrucks.com)')}</div>}
            </div>
            <div className="field">
              <label>{t('Rol')}</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="usuario">{t('Usuario')}</option>
                <option value="admin">{t('Administrador')}</option>
              </select>
              <div className="hint">{t('El administrador puede editar todo y aprobar los cambios de facturas y pedidos.')}</div>
            </div>
            {form.role === 'usuario' && (
              <div className="field">
                <label>{t('Puede editar en estos módulos')}</label>
                <div className="hint" style={{ marginBottom: 6 }}>{t('Puede ver todos los módulos; solo podrá crear o modificar en los que marques aquí.')}</div>
                <div className="doc-box">
                  {MODULES.map((m) => (
                    <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, fontWeight: 400 }}>
                      <input type="checkbox" style={{ width: 'auto' }} checked={!!form.modules[m.key]} onChange={() => toggleModule(m.key)} />
                      {t(m.label)}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}

      {inviteInfo && (
        <Modal title={t('Invitación creada')} onClose={() => setInviteInfo(null)}>
          <p>
            {t('Comparte este enlace con')} <strong>{inviteInfo.name}</strong> ({inviteInfo.email}) {t('para que cree su contraseña. Vence en 7 días.')}
          </p>
          <div className="field">
            <input readOnly value={inviteInfo.link} onFocus={(e) => e.target.select()} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setInviteInfo(null)}>{t('Cerrar')}</button>
            <button type="button" className="btn btn-primary" onClick={copyLink}>{copied ? t('¡Copiado!') : t('Copiar enlace')}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
