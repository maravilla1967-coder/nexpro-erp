import React, { useEffect, useState } from 'react';
import CustomerPicker from '../components/CustomerPicker.jsx';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, toFormData } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n, pickLang } from '../i18n.jsx';

const EQUIP_EMPTY = { typeName: '', serialNumber: '', manufacturer: '', model: '', notes: '' };
const VEHICLE_STATUSES = ['recibido', 'en_servicio', 'completado', 'entregado'];

export default function VehicleDetail() {
  const { t, lang } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState(null);
  const [equipTypes, setEquipTypes] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [services, setServices] = useState([]);

  const [equipModalOpen, setEquipModalOpen] = useState(false);
  const [equipForm, setEquipForm] = useState(EQUIP_EMPTY);
  const [editingEquip, setEditingEquip] = useState(null);
  const [error, setError] = useState('');
  // Editar la recepción del vehículo
  const [editOpen, setEditOpen] = useState(false);
  const [vForm, setVForm] = useState({});
  const [vPhoto, setVPhoto] = useState(null);
  const [customers, setCustomers] = useState([]);
  // Lista maestra de tipos de equipo
  const [typesOpen, setTypesOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [renaming, setRenaming] = useState(null);

  const [woModalOpen, setWoModalOpen] = useState(false);
  const [editingWo, setEditingWo] = useState(null); // null = nueva orden; si no, se está editando esta orden existente
  const [woMechanicId, setWoMechanicId] = useState('');
  const [woStatus, setWoStatus] = useState('pendiente');
  const [woServices, setWoServices] = useState([{ serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 }]);
  const [woNotes, setWoNotes] = useState('');
  const [woDiagnosis, setWoDiagnosis] = useState('');
  const [woResolution, setWoResolution] = useState('');
  const [woParts, setWoParts] = useState([]);
  const [selectedWoIds, setSelectedWoIds] = useState([]);
  const [invoicing, setInvoicing] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const [installedSerials, setInstalledSerials] = useState([]);
  function load() {
    api.get(`/vehicles/${id}`).then(setVehicle).catch(console.error);
    api.get('/serials', { vehicleId: id }).then(setInstalledSerials).catch(() => {});
  }
  const [vouchers, setVouchers] = useState([]);
  useEffect(() => { load(); api.get('/service-vouchers', { vehicleId: id }).then(setVouchers).catch(() => {}); }, [id]);
  useEffect(() => {
    api.get('/vehicles/equipment-types').then(setEquipTypes);
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/mechanics', { active: 'true' }).then(setMechanics);
    api.get('/services', { active: 'true' }).then(setServices);
  }, []);

  async function remove() {
    if (!window.confirm(t('¿Eliminar este vehículo y todo su historial?'))) return;
    await api.del(`/vehicles/${id}`);
    navigate('/vehiculos');
  }

  function openEquipModal() { setEditingEquip(null); setEquipForm(EQUIP_EMPTY); setError(''); setEquipModalOpen(true); }
  function openEditEquip(eq) {
    setEditingEquip(eq);
    setEquipForm({ typeName: eq.equipment_type_name || eq.custom_type_name || '', serialNumber: eq.serial_number || '', manufacturer: eq.manufacturer || '', model: eq.model || '', notes: eq.notes || '' });
    setError(''); setEquipModalOpen(true);
  }

  function openEditVehicle() {
    setVForm({
      vin: vehicle.vin || '', make: vehicle.make || '', model: vehicle.model || '', year: vehicle.year || '',
      chassisType: vehicle.chassis_type || '', plate: vehicle.plate || '', customerName: vehicle.customer_name || '',
      status: vehicle.status || 'recibido', notes: vehicle.notes || '', receivedAt: String(vehicle.received_at || '').slice(0, 10),
    });
    setVPhoto(null); setError(''); setEditOpen(true);
  }
  async function saveVehicle(e) {
    e.preventDefault();
    if (!String(vForm.vin || '').trim()) { setError(t('El VIN no puede quedar vacío')); return; }
    try {
      const fd = toFormData(vForm);
      if (vPhoto) fd.append('photo', vPhoto);
      setVehicle(await api.putForm(`/vehicles/${id}`, fd));
      api.get('/customers').then(setCustomers).catch(() => {});
      setEditOpen(false);
    } catch (err) { setError(err.message); }
  }

  async function addType(e) {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    try { await api.post('/vehicles/equipment-types', { name: newTypeName.trim() }); setNewTypeName(''); setEquipTypes(await api.get('/vehicles/equipment-types')); }
    catch (err) { setError(err.message); }
  }
  async function renameType() {
    try { await api.put(`/vehicles/equipment-types/${renaming.id}`, { name: renaming.name }); setRenaming(null); setEquipTypes(await api.get('/vehicles/equipment-types')); load(); }
    catch (err) { setError(err.message); }
  }
  async function deleteType(tp) {
    if (!window.confirm(`${t('¿Eliminar de la lista el tipo')} "${tp.name}"?`)) return;
    try { await api.del(`/vehicles/equipment-types/${tp.id}`); setEquipTypes(await api.get('/vehicles/equipment-types')); }
    catch (err) { setError(err.message); }
  }

  async function saveEquip(e) {
    e.preventDefault();
    if (!equipForm.typeName.trim()) { setError(t('Escribe o elige el tipo de equipo')); return; }
    try {
      if (editingEquip) await api.put(`/vehicles/equipment/${editingEquip.id}`, equipForm);
      else await api.post(`/vehicles/${id}/equipment`, equipForm);
      setEquipModalOpen(false); setEditingEquip(null);
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
    setEditingWo(null);
    setWoMechanicId(''); setWoStatus('pendiente');
    setWoServices([{ serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 }]);
    setWoNotes(''); setWoDiagnosis(''); setWoResolution(''); setWoParts([]);
    setError(''); setWoModalOpen(true);
  }

  function openEditWo(wo) {
    setEditingWo(wo);
    setWoMechanicId(wo.mechanic_id || ''); setWoStatus(wo.status);
    setWoServices(
      wo.services.length > 0
        ? wo.services.map((s) => ({ serviceId: s.service_id || '', description: s.description, pricingType: s.pricing_type, hours: s.hours ?? 0, hourlyRate: s.hourly_rate ?? 0, flatPrice: s.flat_price ?? 0 }))
        : [{ serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 }]
    );
    setWoNotes(wo.notes || ''); setWoDiagnosis(wo.diagnosis || ''); setWoResolution(wo.resolution || '');
    setWoParts((wo.parts || []).map((p) => ({ description: p.description, action: p.action, quantity: p.quantity, unitCost: p.unit_cost, notes: p.notes || '' })));
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
  function addWoPartRow() { setWoParts([...woParts, { description: '', action: 'reemplazada', quantity: 1, unitCost: 0, notes: '' }]); }
  function removeWoPartRow(idx) { setWoParts(woParts.filter((_, i) => i !== idx)); }
  async function saveServiceToCatalog(idx) {
    const row = woServices[idx];
    if (!row.description) return;
    try {
      const created = await api.post('/services', {
        name: row.description, pricingType: row.pricingType,
        hourlyRate: row.hourlyRate || 0, flatPrice: row.flatPrice || 0, active: true,
      });
      const refreshed = await api.get('/services', { active: 'true' });
      setServices(refreshed);
      const copy = [...woServices];
      copy[idx] = { ...copy[idx], serviceId: created.id };
      setWoServices(copy);
    } catch (err) { setError(err.message); }
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
        notes: p.notes || null,
      })),
    };
    try {
      if (editingWo) {
        await api.put(`/work-orders/${editingWo.id}`, { ...payload, status: woStatus });
      } else {
        await api.post('/work-orders', payload);
      }
      setWoModalOpen(false); setEditingWo(null); load();
    } catch (err) { setError(err.message); }
  }

  async function uploadWoPhotos(fileList) {
    if (!editingWo || !fileList || fileList.length === 0) return;
    const fd = new FormData();
    Array.from(fileList).forEach((file) => fd.append('photos', file));
    setUploadingPhotos(true);
    try {
      const updated = await api.postForm(`/work-orders/${editingWo.id}/photos`, fd);
      setEditingWo(updated);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingPhotos(false);
    }
  }

  async function deleteWoPhoto(photoId) {
    if (!editingWo || !window.confirm(t('¿Eliminar esta foto?'))) return;
    await api.del(`/work-orders/${editingWo.id}/photos/${photoId}`);
    const updated = await api.get(`/work-orders/${editingWo.id}`);
    setEditingWo(updated);
    load();
  }

  function toggleWoSelect(woId) {
    setSelectedWoIds((cur) => (cur.includes(woId) ? cur.filter((x) => x !== woId) : [...cur, woId]));
  }

  async function invoiceSelected() {
    if (selectedWoIds.length === 0) return;
    const numbers = vehicle.workOrders.filter((wo) => selectedWoIds.includes(wo.id)).map((wo) => wo.number).join(', ');
    if (!window.confirm(`${t('¿Generar una factura con estas órdenes de trabajo?')} ${numbers}`)) return;
    setInvoicing(true);
    try {
      const invoice = await api.post('/invoices/from-work-orders', { workOrderIds: selectedWoIds });
      navigate(`/facturas/${invoice.id}`);
    } catch (err) {
      alert(err.message);
      setInvoicing(false);
    }
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
          <Link to={`/garantias?nuevo=reclamo&vehiculo=${id}`} className="btn">{t('🛡️ Reclamar garantía')}</Link>
          <button className="btn" onClick={openEditVehicle}>{t('✏️ Editar recepción')}</button>
          <Link to={`/vehiculos/${id}/documento`} className="btn btn-primary">{t('Imprimir recepción')}</Link>
          <button className="btn btn-danger" onClick={remove}>{t('Eliminar')}</button>
        </div>
      </div>
      <div className="content">
        <div className="grid grid-2">
          <div className="card">
            <div className="card-title">{t('Datos del vehículo')}</div>
            {vehicle.photo_url && <img src={vehicle.photo_url} className="thumb-lg" style={{ marginBottom: 12 }} />}
            <div><strong>{t('Cliente:')}</strong> {vehicle.customer_name ? <Link to={`/clientes/${vehicle.customer_id}`}>{vehicle.customer_name}</Link> : '—'}</div>
            {vehicle.customer_id && (
              <>
                <div><strong>{t('NIT/ID:')}</strong> {vehicle.customer_tax_id || '—'}</div>
                <div><strong>{t('Dirección:')}</strong> {vehicle.customer_address || '—'} {vehicle.customer_city || ''} {vehicle.customer_zip || ''}</div>
                <div><strong>{t('Teléfono:')}</strong> {vehicle.customer_phone || '—'}</div>
                <div><strong>{t('Email:')}</strong> {vehicle.customer_email || '—'}</div>
              </>
            )}
            <div><strong>{t('Placa:')}</strong> {vehicle.plate || '—'}</div>
            <div><strong>{t('Recibido:')}</strong> {vehicle.received_at}</div>
            <div><strong>{t('Notas:')}</strong> {vehicle.notes || '—'}</div>
          </div>

          <div className="card">
            <div className="card-title">
              {t('Equipos instalados en el chasis')}
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={() => { setError(''); setTypesOpen(true); }}>{t('Lista de equipos')}</button>
                <button className="btn btn-sm btn-primary" onClick={openEquipModal}>{t('+ Agregar equipo')}</button>
              </span>
            </div>
            {installedSerials.length > 0 && (
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                🔢 {t('Unidades del inventario instaladas:')}{' '}
                {installedSerials.map((sr, i) => <React.Fragment key={sr.id}>{i > 0 && ', '}<Link to={`/seriales?producto=${sr.product_id}`} className="mono">{sr.serial}</Link> ({sr.product_name})</React.Fragment>)}
              </div>
            )}
            {vehicle.equipment.length === 0 ? <div className="empty-state">{t('Sin equipos registrados aún.')}</div> : (
              <table>
                <thead><tr><th>{t('Tipo')}</th><th>{t('Serie')}</th><th>{t('Fabricante')}</th><th>{t('Modelo')}</th><th></th></tr></thead>
                <tbody>
                  {vehicle.equipment.map((e) => (
                    <tr key={e.id}>
                      <td>{e.equipment_type_name || e.custom_type_name}</td>
                      <td className="mono">{e.serial_number || '—'}</td>
                      <td>{e.manufacturer || '—'}</td>
                      <td>{e.model || '—'}</td>
                      <td><div className="row-actions">
                        <button className="btn-row-action edit" onClick={() => openEditEquip(e)}>{t('Editar')}</button>
                        <button className="btn-row-action delete" onClick={() => deleteEquip(e.id)}>{t('Eliminar')}</button>
                      </div></td>
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
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedWoIds.length > 0 && (
                <button type="button" className="btn btn-sm btn-primary" disabled={invoicing} onClick={invoiceSelected}>
                  {invoicing ? t('Generando…') : `${t('Facturar seleccionadas')} (${selectedWoIds.length})`}
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={openWoModal}>{t('+ Nueva orden de trabajo')}</button>
            </div>
          </div>
          {vehicle.workOrders.length === 0 ? <div className="empty-state">{t('Sin órdenes de trabajo todavía.')}</div> : (
            <table>
              <thead><tr><th></th><th>{t('Número')}</th><th>{t('Mecánico')}</th><th>{t('Estado')}</th><th>{t('Fecha')}</th><th></th><th></th></tr></thead>
              <tbody>
                {vehicle.workOrders.map((wo) => {
                  const facturable = wo.status === 'completado' && !wo.invoice_id;
                  return (
                    <tr key={wo.id}>
                      <td>
                        {facturable && (
                          <input type="checkbox" style={{ width: 'auto' }} checked={selectedWoIds.includes(wo.id)} onChange={() => toggleWoSelect(wo.id)} />
                        )}
                      </td>
                      <td className="mono">{wo.number}</td>
                      <td>{wo.mechanic_name || '—'}</td>
                      <td><Pill value={wo.status} /></td>
                      <td className="muted">{wo.created_at}</td>
                      <td>
                        {wo.invoice_id ? (
                          <Link className="btn-row-action" to={`/facturas/${wo.invoice_id}`}>{t('Ver factura')} {wo.invoice_number}</Link>
                        ) : (
                          <button className="btn-row-action edit" onClick={() => openEditWo(wo)}>{t('Editar')}</button>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}><Link to={`/ordenes-trabajo/${wo.id}/documento`}>{t('Documento')}</Link> · <Link to={`/pagos-sin-factura?nuevo=1&vehiculo=${id}&orden=${wo.id}`} title={t('Registrar pago a un proveedor de servicios sin factura')}>{t('Pago sin factura')}</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>{t('Gestiona el detalle de horas/servicios de cada orden en')} <Link to="/ordenes-trabajo">{t('Órdenes de Trabajo')}</Link>. {t('Las órdenes marcadas como "completado" pueden facturarse: selecciónalas con la casilla y haz clic en "Facturar seleccionadas".')}</div>
        </div>

        <div className="card">
          <div className="card-title">
            {t('Pagos a proveedores sin factura')}
            <Link className="btn btn-sm" to={`/pagos-sin-factura?nuevo=1&vehiculo=${id}`}>{t('+ Pago sin factura')}</Link>
          </div>
          {vouchers.length === 0 ? <div className="empty-state">{t('Ningún pago a terceros registrado para este vehículo.')}</div> : (
            <table>
              <thead><tr><th>{t('Número')}</th><th>{t('Fecha')}</th><th>{t('Proveedor')}</th><th>{t('Trabajo')}</th><th>{t('Orden')}</th><th className="text-right">{t('Monto')}</th><th></th></tr></thead>
              <tbody>
                {vouchers.map((sv) => (
                  <tr key={sv.id}>
                    <td className="mono"><Link to={`/pagos-sin-factura/${sv.id}/documento`}>{sv.number}</Link></td>
                    <td className="muted">{sv.service_date}</td>
                    <td>{sv.supplier_name}</td>
                    <td>{sv.service_type ? <strong>{sv.service_type}: </strong> : null}{String(sv.description).slice(0, 70)}{String(sv.description).length > 70 ? '…' : ''}</td>
                    <td className="mono muted">{sv.work_order_number || '—'}</td>
                    <td className="text-right">${Number(sv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td><Pill value={sv.bill_status || 'pendiente'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {vouchers.length > 0 && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('Total pagado a terceros en este vehículo:')} <strong>${vouchers.reduce((s, x) => s + Number(x.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></div>}
        </div>
      </div>

      {equipModalOpen && (
        <Modal title={editingEquip ? t('Editar equipo instalado') : t('Agregar equipo instalado')} onClose={() => setEquipModalOpen(false)}>
          <form onSubmit={saveEquip} noValidate>
            {error && <div className="error-banner">{error}</div>}
            <div className="field">
              <label>{t('Tipo de equipo *')}</label>
              <input list="equipment-types-list" placeholder={t('Escribe o elige: Grúa, Compresor, Bucket lift…')} value={equipForm.typeName}
                onChange={(e) => setEquipForm({ ...equipForm, typeName: e.target.value })} />
              <datalist id="equipment-types-list">
                {equipTypes.map((t2) => <option key={t2.id} value={t2.name} />)}
              </datalist>
              {equipForm.typeName.trim() && !equipTypes.some((t2) => t2.name.toLowerCase() === equipForm.typeName.trim().toLowerCase()) && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>✚ {t('Tipo nuevo: se agregará a la lista de equipos al guardar.')}</div>
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

      {editOpen && (
        <Modal title={`${t('Editar recepción')} · ${vehicle.vin}`} onClose={() => setEditOpen(false)} wide>
          <form onSubmit={saveVehicle} noValidate>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t('Completa o corrige los datos que faltaban al recibir el vehículo.')}</div>
            <div className="field"><label>{t('VIN *')}</label><input className="mono" value={vForm.vin} onChange={(e) => setVForm({ ...vForm, vin: e.target.value.toUpperCase() })} /></div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Marca')}</label><input value={vForm.make} onChange={(e) => setVForm({ ...vForm, make: e.target.value })} /></div>
              <div className="field"><label>{t('Modelo')}</label><input value={vForm.model} onChange={(e) => setVForm({ ...vForm, model: e.target.value })} /></div>
              <div className="field"><label>{t('Año')}</label><input inputMode="numeric" value={vForm.year} onChange={(e) => setVForm({ ...vForm, year: e.target.value })} /></div>
              <div className="field"><label>{t('Tipo de chasis')}</label><input placeholder="CA, DRW, SRW..." value={vForm.chassisType} onChange={(e) => setVForm({ ...vForm, chassisType: e.target.value })} /></div>
              <div className="field"><label>{t('Placa')}</label><input value={vForm.plate} onChange={(e) => setVForm({ ...vForm, plate: e.target.value })} /></div>
              <div className="field"><label>{t('Cliente / empresa')}</label>
                <CustomerPicker freeText customers={customers} placeholder={t('Escribe o elige el cliente')} value={vForm.customerName} onChange={(name) => setVForm((f) => ({ ...f, customerName: name }))} />
                {vForm.customerName.trim() && !customers.some((c) => c.name.trim().toLowerCase() === vForm.customerName.trim().toLowerCase()) && (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>✚ {t('Cliente nuevo: se creará en Clientes al guardar y quedará enlazado al vehículo.')}</div>
                )}
              </div>
              <div className="field"><label>{t('Estado')}</label>
                <select value={vForm.status} onChange={(e) => setVForm({ ...vForm, status: e.target.value })}>
                  {VEHICLE_STATUSES.map((st) => <option key={st} value={st}>{t(st.replace(/_/g, ' '))}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Fecha de recepción')}</label><input type="date" value={vForm.receivedAt} onChange={(e) => setVForm({ ...vForm, receivedAt: e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Cambiar foto del vehículo')}</label><input type="file" accept="image/*" onChange={(e) => setVPhoto(e.target.files[0] || null)} /></div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={3} value={vForm.notes} onChange={(e) => setVForm({ ...vForm, notes: e.target.value })} /></div>
            {error && <div className="error-banner">{error}</div>}
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setEditOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar cambios')}</button>
            </div>
          </form>
        </Modal>
      )}

      {typesOpen && (
        <Modal title={t('Lista de equipos')} onClose={() => { setTypesOpen(false); setRenaming(null); }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t('Esta lista aparece al agregar un equipo a cualquier vehículo. Los tipos nuevos que escribas al agregar un equipo se suman aquí solos.')}</div>
          <form onSubmit={addType} style={{ display: 'flex', gap: 8, marginBottom: 12 }} noValidate>
            <input placeholder={t('Nuevo tipo de equipo')} value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm" style={{ whiteSpace: 'nowrap' }}>{t('+ Agregar')}</button>
          </form>
          {error && <div className="error-banner">{error}</div>}
          <table>
            <tbody>
              {equipTypes.map((tp) => (
                <tr key={tp.id}>
                  <td>{renaming && renaming.id === tp.id
                    ? <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') renameType(); }} />
                    : <>{tp.name} {tp.uses ? <span className="muted" style={{ fontSize: 12 }}>· {tp.uses} {t('en uso')}</span> : null}</>}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {renaming && renaming.id === tp.id
                      ? <><button className="btn-row-action edit" onClick={renameType}>{t('Guardar')}</button> <button className="btn-row-action" onClick={() => setRenaming(null)}>{t('Cancelar')}</button></>
                      : <><button className="btn-row-action edit" onClick={() => { setError(''); setRenaming({ id: tp.id, name: tp.name }); }}>{t('Renombrar')}</button> {!tp.uses && <button className="btn-row-action delete" onClick={() => deleteType(tp)}>{t('Eliminar')}</button>}</>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {woModalOpen && (
        <Modal title={editingWo ? `${t('Editar orden de trabajo')} ${editingWo.number}` : t('Nueva orden de trabajo')} onClose={() => { setWoModalOpen(false); setEditingWo(null); }} wide>
          <form onSubmit={saveWorkOrder}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field">
                <label>{t('Mecánico asignado')}</label>
                <select value={woMechanicId} onChange={(e) => setWoMechanicId(e.target.value)}>
                  <option value="">{t('— Sin asignar —')}</option>
                  {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              {editingWo && (
                <div className="field">
                  <label>{t('Estado')}</label>
                  <select value={woStatus} onChange={(e) => setWoStatus(e.target.value)}>
                    <option value="pendiente">{t('Pendiente')}</option>
                    <option value="en_proceso">{t('En proceso')}</option>
                    <option value="completado">{t('Completado')}</option>
                    <option value="facturado">{t('Facturado')}</option>
                  </select>
                </div>
              )}
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
                          {services.map((sv) => <option key={sv.id} value={sv.id}>{pickLang(sv.name, sv.name_en, lang)}</option>)}
                        </select>
                      </td>
                      <td>
                        <input value={s.description} onChange={(e) => updateWoService(idx, 'description', e.target.value)} />
                        {!s.serviceId && s.description && (
                          <button type="button" className="link-btn" style={{ fontSize: 11 }} onClick={() => saveServiceToCatalog(idx)}>{t('Guardar en catálogo')}</button>
                        )}
                      </td>
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
              <thead><tr><th>{t('Descripción')}</th><th style={{ width: 150 }}>{t('Acción')}</th><th style={{ width: 80 }}>{t('Cant.')}</th><th style={{ width: 110 }}>{t('Costo unit.')}</th><th style={{ width: 200 }}>{t('Nota (opcional)')}</th><th></th></tr></thead>
              <tbody>
                {woParts.map((p, idx) => (
                  <tr key={idx}>
                    <td><input value={p.description} onChange={(e) => updateWoPart(idx, 'description', e.target.value)} /></td>
                    <td>
                      <select value={p.action} onChange={(e) => updateWoPart(idx, 'action', e.target.value)}>
                        <option value="reemplazada">{t('Reemplazada')}</option>
                        <option value="reparada">{t('Reparada')}</option>
                        <option value="garantia">{t('Garantía')}</option>
                        <option value="cliente">{t('Suministrada por el cliente')}</option>
                      </select>
                    </td>
                    <td><input type="number" step="1" value={p.quantity} onChange={(e) => updateWoPart(idx, 'quantity', e.target.value)} /></td>
                    <td><input type="number" step="0.01" value={p.unitCost} onChange={(e) => updateWoPart(idx, 'unitCost', e.target.value)} /></td>
                    <td><input placeholder={t('Nota sobre la parte (ej. garantía, quién la suministró, etc.)')} value={p.notes || ''} onChange={(e) => updateWoPart(idx, 'notes', e.target.value)} /></td>
                    <td><button type="button" className="link-btn" onClick={() => removeWoPartRow(idx)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addWoPartRow}>{t('+ Agregar parte')}</button>

            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)', marginTop: 16, display: 'block' }}>{t('Fotos')}</label>
            {editingWo ? (
              <div className="photo-gallery">
                {(editingWo.photos || []).map((p) => (
                  <div className="photo-gallery-item" key={p.id}>
                    <img src={p.photo_url} />
                    <button type="button" className="photo-gallery-remove" onClick={() => deleteWoPhoto(p.id)}>✕</button>
                  </div>
                ))}
                <label className="photo-gallery-add">
                  {uploadingPhotos ? t('Subiendo…') : t('+ Agregar fotos')}
                  <input type="file" accept="image/*" multiple hidden disabled={uploadingPhotos} onChange={(e) => { uploadWoPhotos(e.target.files); e.target.value = ''; }} />
                </label>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('Guarda la orden de trabajo primero para poder adjuntar fotos.')}</div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => { setWoModalOpen(false); setEditingWo(null); }}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{editingWo ? t('Guardar cambios') : t('Crear orden de trabajo')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
