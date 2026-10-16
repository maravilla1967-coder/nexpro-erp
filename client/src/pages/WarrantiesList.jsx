import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';

// Garantías: reclamos al fabricante y registros de garantía de equipos comprados.
// Se puede abrir con parámetros para llegar con el formulario ya lleno:
//   /garantias?nuevo=reclamo&vehiculo=ID   (desde la Recepción de Vehículos)
//   /garantias?nuevo=registro&oc=ID        (desde una Orden de Compra)

const CLAIM_STATUSES = ['abierta', 'enviada', 'aprobada', 'rechazada', 'cerrada'];
const REG_STATUSES = ['registrada', 'cerrada'];

const EMPTY = {
  kind: 'reclamo', status: 'abierta', productSerialId: '', vehicleId: '', vehicleEquipmentId: '', purchaseOrderId: '',
  supplierId: '', customerId: '', responsibleUserId: '', itemDescription: '', vin: '', serialNumber: '',
  manufacturer: '', model: '', year: '', purchaseDate: '', warrantyStart: '', warrantyEnd: '',
  claimDate: '', manufacturerClaimNumber: '', problemDescription: '', resolution: '',
  claimAmount: '', approvedAmount: '', notes: '',
};

function fromRow(w) {
  return {
    kind: w.kind, status: w.status, productSerialId: w.product_serial_id || '', vehicleId: w.vehicle_id || '', vehicleEquipmentId: w.vehicle_equipment_id || '',
    purchaseOrderId: w.purchase_order_id || '', supplierId: w.supplier_id || '', customerId: w.customer_id || '',
    responsibleUserId: w.responsible_user_id || '', itemDescription: w.item_description || '', vin: w.vin || '',
    serialNumber: w.serial_number || '', manufacturer: w.manufacturer || '', model: w.model || '', year: w.year || '',
    purchaseDate: w.purchase_date || '', warrantyStart: w.warranty_start || '', warrantyEnd: w.warranty_end || '',
    claimDate: w.claim_date || '', manufacturerClaimNumber: w.manufacturer_claim_number || '',
    problemDescription: w.problem_description || '', resolution: w.resolution || '',
    claimAmount: w.claim_amount ?? '', approvedAmount: w.approved_amount ?? '', notes: w.notes || '',
  };
}

function today() { return new Date().toISOString().slice(0, 10); }
export function isExpired(w) { return w.warranty_end && w.warranty_end < today(); }

const wDate = (r) => r.claim_date || r.purchase_date || r.created_at;
const wNumber = (r) => r.number;
const W_COLUMNS = [
  { label: 'Número', value: (r) => r.number, mono: true },
  { label: 'Tipo', value: (r) => (r.kind === 'registro' ? 'Registro' : 'Reclamo') },
  { label: 'Estado', value: (r) => r.status },
  { label: 'VIN', value: (r) => r.vin, mono: true },
  { label: 'Equipo / descripción', value: (r) => r.item_description || r.equipment_type_name },
  { label: 'Serie', value: (r) => r.serial_number },
  { label: 'Fabricante', value: (r) => r.manufacturer || r.supplier_name },
  { label: 'Modelo', value: (r) => r.model },
  { label: 'Año', value: (r) => r.year },
  { label: 'Fecha de compra', value: (r) => r.purchase_date },
  { label: 'Garantía hasta', value: (r) => r.warranty_end },
  { label: 'Responsable', value: (r) => r.responsible_name },
  { label: 'Orden de compra', value: (r) => r.purchase_order_number },
  { label: 'Monto reclamado', value: (r) => r.claim_amount, type: 'money' },
  { label: 'Monto aprobado', value: (r) => r.approved_amount, type: 'money' },
];

export default function WarrantiesList() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [kindFilter, setKindFilter] = useState('');
  const shown = kindFilter ? list.filter((w) => w.kind === kindFilter) : list;
  const ex = useListExport({ rows: shown, getDate: wDate, getNumber: wNumber });

  const [vehicles, setVehicles] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pos, setPos] = useState([]);
  const [people, setPeople] = useState([]);
  const [serials, setSerials] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  function load() { return api.get('/warranties').then(setList).catch(console.error); }

  useEffect(() => {
    load();
    api.get('/vehicles').then(setVehicles).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/purchase-orders').then(setPos).catch(() => {});
    api.get('/warranties/responsibles').then(setPeople).catch(() => {});
    api.get('/serials').then(setSerials).catch(() => {});
  }, []);

  // Abrir el formulario ya lleno cuando se llega desde un vehículo o una orden de compra.
  useEffect(() => {
    const nuevo = params.get('nuevo');
    if (!nuevo) return;
    const kind = nuevo === 'registro' ? 'registro' : 'reclamo';
    (async () => {
      let f = { ...EMPTY, kind, status: kind === 'registro' ? 'registrada' : 'abierta' };
      if (kind === 'reclamo') f.claimDate = today();
      const vId = params.get('vehiculo');
      const poId = params.get('oc');
      const snId = params.get('serial');
      if (snId) f = await applySerial(f, snId);
      if (vId) f = await applyVehicle(f, vId);
      if (poId) f = await applyPo(f, poId);
      setEditing(null); setForm(f); setError(''); setModalOpen(true);
      setParams({}, { replace: true });
    })();
  }, [params]);

  async function applyVehicle(f, vehicleId) {
    if (!vehicleId) { setEquipment([]); return { ...f, vehicleId: '', vehicleEquipmentId: '' }; }
    const v = await api.get(`/vehicles/${vehicleId}`);
    setEquipment(v.equipment || []);
    return {
      ...f, vehicleId: v.id, vehicleEquipmentId: '', vin: v.vin || f.vin,
      manufacturer: v.make || f.manufacturer, model: v.model || f.model, year: v.year || f.year,
      customerId: v.customer_id || f.customerId,
      itemDescription: f.itemDescription || [v.make, v.model, v.year].filter(Boolean).join(' '),
    };
  }

  function applyEquipment(f, eqId) {
    const eq = equipment.find((e) => String(e.id) === String(eqId));
    if (!eq) return { ...f, vehicleEquipmentId: '' };
    return {
      ...f, vehicleEquipmentId: eq.id, serialNumber: eq.serial_number || '',
      manufacturer: eq.manufacturer || f.manufacturer, model: eq.model || f.model,
      itemDescription: [eq.equipment_type_name || eq.custom_type_name, eq.manufacturer, eq.model].filter(Boolean).join(' '),
    };
  }

  // Elegir la unidad del inventario por su número de serie llena todo lo que se sabe de ella:
  // producto, proveedor, orden de compra, fecha de recepción y, si ya se instaló, el camión.
  async function applySerial(f, serialId) {
    if (!serialId) return { ...f, productSerialId: '' };
    const sn = await api.get(`/serials/${serialId}`);
    let out = {
      ...f, productSerialId: sn.id, serialNumber: sn.serial, itemDescription: sn.product_name,
      model: f.model || sn.product_sku || '', manufacturer: sn.supplier_name || f.manufacturer,
      supplierId: sn.supplier_id || f.supplierId, purchaseOrderId: sn.purchase_order_id || f.purchaseOrderId,
      purchaseDate: sn.received_date || f.purchaseDate, warrantyStart: f.warrantyStart || sn.received_date || '',
      customerId: sn.customer_id || f.customerId,
    };
    if (sn.vehicle_id) {
      const keep = { serialNumber: out.serialNumber, itemDescription: out.itemDescription, manufacturer: out.manufacturer, model: out.model };
      out = { ...(await applyVehicle(out, sn.vehicle_id)), ...keep };
    }
    return out;
  }

  async function applyPo(f, poId) {
    if (!poId) return { ...f, purchaseOrderId: '' };
    const po = await api.get(`/purchase-orders/${poId}`);
    const desc = (po.items || []).map((i) => i.description).filter(Boolean).join('; ');
    return {
      ...f, purchaseOrderId: po.id, supplierId: po.supplier_id || f.supplierId,
      manufacturer: f.manufacturer || po.supplier_name || '',
      purchaseDate: po.order_date || f.purchaseDate, warrantyStart: f.warrantyStart || po.order_date || '',
      itemDescription: f.itemDescription || desc,
    };
  }

  function openNew(kind) {
    setEditing(null); setEquipment([]);
    setForm({ ...EMPTY, kind, status: kind === 'registro' ? 'registrada' : 'abierta', claimDate: kind === 'reclamo' ? today() : '' });
    setError(''); setModalOpen(true);
  }

  async function openEdit(w) {
    const full = await api.get(`/warranties/${w.id}`);
    setEditing(full); setForm(fromRow(full)); setError('');
    if (full.vehicle_id) api.get(`/vehicles/${full.vehicle_id}`).then((v) => setEquipment(v.equipment || [])).catch(() => setEquipment([]));
    else setEquipment([]);
    setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      const saved = editing ? await api.put(`/warranties/${editing.id}`, form) : await api.post('/warranties', form);
      await load();
      // Al crear, el formulario queda abierto en modo edición para poder adjuntar archivos de una vez.
      if (!editing) { setEditing(saved); setForm(fromRow(saved)); }
      else { setModalOpen(false); setEditing(null); }
    } catch (err) { setError(err.message); }
  }

  async function remove(w) {
    if (!window.confirm(t('¿Eliminar esta garantía?'))) return;
    await api.del(`/warranties/${w.id}`);
    setModalOpen(false); setEditing(null); load();
  }

  async function upload(files) {
    if (!editing || !files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    setUploading(true);
    try { setEditing(await api.postForm(`/warranties/${editing.id}/attachments`, fd)); load(); }
    catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function removeFile(attId) {
    if (!window.confirm(t('¿Eliminar este archivo adjunto?'))) return;
    await api.del(`/warranties/${editing.id}/attachments/${attId}`);
    setEditing(await api.get(`/warranties/${editing.id}`));
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isClaim = form.kind === 'reclamo';
  const statuses = isClaim ? CLAIM_STATUSES : REG_STATUSES;

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Garantías')}</h1><div className="sub">{t('Reclamos al fabricante y registro de garantías de equipos')}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => openNew('registro')}>{t('+ Registrar garantía')}</button>
          <button className="btn btn-primary" onClick={() => openNew('reclamo')}>{t('+ Reclamo de garantía')}</button>
        </div>
      </div>
      <div className="content">
        <div className="toolbar">
          <div className="seg">
            {[['', 'Todas'], ['reclamo', 'Reclamos'], ['registro', 'Registros']].map(([k, label]) => (
              <button key={k} className={`seg-btn ${kindFilter === k ? 'active' : ''}`} onClick={() => setKindFilter(k)}>{t(label)}</button>
            ))}
          </div>
        </div>
        <div className="card">
          {shown.length === 0 ? <div className="empty-state">{t('No hay garantías todavía.')}</div> : (
            <>
              <ListExportBar ex={ex} title={t('Garantías')} filename="garantias" columns={W_COLUMNS} />
              <table>
                <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Número')}</th><th>{t('Tipo')}</th><th>{t('VIN / Serie')}</th><th>{t('Equipo')}</th><th>{t('Responsable')}</th><th>{t('Estado')}</th><th>{t('Garantía hasta')}</th><th></th></tr></thead>
                <tbody>
                  {ex.visible.map((w) => (
                    <tr key={w.id}>
                      <td><RowBox ex={ex} row={w} /></td>
                      <td className="mono clickable" onClick={() => openEdit(w)}>{w.number}</td>
                      <td>{w.kind === 'registro' ? t('Registro') : t('Reclamo')}</td>
                      <td className="mono muted">{w.vin || '—'}{w.serial_number ? <div>{t('S/N')} {w.serial_number}</div> : null}</td>
                      <td>{w.item_description || w.equipment_type_name || '—'}<div className="muted" style={{ fontSize: 12 }}>{[w.manufacturer, w.model, w.year].filter(Boolean).join(' · ')}</div></td>
                      <td className="muted">{w.responsible_name || '—'}</td>
                      <td><Pill value={w.status} /></td>
                      <td className="muted">{w.warranty_end ? <>{w.warranty_end}{isExpired(w) && <> <Pill value="vencida" /></>}</> : '—'}</td>
                      <td style={{ display: 'flex', gap: 10 }}>
                        <Link className="link-btn" to={`/garantias/${w.id}/documento`}>{t('Imprimir')}</Link>
                        <button className="link-btn" onClick={() => openEdit(w)}>{t('Editar')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal
          title={editing ? `${isClaim ? t('Reclamo de garantía') : t('Registro de garantía')} ${editing.number}` : (isClaim ? t('Nuevo reclamo de garantía') : t('Registrar garantía'))}
          onClose={() => { setModalOpen(false); setEditing(null); }} wide
        >
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t('Ningún campo es obligatorio: llena lo que tengas.')}</div>

            <div className="form-section">{t('Vehículo / equipo')}</div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Vehículo (Recepción de Vehículos)')}</label>
                <select value={form.vehicleId} onChange={async (e) => setForm(await applyVehicle(form, e.target.value))}>
                  <option value="">{t('— Ninguno —')}</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vin} · {[v.make, v.model, v.year].filter(Boolean).join(' ')}{v.customer_name ? ` · ${v.customer_name}` : ''}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Equipo instalado')}</label>
                <select value={form.vehicleEquipmentId} disabled={!form.vehicleId || equipment.length === 0} onChange={(e) => setForm(applyEquipment(form, e.target.value))}>
                  <option value="">{form.vehicleId ? (equipment.length ? t('— El camión completo —') : t('Sin equipos registrados')) : t('Elige primero un vehículo')}</option>
                  {equipment.map((eq) => <option key={eq.id} value={eq.id}>{[eq.equipment_type_name || eq.custom_type_name, eq.manufacturer, eq.model].filter(Boolean).join(' ')}{eq.serial_number ? ` · S/N ${eq.serial_number}` : ''}</option>)}
                </select>
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>{t('Unidad del inventario (número de serie)')}</label>
                <select value={form.productSerialId} onChange={async (e) => setForm(await applySerial(form, e.target.value))}>
                  <option value="">{t('— Ninguna —')}</option>
                  {serials.filter((sn) => sn.status !== 'dado_de_baja').map((sn) => <option key={sn.id} value={sn.id}>{sn.serial} · {sn.product_name}{sn.customer_name ? ` · ${sn.customer_name}` : ''}{sn.vehicle_vin ? ` · VIN ${sn.vehicle_vin}` : ''}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('VIN')}</label><input className="mono" value={form.vin} onChange={set('vin')} /></div>
              <div className="field"><label>{t('No. de serie')}</label><input className="mono" value={form.serialNumber} onChange={set('serialNumber')} /></div>
              <div className="field" style={{ gridColumn: '1 / -1' }}><label>{t('Equipo / descripción')}</label><input value={form.itemDescription} onChange={set('itemDescription')} /></div>
              <div className="field"><label>{t('Fabricante')}</label><input value={form.manufacturer} onChange={set('manufacturer')} /></div>
              <div className="field"><label>{t('Modelo')}</label><input value={form.model} onChange={set('model')} /></div>
              <div className="field"><label>{t('Año')}</label><input type="number" value={form.year} onChange={set('year')} /></div>
              <div className="field"><label>{t('Fecha de compra')}</label><input type="date" value={form.purchaseDate} onChange={set('purchaseDate')} /></div>
            </div>

            <div className="form-section">{t('Garantía')}</div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Garantía desde')}</label><input type="date" value={form.warrantyStart} onChange={set('warrantyStart')} /></div>
              <div className="field"><label>{t('Garantía hasta')}</label><input type="date" value={form.warrantyEnd} onChange={set('warrantyEnd')} /></div>
              <div className="field"><label>{t('Proveedor / fabricante (para el reclamo)')}</label>
                <select value={form.supplierId} onChange={set('supplierId')}>
                  <option value="">{t('— Ninguno —')}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Orden de compra')}</label>
                <select value={form.purchaseOrderId} onChange={async (e) => setForm(await applyPo(form, e.target.value))}>
                  <option value="">{t('— Ninguna —')}</option>
                  {pos.map((p) => <option key={p.id} value={p.id}>{p.number} · {p.supplier_name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Cliente')}</label>
                <select value={form.customerId} onChange={set('customerId')}>
                  <option value="">{t('— Ninguno —')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Responsable')}</label>
                <select value={form.responsibleUserId} onChange={set('responsibleUserId')}>
                  <option value="">{t('— Sin asignar —')}</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Estado')}</label>
                <select value={form.status} onChange={set('status')}>
                  {statuses.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                </select>
              </div>
            </div>

            {isClaim && (
              <>
                <div className="form-section">{t('Reclamo al fabricante')}</div>
                <div className="grid grid-2">
                  <div className="field"><label>{t('Fecha del reclamo')}</label><input type="date" value={form.claimDate} onChange={set('claimDate')} /></div>
                  <div className="field"><label>{t('No. de reclamo del fabricante')}</label><input value={form.manufacturerClaimNumber} onChange={set('manufacturerClaimNumber')} /></div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}><label>{t('Falla / problema reportado')}</label><textarea rows={3} value={form.problemDescription} onChange={set('problemDescription')} /></div>
                  <div className="field"><label>{t('Monto reclamado')}</label><input type="number" step="0.01" value={form.claimAmount} onChange={set('claimAmount')} /></div>
                  <div className="field"><label>{t('Monto aprobado')}</label><input type="number" step="0.01" value={form.approvedAmount} onChange={set('approvedAmount')} /></div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}><label>{t('Resolución del fabricante')}</label><textarea rows={2} value={form.resolution} onChange={set('resolution')} /></div>
                </div>
              </>
            )}

            <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={set('notes')} /></div>

            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)', marginTop: 16, display: 'block' }}>
              {isClaim ? t('Archivos adjuntos (fotos de la falla, facturas, etc.)') : t('Constancia del registro de garantía')}
            </label>
            {editing ? (
              <div className="file-list">
                {(editing.attachments || []).map((a) => (
                  <div className="file-list-item" key={a.id}>
                    <a href={a.file_url} target="_blank" rel="noreferrer">{a.original_name || a.file_url.split('/').pop()}</a>
                    <button type="button" className="link-btn" onClick={() => removeFile(a.id)}>✕</button>
                  </div>
                ))}
                <label className="btn btn-sm" style={{ marginTop: 6, display: 'inline-block', cursor: 'pointer' }}>
                  {uploading ? t('Subiendo…') : t('+ Adjuntar archivo')}
                  <input type="file" multiple hidden disabled={uploading} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
                </label>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('Al guardar, el formulario queda abierto para que adjuntes los archivos.')}</div>
            )}

            <div className="modal-footer">
              {editing && <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={() => remove(editing)}>{t('Eliminar')}</button>}
              {editing && <Link className="btn" to={`/garantias/${editing.id}/documento`}>{t('Imprimir')}</Link>}
              <button type="button" className="btn" onClick={() => { setModalOpen(false); setEditing(null); }}>{editing ? t('Cerrar') : t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{editing ? t('Guardar cambios') : t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
