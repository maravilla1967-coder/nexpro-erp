import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';

const EQUIP_EMPTY = { equipmentTypeId: '', customTypeName: '', serialNumber: '', manufacturer: '', model: '', notes: '' };

export default function VehicleDetail() {
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

  function load() { api.get(`/vehicles/${id}`).then(setVehicle).catch(console.error); }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    api.get('/vehicles/equipment-types').then(setEquipTypes);
    api.get('/mechanics', { active: 'true' }).then(setMechanics);
    api.get('/services', { active: 'true' }).then(setServices);
  }, []);

  async function remove() {
    if (!window.confirm('¿Eliminar este vehículo y todo su historial?')) return;
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
    if (!window.confirm('¿Eliminar este equipo del vehículo?')) return;
    await api.del(`/vehicles/equipment/${eid}`);
    load();
  }

  function openWoModal() {
    setWoMechanicId('');
    setWoServices([{ serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 }]);
    setError(''); setWoModalOpen(true);
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
      services: woServices.filter((s) => s.description).map((s) => ({
        serviceId: s.serviceId || null, description: s.description, pricingType: s.pricingType,
        hours: parseFloat(s.hours) || 0, hourlyRate: parseFloat(s.hourlyRate) || 0, flatPrice: parseFloat(s.flatPrice) || 0,
      })),
    };
    try { await api.post('/work-orders', payload); setWoModalOpen(false); load(); }
    catch (err) { setError(err.message); }
  }

  if (!vehicle) return <div className="content">Cargando…</div>;

  const woTotalPreview = woServices.reduce((sum, s) => {
    if (s.pricingType === 'servicio_completo') return sum + (parseFloat(s.flatPrice) || 0);
    return sum + (parseFloat(s.hours) || 0) * (parseFloat(s.hourlyRate) || 0);
  }, 0);

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="mono">{vehicle.vin}</h1>
          <div className="sub">{vehicle.make} {vehicle.model} {vehicle.year} {vehicle.chassis_type ? `· Chasis ${vehicle.chassis_type}` : ''} · <Pill value={vehicle.status} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/vehiculos" className="btn">← Volver</Link>
          <button className="btn btn-danger" onClick={remove}>Eliminar</button>
        </div>
      </div>
      <div className="content">
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title">Datos del vehículo</div>
            {vehicle.photo_url && <img src={vehicle.photo_url} className="thumb-lg" style={{ marginBottom: 12 }} />}
            <div><strong>Cliente:</strong> {vehicle.customer_name ? <Link to={`/clientes/${vehicle.customer_id}`}>{vehicle.customer_name}</Link> : '—'}</div>
            <div><strong>Placa:</strong> {vehicle.plate || '—'}</div>
            <div><strong>Recibido:</strong> {vehicle.received_at}</div>
            <div><strong>Notas:</strong> {vehicle.notes || '—'}</div>
          </div>

          <div className="card">
            <div className="card-title">
              Equipos instalados en el chasis
              <button className="btn btn-sm btn-primary" onClick={openEquipModal}>+ Agregar equipo</button>
            </div>
            {vehicle.equipment.length === 0 ? <div className="empty-state">Sin equipos registrados aún.</div> : (
              <table>
                <thead><tr><th>Tipo</th><th>Serie</th><th>Fabricante</th><th>Modelo</th><th></th></tr></thead>
                <tbody>
                  {vehicle.equipment.map((e) => (
                    <tr key={e.id}>
                      <td>{e.equipment_type_name || e.custom_type_name} {!e.equipment_type_name && <span className="pill amber" style={{ marginLeft: 6 }}>nuevo</span>}</td>
                      <td className="mono">{e.serial_number || '—'}</td>
                      <td>{e.manufacturer || '—'}</td>
                      <td>{e.model || '—'}</td>
                      <td><button className="link-btn" onClick={() => deleteEquip(e.id)}>Eliminar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title">
            Órdenes de trabajo
            <button className="btn btn-sm btn-primary" onClick={openWoModal}>+ Nueva orden de trabajo</button>
          </div>
          {vehicle.workOrders.length === 0 ? <div className="empty-state">Sin órdenes de trabajo todavía.</div> : (
            <table>
              <thead><tr><th>Número</th><th>Mecánico</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {vehicle.workOrders.map((wo) => (
                  <tr key={wo.id}>
                    <td className="mono">{wo.number}</td>
                    <td>{wo.mechanic_name || '—'}</td>
                    <td><Pill value={wo.status} /></td>
                    <td className="muted">{wo.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Gestiona el detalle de horas/servicios de cada orden en <Link to="/ordenes-trabajo">Órdenes de Trabajo</Link>.</div>
        </div>
      </div>

      {equipModalOpen && (
        <Modal title="Agregar equipo instalado" onClose={() => setEquipModalOpen(false)}>
          <form onSubmit={saveEquip}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>Tipo de equipo *</label>
              {!useNewType ? (
                <>
                  <select value={equipForm.equipmentTypeId} onChange={(e) => setEquipForm({ ...equipForm, equipmentTypeId: e.target.value })}>
                    <option value="">— Seleccionar de la lista —</option>
                    {equipTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <button type="button" className="link-btn" style={{ marginTop: 6 }} onClick={() => { setUseNewType(true); setEquipForm({ ...equipForm, equipmentTypeId: '' }); }}>
                    No está en la lista, crear uno nuevo
                  </button>
                </>
              ) : (
                <>
                  <input placeholder="Nombre del nuevo tipo de equipo" value={equipForm.customTypeName} onChange={(e) => setEquipForm({ ...equipForm, customTypeName: e.target.value })} />
                  <button type="button" className="link-btn" style={{ marginTop: 6 }} onClick={() => { setUseNewType(false); setEquipForm({ ...equipForm, customTypeName: '' }); }}>
                    Usar la lista existente
                  </button>
                </>
              )}
            </div>
            <div className="grid grid-2">
              <div className="field"><label>Número de serie</label><input value={equipForm.serialNumber} onChange={(e) => setEquipForm({ ...equipForm, serialNumber: e.target.value })} /></div>
              <div className="field"><label>Fabricante</label><input value={equipForm.manufacturer} onChange={(e) => setEquipForm({ ...equipForm, manufacturer: e.target.value })} /></div>
              <div className="field"><label>Modelo</label><input value={equipForm.model} onChange={(e) => setEquipForm({ ...equipForm, model: e.target.value })} /></div>
            </div>
            <div className="field"><label>Notas</label><textarea rows={2} value={equipForm.notes} onChange={(e) => setEquipForm({ ...equipForm, notes: e.target.value })} /></div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setEquipModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar equipo</button>
            </div>
          </form>
        </Modal>
      )}

      {woModalOpen && (
        <Modal title="Nueva orden de trabajo" onClose={() => setWoModalOpen(false)} wide>
          <form onSubmit={saveWorkOrder}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>Mecánico asignado</label>
              <select value={woMechanicId} onChange={(e) => setWoMechanicId(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)' }}>Servicios a realizar</label>
            <table className="line-items-table" style={{ marginTop: 6 }}>
              <thead><tr><th>Servicio</th><th>Descripción</th><th style={{ width: 120 }}>Tipo</th><th style={{ width: 80 }}>Horas</th><th style={{ width: 100 }}>$/hora</th><th style={{ width: 110 }}>$ fijo</th><th style={{ width: 90 }}>Total</th><th></th></tr></thead>
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
                          <option value="hora">Por hora</option>
                          <option value="servicio_completo">Servicio completo</option>
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
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addWoServiceRow}>+ Agregar servicio</button>
            <div className="text-right" style={{ marginTop: 10, fontWeight: 700 }}>Total estimado: ${woTotalPreview.toLocaleString()}</div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setWoModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Crear orden de trabajo</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
