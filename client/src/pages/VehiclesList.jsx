import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, toFormData } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n, pickLang } from '../i18n.jsx';

const EMPTY = { vin: '', make: '', model: '', year: '', chassisType: '', plate: '', customerId: '', notes: '' };
const EMPTY_SERVICE_ROW = { serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 };

export default function VehiclesList() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [services, setServices] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [photoFile, setPhotoFile] = useState(null);
  const [woMechanicId, setWoMechanicId] = useState('');
  const [woServices, setWoServices] = useState([{ ...EMPTY_SERVICE_ROW }]);
  const [error, setError] = useState('');

  function load() { api.get('/vehicles', { q, status }).then(setList).catch(console.error); }
  useEffect(() => { load(); }, [q, status]);
  useEffect(() => {
    api.get('/customers').then(setCustomers);
    api.get('/mechanics', { active: 'true' }).then(setMechanics);
    api.get('/services', { active: 'true' }).then(setServices);
  }, []);

  function openNew() {
    setForm(EMPTY); setPhotoFile(null);
    setWoMechanicId(''); setWoServices([{ ...EMPTY_SERVICE_ROW }]);
    setError(''); setModalOpen(true);
  }

  function updateWoService(idx, field, value) {
    const copy = [...woServices];
    copy[idx] = { ...copy[idx], [field]: value };
    setWoServices(copy);
  }
  function pickService(idx, serviceId) {
    const svc = services.find((s) => String(s.id) === String(serviceId));
    const copy = [...woServices];
    copy[idx] = {
      ...copy[idx], serviceId, description: svc ? pickLang(svc.name, svc.name_en, lang) : copy[idx].description,
      pricingType: svc ? svc.pricing_type : copy[idx].pricingType,
      hourlyRate: svc ? svc.hourly_rate : copy[idx].hourlyRate,
      flatPrice: svc ? svc.flat_price : copy[idx].flatPrice,
    };
    setWoServices(copy);
  }
  function addWoServiceRow() { setWoServices([...woServices, { ...EMPTY_SERVICE_ROW }]); }
  function removeWoServiceRow(idx) { setWoServices(woServices.filter((_, i) => i !== idx)); }

  const selectedCustomer = customers.find((c) => String(c.id) === String(form.customerId));

  async function save(e) {
    e.preventDefault();
    const fd = toFormData(form);
    if (photoFile) fd.append('photo', photoFile);
    try {
      const vehicle = await api.postForm('/vehicles', fd);
      const filteredServices = woServices.filter((s) => s.description).map((s) => ({
        serviceId: s.serviceId || null, description: s.description, pricingType: s.pricingType,
        hours: parseFloat(s.hours) || 0, hourlyRate: parseFloat(s.hourlyRate) || 0, flatPrice: parseFloat(s.flatPrice) || 0,
      }));
      if (woMechanicId || filteredServices.length > 0) {
        await api.post('/work-orders', { vehicleId: vehicle.id, mechanicId: woMechanicId || null, services: filteredServices });
      }
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
              <thead><tr><th></th><th>VIN</th><th>{t('Vehículo')}</th><th>{t('Cliente')}</th><th>{t('Recibido')}</th><th>{t('Estado')}</th><th></th></tr></thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id} className="clickable" onClick={() => navigate(`/vehiculos/${v.id}`)}>
                    <td>{v.photo_url ? <img className="thumb" src={v.photo_url} /> : <div className="thumb" />}</td>
                    <td className="mono"><Link to={`/vehiculos/${v.id}`}>{v.vin}</Link></td>
                    <td>{v.make} {v.model} {v.year} {v.chassis_type ? `(${v.chassis_type})` : ''}</td>
                    <td className="muted">{v.customer_name || '—'}</td>
                    <td className="muted">{v.received_at}</td>
                    <td><Pill value={v.status} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link className="link-btn" to={`/vehiculos/${v.id}/documento`}>{t('Imprimir')}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={t('Recibir vehículo por VIN')} onClose={() => setModalOpen(false)} wide>
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

            {selectedCustomer && (
              <div className="doc-box" style={{ marginBottom: 12 }}>
                <div className="doc-box-title">{t('Datos del cliente')}</div>
                <div><strong>{selectedCustomer.name}</strong></div>
                <div className="muted">{selectedCustomer.tax_id && `${t('NIT/ID:')} ${selectedCustomer.tax_id}`}</div>
                <div className="muted">{selectedCustomer.address || ''} {selectedCustomer.city || ''} {selectedCustomer.zip || ''}</div>
                <div className="muted">{selectedCustomer.phone} {selectedCustomer.phone && selectedCustomer.email ? '|' : ''} {selectedCustomer.email}</div>
              </div>
            )}

            <div className="field"><label>{t('Foto del vehículo')}</label><input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} /></div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

            <div className="field"><label>{t('Técnico asignado')}</label>
              <select value={woMechanicId} onChange={(e) => setWoMechanicId(e.target.value)}>
                <option value="">{t('— Sin asignar —')}</option>
                {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)' }}>{t('Servicios a realizar')}</label>
            <table className="line-items-table" style={{ marginTop: 6 }}>
              <thead><tr><th>{t('Servicio')}</th><th>{t('Descripción')}</th><th style={{ width: 120 }}>{t('Tipo')}</th><th style={{ width: 80 }}>{t('Horas')}</th><th style={{ width: 100 }}>{t('$/hora')}</th><th style={{ width: 110 }}>{t('$ fijo')}</th><th></th></tr></thead>
              <tbody>
                {woServices.map((s, idx) => (
                  <tr key={idx}>
                    <td>
                      <select value={s.serviceId} onChange={(e) => pickService(idx, e.target.value)}>
                        <option value="">— manual —</option>
                        {services.map((sv) => <option key={sv.id} value={sv.id}>{pickLang(sv.name, sv.name_en, lang)}</option>)}
                      </select>
                    </td>
                    <td><input value={s.description} onChange={(e) => updateWoService(idx, 'description', e.target.value)} /></td>
                    <td>
                      <select value={s.pricingType} onChange={(e) => updateWoService(idx, 'pricingType', e.target.value)}>
                        <option value="hora">{t('Por hora')}</option>
                        <option value="servicio_completo">{t('Servicio completo')}</option>
                      </select>
                    </td>
                    <td><input type="number" step="0.25" disabled={s.pricingType !== 'hora'} value={s.hours} onChange={(e) => updateWoService(idx, 'hours', e.target.value)} /></td>
                    <td><input type="number" step="0.01" disabled={s.pricingType !== 'hora'} value={s.hourlyRate} onChange={(e) => updateWoService(idx, 'hourlyRate', e.target.value)} /></td>
                    <td><input type="number" step="0.01" disabled={s.pricingType !== 'servicio_completo'} value={s.flatPrice} onChange={(e) => updateWoService(idx, 'flatPrice', e.target.value)} /></td>
                    <td><button type="button" className="link-btn" onClick={() => removeWoServiceRow(idx)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addWoServiceRow}>{t('+ Agregar servicio')}</button>

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
