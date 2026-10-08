import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';

const EQUIP_EMPTY = { equipmentTypeId: '', customTypeName: '', serialNumber: '', manufacturer: '', model: '', notes: '' };

export default function VehicleDetail() {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [equipTypes, setEquipTypes] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [services, setServices] = useState([]);

  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [equipForm, setEquipForm] = useState(EQUIP_EMPTY);
  const [useNewType, setUseNewType] = useState(false);
  const [error, setError] = useState('');

  const [woModalOpen, setWoModalOpen] = useState(false);
  const [woMechanicId, setWoMechanicId] = useState('');
  const [woServices, setWoServices] = useState([{ serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 }]);
  const [woNotes, setWoNotes] = useState('');
  const [woDiagnosis, setWoDiagnosis] = useState('');
  const [woResolution, setWoResolution] = useState('');
  const [woParts, setWoParts] = useState([]);

  function load() { api.get(`/vehicles/${id}`).then(setVehicle).catch(console.error); }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    api.get('/vehicles/equipment-types').then(setEquipTypes);
    api.get('/mechanics', { active: 'true' }).then(setMechanics);
    api.get('/services', { active: 'true' }).then(setServices);
  }, []);

  async function remove() {
    if (!window.confirm(t('¿Eliminar este vehículo y todo su historial?'))) return;
    await api.del(`/vehicles/${id}`);
    navigate('/vehiculos');
  }

  function openEquipModal() { setEquipForm(EQUIP_EMPTY); setUseNewType(false); setError(''); setEquipModalOpen(true); }

  async function saveEquip(e) {
    e.preventDefault();
    try {
      await api.post(`/vehicles/${id}/equipment`, equipForm);
      setEquipModalOpen(false);
      api.get('/vehicles/equipment-types').then(setEquipTypes);
      load();
    } catch (err) { setError(err.message); }
  }

  async function deleteEquip(eid) {
    if (!window.confirm(t('¿Eliminar este equipo del vehículo?'))) return;
    await api.del(`/vehicles/equipment/${eid}`);
    load();
  }

  function openWoModal() {
    setWoMechanicId('');
    setWoServices([{ serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 }]);
    setWoNotes(''); setWoDiagnosis(''); setWoResolution(''); setWoParts([]);
    setError(''); setWoModalOpen(true);
  }
  function updateWoService(idx, field, value) {
    const copy = [...woServices];
    copy[idx] = { ...copy[idx], [field]: value };
    setWoServices(copy);
  }
  function updateWoPart(idx, field, value) {
    const copy = [...woParts];
    copy[idx] = { ...copy[idx], [field]: value };
    setWoParts(copy);
  }
  function addWoPartRow() { setWoParts([...woParts, { description: '', action: 'reemplazada', quantity: 1, unitCost: 0 }]); }
  function removeWoPartRow(idx) { setWoParts(woParts.filter((_, i) => i !== idx)); }
  function pickService(idx, serviceId) {
    const svc = services.find((s) => String(s.id) === String(serviceId));
    const copy = [...woServices];
    copy[idx] = {
      ...copy[idx], serviceId, description: svc ? svc.name : copy[idx].description,
      pricingType: svc ? svc.pricing_type : copy[idx].pricingType,
      hourlyRate: svc ? svc.hourly_rate : copy[idx].hourlyRate,
      flatPrice: svc ? svc.flat_price : copy[idx].flatPrice,
    };
    setWoServices(copy);
  }
  function addWoServiceRow() { setWoServices([...woServices, { serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 }]); }
  function removeWoServiceRow(idx) { setWoServices(woServices.filter((_, i) => i !== idx)); }

  async function saveWorkOrder(e) {
    e.preventDefault();
    const payload = {
      vehicleId: id, mechanicId: woMechanicId || null,
      notes: woNotes || null, diagnosis: woDiagnosis || null, resolution: woResolution || null,
      services: woServices.filter((s) => s.description).map((s) => ({
        serviceId: s.serviceId || null, description: s.description, pricingType: s.pricingType,
        hours: parseFloat(s.hours) || 0, hourlyRate: parseFloat(s.hourlyRate) || 0, flatPrice: parseFloat(s.flatPrice) || 0,
      })),
      parts: woParts.filter((p) => p.description).map((p) => ({
        description: p.description, action: p.action, quantity: parseFloat(p.quantity) || 1, unitCost: parseFloat(p.unitCost) || 0,
      })),
    };
    try { await api.post('/work-orders', payload); setWoModalOpen(false); load(); }
    catch (err) { setError(err.message); }
  }

  if (!vehicle) return <div className="content">{t('Cargando…')}</div>;

  const woTotalPreview = woServices.reduce((sum, s) => {
    if (s.pricingType === 'servicio_completo') return sum + (parseFloat(s.flatPrice) || 0);
    return sum + (parseFloat(s.hours) || 0) * (parseFloat(s.hourlyRate) || 0);
  }, 0);

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="mono">{vehicle.vin}</h1>
          <div className="sub">{vehicle.make} {vehicle.model} {vehicle.year} {vehicle.chassis_type ? `· ${t('Chasis')} ${vehicle.chassis_type}` : ''} · <Pill value={vehicle.status} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/vehiculos" className="btn">{t('← Volver')}</Link>
          <button className="btn btn-danger" onClick={remove}>{t('Eliminar')}</button>
        </div>
      </div>
      <div className="content">
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title">{t('Datos del vehículo')}</div>
            {vehicle.photo_url && <img src={vehicle.photo_url} className="thumb-lg" style={{ marginBottom: 12 }} />}
            <div><strong>{t('Cliente:')}</strong> {vehicle.customer_name ? <Link to={`/clientes/${vehicle.customer_id}`}>{vehicle.customer_name}</Link> : '—'}</div>
            <div><strong>{t('Placa:')}</strong> {vehicle.plate || '—'}</div>
            <div><strong>{t('Recibido:')}</strong> {vehicle.received_at}</div>
            <div><strong>{t('Notas:')}</strong> {vehicle.notes || '—'}</div>
          </div>

          <div className="card">
            <div className="card-title">
              {t('Equipos instalados en el chasis')}
              <button className="btn btn-sm btn-primary" onClick={openEquipModal}>{t('+ Agregar equipo')}</button>
            </div>
            {vehicle.equipment.length === 0 ? <div className="empty-state">{t('Sin equipos registrados aún.')}</div> : (
              <table>
                <thead><tr><th>{t('Tipo')}</th><th>{t('Serie')}</th><th>{t('Fabricante')}</th><th>{t('Modelo')}</th><th></th></tr></thead>
                <tbody>
                  {vehicle.equipment.map((e) => (
                    <tr key={e.id}>
                      <td>{e.equipment_type_name || e.custom_type_name} {!e.equipment_type_name && <span className="pill amber" style={{ marginLeft: 6 }}>{t('nuevo')}</span>}</td>
                      <td className="mono">{e.serial_number || '—'}</td>
                      <td>{e.manufacturer || '—'}</td>
                      <td>{e.model || '—'}</td>
                      <td><button className="link-btn" onClick={() => deleteEquip(e.id)}>{t('Eliminar')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            {t('Órdenes de trabajo')}
            <button className="btn btn-sm btn-primary" onClick={openWoModal}>{t('+ Nueva orden de trabajo')}</button>
          </div>
          {vehicle.workOrders.length === 0 ? <div className="empty-state">{t('Sin órdenes de trabajo todavía.')}</div> : (
            <table>
              <thead><tr><th>{t('Número')}</th><th>{t('Mecánico')}</th><th>{t('Estado')}</th><th>{t('Fecha')}</th><th></th></tr></thead>
              <tbody>
                {vehicle.workOrders.map((wo) => (
                  <tr key={wo.id}>
                    <td className="mono">{wo.number}</td>
                    <td>{wo.mechanic_name || '—'}</td>
                    <td><Pill value={wo.status} /></td>
                    <td className="muted">{wo.created_at}</td>
                    <td><Link to={`/ordenes-trabajo/${wo.id}/documento`}>{t('Documento')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{t('Gestiona el detalle de horas/servicios de cada orden en')} <Link to="/ordenes-trabajo">{t('Órdenes de Trabajo')}</Link>.</div>
        </div>
      </div>

      {equipModalOpen && (
        <Modal title={t('Agregar equipo instalado')} onClose={() => setEquipModalOpen(false)}>
          <form onSubmit={saveEquip}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>{t('Tipo de equipo *')}</label>
              {!useNewType ? (
                <>
                  <select value={equipForm.equipmentTypeId} onChange={(e) => setEquipForm({ ...equipForm, equipmentTypeId: e.target.value })}>
                    <option value="">{t('— Seleccionar de la lista —')}</option>
                    {equipTypes.map((t2) => <option key={t2.id} value={t2.id}>{t2.name}</option>)}
                  </select>
                  <button type="button" className="link-btn" style={{ marginTop: 6 }} onClick={() => { setUseNewType(true); setEquipForm({ ...equipForm, equipmentTypeId: '' }); }}>
                    {t('No está en la lista, crear uno nuevo')}
                  </button>
                </>
              ) : (
                <>
                  <input placeholder={t('Nombre del nuevo tipo de equipo')} value={equipForm.customTypeName} onChange={(e) => setEquipForm({ ...equipForm, customTypeName: e.target.value })} />
                  <button type="button" className="link-btn" style={{ marginTop: 6 }} onClick={() => { setUseNewType(false); setEquipForm({ ...equipForm, customTypeName: '' }); }}>
                    {t('Usar la lista existente')}
                  </button>
                </>
              )}
            </div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Número de serie')}</label><input value={equipForm.serialNumber} onChange={(e) => setEquipForm({ ...equipForm, serialNumber: e.target.value })} /></div>
              <div className="field"><label>{t('Fabricante')}</label><input value={equipForm.manufacturer} onChange={(e) => setEquipForm({ ...equipForm, manufacturer: e.target.value })} /></div>
              <div className="field"><label>{t('Modelo')}</label><input value={equipForm.model} onChange={(e) => setEquipForm({ ...equipForm, model: e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={equipForm.notes} onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })} /></div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setEquipModalOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar equipo')}</button>
            </div>
          </form>
        </Modal>
      )}

      {woModalOpen && (
        <Modal title={t('Nueva orden de trabajo')} onClose={() => setWoModalOpen(false)} wide>
          <form onSubmit={saveWorkOrder}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>{t('Mecánico asignado')}</label>
              <select value={woMechanicId} onChange={(e) => setWoMechanicId(e.target.value)}>
                <option value="">{t('— Sin asignar —')}</option>
                {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)' }}>{t('Servicios a realizar')}</label>
            <table className="line-items-table" style={{ marginTop: 6 }}>
              <thead><tr><th>{t('Servicio')}</th><th>{t('Descripción')}</th><th style={{ width: 120 }}>{t('Tipo')}</th><th style={{ width: 80 }}>{t('Horas')}</th><th style={{ width: 100 }}>{t('$/hora')}</th><th style={{ width: 110 }}>{t('$ fijo')}</th><th style={{ width: 90 }}>{t('Total')}</th><th></th></tr></thead>
              <tbody>
                {woServices.map((s, idx) => {
                  const total = s.pricingType === 'servicio_completo' ? (parseFloat(s.flatPrice) || 0) : (parseFloat(s.hours) || 0) * (parseFloat(s.hourlyRate) || 0);
                  return (
                    <tr key={idx}>
                      <td>
                        <select value={s.serviceId} onChange={(e) => pickService(idx, e.target.value)}>
                          <option value="">— manual —</option>
                          {services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name}</option>)}
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
                      <td className="text-right">${total.toLocaleString()}</td>
                      <td><button type="button" className="link-btn" onClick={() => removeWoServiceRow(idx)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addWoServiceRow}>{t('+ Agregar servicio')}</button>
            <div className="text-right" style={{ marginTop: 10, fontWeight: 700 }}>{t('Total estimado:')} ${woTotalPreview.toLocaleString()}</div>

            <div className="field" style={{ marginTop: 16 }}><label>{t('Problema reportado / Síntomas')}</label><textarea rows={2} value={woNotes} onChange={(e) => setWoNotes(e.target.value)} /></div>
            <div className="field"><label>{t('Diagnóstico')}</label><textarea rows={2} value={woDiagnosis} onChange={(e) => setWoDiagnosis(e.target.value)} /></div>
            <div className="field"><label>{t('Solución / Reparación realizada')}</label><textarea rows={2} value={woResolution} onChange={(e) => setWoResolution(e.target.value)} /></div>

            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)' }}>{t('Partes reemplazadas o reparadas')}</label>
            <table className="line-items-table" style={{ marginTop: 6 }}>
              <thead><tr><th>{t('Descripción')}</th><th style={{ width: 130 }}>{t('Acción')}</th><th style={{ width: 80 }}>{t('Cant.')}</th><th style={{ width: 110 }}>{t('Costo unit.')}</th><th></th></tr></thead>
              <tbody>
                {woParts.map((p, idx) => (
                  <tr key={idx}>
                    <td><input value={p.description} onChange={(e) => updateWoPart(idx, 'description', e.target.value)} /></td>
                    <td>
                      <select value={p.action} onChange={(e) => updateWoPart(idx, 'action', e.target.value)}>
                        <option value="reemplazada">{t('Reemplazada')}</option>
                        <option value="reparada">{t('Reparada')}</option>
                      </select>
                    </td>
                    <td><input type="number" step="1" value={p.quantity} onChange={(e) => updateWoPart(idx, 'quantity', e.target.value)} /></td>
                    <td><input type="number" step="0.01" value={p.unitCost} onChange={(e) => updateWoPart(idx, 'unitCost', e.target.value)} /></td>
                    <td><button type="button" className="link-btn" onClick={() => removeWoPartRow(idx)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addWoPartRow}>{t('+ Agregar parte')}</button>

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setWoModalOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Crear orden de trabajo')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
