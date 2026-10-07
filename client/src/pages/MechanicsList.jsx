import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

const EMPTY = { name: '', specialty: '', phone: '', email: '', active: true };

export default function MechanicsList() {
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
    if (!window.confirm('¿Eliminar este mecánico?')) return;
    await api.del(`/mechanics/${id}`); load();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Mecánicos</h1><div className="sub">Equipo del taller</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo mecánico</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? <div className="empty-state">No hay mecánicos registrados todavía.</div> : (
            <table>
              <thead><tr><th>Nombre</th><th>Especialidad</th><th>Contacto</th><th></th></tr></thead>
              <tbody>
                {list.map((m) => (
                  <tr key={m.id} style={{ opacity: m.active ? 1 : 0.5 }}>
                    <td onClick={() => openEdit(m)} className="clickable"><strong>{m.name}</strong></td>
                    <td className="muted">{m.specialty || '—'}</td>
                    <td className="muted">{m.phone || m.email || '—'}</td>
                    <td>
                      <button className="link-btn" onClick={() => openEdit(m)}>Editar</button>{' '}
                      <button className="link-btn" style={{ color: 'var(--red)' }} onClick={() => remove(m.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Editar mecánico' : 'Nuevo mecánico'} onClose={() => setModalOpen(false)}>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>Nombre *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Especialidad</label><input placeholder="Hidráulica, eléctrica, general..." value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
            <div className="grid grid-2">
              <div className="field"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="field">
              <label><input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo</label>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
