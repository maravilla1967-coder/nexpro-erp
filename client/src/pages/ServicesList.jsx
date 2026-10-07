import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';

const EMPTY = { name: '', description: '', pricingType: 'hora', hourlyRate: '', flatPrice: '', active: true };

export default function ServicesList() {
  const [list, setList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  function load() { api.get('/services').then(setList).catch(console.error); }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setModalOpen(true); }
  function openEdit(s) {
    setEditing(s);
    setForm({ name: s.name, description: s.description || '', pricingType: s.pricing_type, hourlyRate: s.hourly_rate, flatPrice: s.flat_price, active: !!s.active });
    setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (editing) await api.put(`/services/${editing.id}`, form);
      else await api.post('/services', form);
      setModalOpen(false); load();
    } catch (err) { setError(err.message); }
  }
  async function remove(id) {
    if (!window.confirm('¿Eliminar este servicio?')) return;
    await api.del(`/services/${id}`); load();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Catálogo de Servicios</h1><div className="sub">Servicios del taller: por hora o por servicio completo</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo servicio</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? <div className="empty-state">No hay servicios todavía.</div> : (
            <table>
              <thead><tr><th>Nombre</th><th>Descripción</th><th>Tipo</th><th>Tarifa</th><th></th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                    <td onClick={() => openEdit(s)} className="clickable"><strong>{s.name}</strong></td>
                    <td className="muted">{s.description || '—'}</td>
                    <td>{s.pricing_type === 'hora' ? 'Por hora' : 'Servicio completo'}</td>
                    <td>{s.pricing_type === 'hora' ? `$${s.hourly_rate}/hora` : `$${s.flat_price}`}</td>
                    <td>
                      <button className="link-btn" onClick={() => openEdit(s)}>Editar</button>{' '}
                      <button className="link-btn" style={{ color: 'var(--red)' }} onClick={() => remove(s.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Editar servicio' : 'Nuevo servicio'} onClose={() => setModalOpen(false)}>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>Nombre *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Descripción</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="field"><label>Tipo de tarifa</label>
              <select value={form.pricingType} onChange={(e) => setForm({ ...form, pricingType: e.target.value })}>
                <option value="hora">Por hora</option>
                <option value="servicio_completo">Servicio completo</option>
              </select>
            </div>
            {form.pricingType === 'hora' ? (
              <div className="field"><label>Costo por hora ($)</label><input type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></div>
            ) : (
              <div className="field"><label>Precio del servicio completo ($)</label><input type="number" step="0.01" value={form.flatPrice} onChange={(e) => setForm({ ...form, flatPrice: e.target.value })} /></div>
            )}
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
