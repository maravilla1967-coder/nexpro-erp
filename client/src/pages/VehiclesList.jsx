import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, toFormData } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';

const EMPTY = { vin: '', make: '', model: '', year: '', chassisType: '', plate: '', customerId: '', notes: '' };

export default function VehiclesList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [photoFile, setPhotoFile] = useState(null);
  const [error, setError] = useState('');

  function load() { api.get('/vehicles', { q, status }).then(setList).catch(console.error); }
  useEffect(() => { load(); }, [q, status]);
  useEffect(() => { api.get('/customers').then(setCustomers); }, []);

  function openNew() { setForm(EMPTY); setPhotoFile(null); setError(''); setModalOpen(true); }

  async function save(e) {
    e.preventDefault();
    const fd = toFormData(form);
    if (photoFile) fd.append('photo', photoFile);
    try {
      const vehicle = await api.postForm('/vehicles', fd);
      setModalOpen(false);
      navigate(`/vehiculos/${vehicle.id}`);
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t('Recepción de Vehículos')}</h1>
          <div className="sub">{t('Ingreso por VIN y equipos instalados en el chasis')}</div>
        </div>
        <button className="btn btn-primary" onClick={openNew}>{t('+ Recibir vehículo')}</button>
      </div>
      <div className="content">
        <div className="toolbar">
          <input className="search-input" placeholder={t('Buscar por VIN, marca, modelo, placa…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('Todos los estados')}</option>
            <option value="recibido">{t('Recibido')}</option>
            <option value="en_servicio">{t('En servicio')}</option>
            <option value="completado">{t('Completado')}</option>
            <option value="entregado">{t('Entregado')}</option>
          </select>
        </div>
        <div className="card">
          {list.length === 0 ? (
            <div className="empty-state">{t('No se han recibido vehículos todavía.')}</div>
          ) : (
            <table>
              <thead><tr><th></th><th>VIN</th><th>{t('Vehículo')}</th><th>{t('Cliente')}</th><th>{t('Recibido')}</th><th>{t('Estado')}</th></tr></thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id} className="clickable" onClick={() => navigate(`/vehiculos/${v.id}`)}>
                    <td>{v.photo_url ? <img className="thumb" src={v.photo_url} /> : <div className="thumb" />}</td>
                    <td className="mono"><Link to={`/vehiculos/${v.id}`}>{v.vin}</Link></td>
                    <td>{v.make} {v.model} {v.year} {v.chassis_type ? `(${v.chassis_type})` : ''}</td>
                    <td className="muted">{v.customer_name || '—'}</td>
                    <td className="muted">{v.received_at}</td>
                    <td><Pill value={v.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={t('Recibir vehículo por VIN')} onClose={() => setModalOpen(false)}>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>{t('VIN *')}</label><input required value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase() })} /></div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Marca')}</label><input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></div>
              <div className="field"><label>{t('Modelo')}</label><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              <div className="field"><label>{t('Año')}</label><input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></div>
              <div className="field"><label>{t('Tipo de chasis')}</label><input placeholder="CA, DRW, SRW..." value={form.chassisType} onChange={(e) => setForm({ ...form, chassisType: e.target.value })} /></div>
              <div className="field"><label>{t('Placa')}</label><input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} /></div>
              <div className="field"><label>{t('Cliente')}</label>
                <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
                  <option value="">{t('— Sin asignar —')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>{t('Foto del vehículo')}</label><input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} /></div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Recibir vehículo')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
