import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { useI18n } from '../i18n.jsx';

const EMPTY = { name: '', code: '', taxId: '', email: '', phone: '', address: '', notes: '' };

export default function SuppliersList() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  function load() { api.get('/suppliers', { q }).then(setList).catch(console.error); }
  useEffect(() => { load(); }, [q]);

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setModalOpen(true); }
  function openEdit(s) {
    setEditing(s);
    setForm({ name: s.name, code: s.code || '', taxId: s.tax_id || '', email: s.email || '', phone: s.phone || '', address: s.address || '', notes: s.notes || '' });
    setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post('/suppliers', form);
      setModalOpen(false); load();
    } catch (err) { setError(err.message); }
  }
  async function remove(id) {
    if (!window.confirm(t('¿Eliminar este proveedor?'))) return;
    await api.del(`/suppliers/${id}`); load();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Proveedores')}</h1><div className="sub">{t('Fuentes de compra para inventario')}</div></div>
        <button className="btn btn-primary" onClick={openNew}>{t('+ Nuevo proveedor')}</button>
      </div>
      <div className="content">
        <div className="toolbar"><input className="search-input" placeholder={t('Buscar…')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay proveedores todavía.')}</div> : (
            <table>
              <thead><tr><th>{t('Nombre')}</th><th>{t('Código')}</th><th>{t('NIT')}</th><th>{t('Contacto')}</th><th></th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td onClick={() => openEdit(s)} className="clickable"><strong>{s.name}</strong></td>
                    <td className="mono muted">{s.code || '—'}</td>
                    <td className="muted">{s.tax_id || '—'}</td>
                    <td className="muted">{s.email || s.phone || '—'}</td>
                    <td>
                      <button className="link-btn" onClick={() => openEdit(s)}>{t('Editar')}</button>{' '}
                      <button className="link-btn" style={{ color: 'var(--red)' }} onClick={() => remove(s.id)}>{t('Eliminar')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editing ? t('Editar proveedor') : t('Nuevo proveedor')} onClose={() => setModalOpen(false)}>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field"><label>{t('Nombre *')}</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field">
                <label>{t('Código (2 letras)')}</label>
                <input maxLength={2} style={{ textTransform: 'uppercase' }} placeholder={t('Auto')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                <div className="hint">{t('Se usa en el número de las órdenes de compra: NX-XX-001. Si se deja vacío, se toma de las primeras letras del nombre.')}</div>
              </div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>{t('NIT')}</label><input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} /></div>
              <div className="field"><label>{t('Email')}</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="field"><label>{t('Teléfono')}</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>{t('Dirección')}</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
