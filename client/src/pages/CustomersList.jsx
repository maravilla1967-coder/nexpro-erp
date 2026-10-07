import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';

const EMPTY = { type: 'empresa', name: '', taxId: '', email: '', phone: '', address: '', city: '', industry: '', status: 'lead', source: '', notes: '' };

export default function CustomersList() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  function load() {
    api.get('/customers', { q, status }).then(setList).catch(console.error);
  }
  useEffect(() => { load(); }, [q, status]);

  function openNew() { setForm(EMPTY); setError(''); setModalOpen(true); }

  async function save(e) {
    e.preventDefault();
    try {
      await api.post('/customers', form);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Clientes (CRM)</h1>
          <div className="sub">Empresas, municipios y contactos</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo cliente</button>
      </div>
      <div className="content">
        <div className="toolbar">
          <input className="search-input" placeholder="Buscar por nombre, email, teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="lead">Lead</option>
            <option value="prospecto">Prospecto</option>
            <option value="cliente">Cliente</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </div>
        <div className="card">
          {list.length === 0 ? (
            <div className="empty-state">No hay clientes todavía. Crea el primero con "+ Nuevo cliente".</div>
          ) : (
            <table>
              <thead>
                <tr><th>Nombre</th><th>Industria</th><th>Contacto</th><th>Ciudad</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => window.location.assign(`/clientes/${c.id}`)}>
                    <td><Link to={`/clientes/${c.id}`}>{c.name}</Link></td>
                    <td className="muted">{c.industry || '—'}</td>
                    <td className="muted">{c.email || c.phone || '—'}</td>
                    <td className="muted">{c.city || '—'}</td>
                    <td><Pill value={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title="Nuevo cliente" onClose={() => setModalOpen(false)}>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field">
                <label>Nombre / Empresa *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="field">
                <label>Tipo</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="empresa">Empresa / Municipio</option>
                  <option value="persona">Persona</option>
                </select>
              </div>
              <div className="field">
                <label>Industria</label>
                <input placeholder="municipal, utilities, construction..." value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              </div>
              <div className="field">
                <label>Estado</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="lead">Lead</option>
                  <option value="prospecto">Prospecto</option>
                  <option value="cliente">Cliente</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field">
                <label>Teléfono</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label>Dirección</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div className="field">
                <label>Ciudad</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="field">
                <label>NIT / Identificación</label>
                <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
              </div>
              <div className="field">
                <label>Fuente</label>
                <input placeholder="referido, web, llamada..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
