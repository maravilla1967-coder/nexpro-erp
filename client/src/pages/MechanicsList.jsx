import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { useI18n } from '../i18n.jsx';

const EMPTY = { name: '', specialty: '', phone: '', email: '', active: true };

export default function MechanicsList() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  function load() { api.get('/mechanics').then(setList).catch(console.error); }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setModalOpen(true); }
  function openEdit(m) {
    setEditing(m);
    setForm({ name: m.name, specialty: m.specialty || '', phone: m.phone || '', email: m.email || '', active: !!m.active });
    setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (editing) await api.put(`/mechanics/${editing.id}`, form);
      else await api.post('/mechanics', form);
      setModalOpen(false); load();
    } catch (err) { setError(err.message); }
  }
  async function remove(id) {
    if (!window.confirm(t('¿Eliminar este mecánico?'))) return;
    await api.del(`/mechanics/${id}`); load();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Mecánicos')}</h1><div className="sub">{t('Equipo del taller')}</div></div>
        <button className="btn btn-primary" onClick={openNew}>{t('+ Nuevo mecánico')}</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay mecánicos registrados todavía.')}</div> : (
            <table>
              <thead><tr><th>{t('Nombre')}</th><th>{t('Especialidad')}</th><th>{t('Contacto')}</th><th></th></tr></thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                    <td onClick={() => openEdit(m)} className="clickable"><strong>{m.name}</strong></td>
                    <td className="muted">{m.specialty || '—'}</td>
                    <td className="muted">{m.phone || m.email || '—'}</td>
                    <td>
                      <button className="link-btn" onClick={() => openEdit(m)}>{t('Editar')}</button>{' '}
                      <button className="link-btn" style={{ color: 'var(--red)' }} onClick={() => remove(m.id)}>{t('Eliminar')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editing ? t('Editar mecánico') : t('Nuevo mecánico')} onClose={() => setModalOpen(false)}>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>{t('Nombre *')}</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>{t('Especialidad')}</label><input placeholder={t('Hidráulica, eléctrica, general...')} value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Teléfono')}</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>{t('Email')}</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="field">
              <label><input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> {t('Activo')}</label>
            </div>
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
