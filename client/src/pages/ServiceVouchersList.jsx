import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
import { PAYMENT_METHODS, methodLabel, readFilesNow } from '../components/PaymentModal.jsx';

// Comprobantes de pago sin factura: pagos a proveedores de servicios que no expiden factura
// (soldador, pintor, técnico independiente…). Se enlazan al vehículo y/o a la orden de trabajo.
//   /pagos-sin-factura?nuevo=1&vehiculo=ID&orden=ID   (desde la Recepción de Vehículos)

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = {
  supplierMode: 'existente', supplierId: '', providerName: '', providerTaxId: '', providerPhone: '', providerAddress: '', providerEmail: '',
  serviceDate: today(), serviceType: '', description: '', amount: '', vehicleId: '', workOrderId: '',
  payNow: '0', method: 'efectivo', reference: '', paymentDate: today(), dueDate: '', receivedBy: '', notes: '',
};
const money = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const COLUMNS = [
  { label: 'Número', value: (r) => r.number, mono: true },
  { label: 'Fecha', value: (r) => r.service_date },
  { label: 'Proveedor', value: (r) => r.supplier_name },
  { label: 'Servicio', value: (r) => r.service_type || '' },
  { label: 'Descripción', value: (r) => r.description },
  { label: 'Vehículo (VIN)', value: (r) => r.vehicle_vin || '' },
  { label: 'Orden de trabajo', value: (r) => r.work_order_number || '' },
  { label: 'Monto', value: (r) => r.amount, type: 'money' },
  { label: 'Saldo', value: (r) => r.balance, type: 'money' },
];

export default function ServiceVouchersList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function load() { api.get('/service-vouchers').then(setList).catch(console.error); }
  useEffect(() => {
    load();
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/vehicles').then((r) => setVehicles(r.rows || r)).catch(() => {});
    api.get('/work-orders').then(setWorkOrders).catch(() => {});
  }, []);
  useEffect(() => {
    if (params.get('nuevo')) {
      setForm({ ...EMPTY, vehicleId: params.get('vehiculo') || '', workOrderId: params.get('orden') || '' });
      setFiles([]); setError(''); setOpen(true);
      setParams({}, { replace: true });
    }
  }, [params]);

  const woOfVehicle = workOrders.filter((w) => !form.vehicleId || String(w.vehicle_id) === String(form.vehicleId));

  async function save(e) {
    e.preventDefault();
    setError('');
    if (form.supplierMode === 'existente' && !form.supplierId) { setError(t('Elige el proveedor o escribe su nombre.')); return; }
    if (form.supplierMode === 'nuevo' && !form.providerName.trim()) { setError(t('Escribe el nombre de quien hizo el trabajo.')); return; }
    const amt = parseFloat(String(form.amount).replace(/[$,\s]/g, '')) || 0;
    if (form.payNow === '1' && !(amt > 0)) { setError(t('Para registrar el pago escribe el monto.')); return; }
    const fd = new FormData();
    const payload = { ...form, amount: amt };
    if (form.supplierMode === 'existente') { ['providerName', 'providerTaxId', 'providerPhone', 'providerAddress', 'providerEmail'].forEach((k) => delete payload[k]); }
    else delete payload.supplierId;
    delete payload.supplierMode;
    Object.entries(payload).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') fd.append(k, String(v)); });
    files.forEach((f) => fd.append('files', f, f.name));
    setSaving(true);
    try {
      const v = await api.postForm('/service-vouchers', fd);
      setOpen(false); setSaving(false); load();
      navigate(`/pagos-sin-factura/${v.id}/documento`);
    } catch (err) { setError(err.message); setSaving(false); }
  }

  const rows = list.filter((r) => !q || `${r.number} ${r.supplier_name} ${r.description} ${r.vehicle_vin || ''} ${r.work_order_number || ''} ${r.service_type || ''}`.toLowerCase().includes(q.toLowerCase()));
  const ex = useListExport({ rows, getDate: (r) => r.service_date, getNumber: (r) => r.number });

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Pagos sin factura')}</h1><div className="sub">{t('Comprobantes de pago a proveedores de servicios que no expiden factura')}</div></div>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setFiles([]); setError(''); setOpen(true); }}>{t('+ Nuevo comprobante')}</button>
      </div>
      <div className="content">
        <div className="toolbar">
          <input className="search-input" placeholder={t('Buscar por proveedor, VIN, orden, descripción…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="card">
          {rows.length === 0 ? <div className="empty-state">{t('No hay comprobantes todavía.')}</div> : (
            <>
              <ListExportBar ex={ex} title={t('Pagos sin factura')} filename="pagos-sin-factura" columns={COLUMNS} />
              <table>
                <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Número')}</th><th>{t('Fecha')}</th><th>{t('Proveedor')}</th><th>{t('Trabajo realizado')}</th><th>{t('Vehículo / Orden')}</th><th className="text-right">{t('Monto')}</th><th>{t('Estado')}</th></tr></thead>
                <tbody>
                  {ex.visible.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => navigate(`/pagos-sin-factura/${r.id}/documento`)}>
                      <td onClick={(e) => e.stopPropagation()}><RowBox ex={ex} row={r} /></td>
                      <td className="mono">{r.number}</td>
                      <td className="muted">{r.service_date}</td>
                      <td>{r.supplier_name}</td>
                      <td style={{ maxWidth: 320 }}>{r.service_type ? <strong>{r.service_type}: </strong> : null}{String(r.description).slice(0, 90)}{String(r.description).length > 90 ? '…' : ''}</td>
                      <td style={{ fontSize: 13 }} onClick={(e) => e.stopPropagation()}>
                        {r.vehicle_id ? <Link className="mono" to={`/vehiculos/${r.vehicle_id}`}>{r.vehicle_vin}</Link> : <span className="muted">—</span>}
                        {r.work_order_number ? <div className="mono muted">{r.work_order_number}</div> : null}
                      </td>
                      <td className="text-right">{r.amount > 0 ? money(r.amount) : <span className="muted">—</span>}</td>
                      <td><Pill value={r.status || r.bill_status || 'pendiente'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {open && (
        <Modal title={t('Nuevo comprobante de pago sin factura')} onClose={() => setOpen(false)} wide>
          <form onSubmit={save} noValidate>
            <div className="form-section-title" style={{ fontWeight: 700, marginBottom: 6 }}>{t('1. Quién hizo el trabajo')}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button type="button" className={`btn btn-sm ${form.supplierMode === 'existente' ? 'btn-primary' : ''}`} onClick={() => setForm({ ...form, supplierMode: 'existente' })}>{t('Proveedor registrado')}</button>
              <button type="button" className={`btn btn-sm ${form.supplierMode === 'nuevo' ? 'btn-primary' : ''}`} onClick={() => setForm({ ...form, supplierMode: 'nuevo' })}>{t('Persona o empresa nueva')}</button>
            </div>
            {form.supplierMode === 'existente' ? (
              <div className="field">
                <select value={form.supplierId} onChange={set('supplierId')}>
                  <option value="">{t('— Seleccionar —')}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ) : (
              <div className="grid grid-2">
                <div className="field"><label>{t('Nombre completo / empresa *')}</label><input value={form.providerName} onChange={set('providerName')} /></div>
                <div className="field"><label>{t('ID / EIN / Licencia')}</label><input value={form.providerTaxId} onChange={set('providerTaxId')} /></div>
                <div className="field"><label>{t('Teléfono')}</label><input value={form.providerPhone} onChange={set('providerPhone')} /></div>
                <div className="field"><label>{t('Email')}</label><input value={form.providerEmail} onChange={set('providerEmail')} /></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}><label>{t('Dirección')}</label><input value={form.providerAddress} onChange={set('providerAddress')} /></div>
                <div className="hint" style={{ gridColumn: '1 / -1' }}>{t('Se guarda en Proveedores para la próxima vez.')}</div>
              </div>
            )}

            <div className="form-section-title" style={{ fontWeight: 700, margin: '14px 0 6px' }}>{t('2. Qué se hizo y dónde')}</div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Fecha del trabajo')}</label><input type="date" value={form.serviceDate} onChange={set('serviceDate')} /></div>
              <div className="field"><label>{t('Tipo de servicio')}</label><input list="sv-types" placeholder={t('Soldadura, pintura, mecánica, eléctrico…')} value={form.serviceType} onChange={set('serviceType')} />
                <datalist id="sv-types">{[...new Set(list.map((r) => r.service_type).filter(Boolean))].map((x) => <option key={x} value={x} />)}</datalist></div>
              <div className="field"><label>{t('Vehículo (VIN)')}</label>
                <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value, workOrderId: '' })}>
                  <option value="">{t('— Ninguno —')}</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vin} · {[v.make, v.model, v.year].filter(Boolean).join(' ')}{v.customer_name ? ` · ${v.customer_name}` : ''}</option>)}
                </select></div>
              <div className="field"><label>{t('Orden de trabajo')}</label>
                <select value={form.workOrderId} onChange={(e) => { const wo = workOrders.find((w) => String(w.id) === e.target.value); setForm({ ...form, workOrderId: e.target.value, vehicleId: wo ? String(wo.vehicle_id) : form.vehicleId }); }}>
                  <option value="">{t('— Ninguna —')}</option>
                  {woOfVehicle.map((w) => <option key={w.id} value={w.id}>{w.number} · {w.vin}</option>)}
                </select></div>
            </div>
            <div className="field"><label>{t('Descripción del trabajo realizado')}</label>
              <textarea rows={5} style={{ resize: 'vertical' }} placeholder={t('Explica qué se hizo, materiales usados, horas trabajadas, resultado…')} value={form.description} onChange={set('description')} /></div>

            <div className="form-section-title" style={{ fontWeight: 700, margin: '14px 0 6px' }}>{t('3. Pago')}</div>
            <div className="grid grid-2">
              <div className="field"><label>{t('Monto del servicio')}</label><input inputMode="decimal" placeholder="0.00" value={form.amount} onChange={set('amount')} /></div>
              <div className="field"><label>{t('¿Ya se pagó?')}</label>
                <select value={form.payNow} onChange={set('payNow')}>
                  <option value="0">{t('No todavía — guardar y pagar después')}</option>
                  <option value="1">{t('Sí, ya se pagó')}</option>
                </select></div>
              {form.payNow === '1' ? <>
                <div className="field"><label>{t('Forma de pago')}</label>
                  <select value={form.method} onChange={set('method')}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{methodLabel(t, m)}</option>)}</select></div>
                <div className="field"><label>{t('Referencia (no. de cheque, Zelle, confirmación…)')}</label><input value={form.reference} onChange={set('reference')} /></div>
                <div className="field"><label>{t('Fecha del pago')}</label><input type="date" value={form.paymentDate} onChange={set('paymentDate')} /></div>
              </> : <div className="field"><label>{t('Fecha en que se debe pagar')}</label><input type="date" value={form.dueDate} onChange={set('dueDate')} /></div>}
              <div className="field"><label>{t('Recibido / aprobado por (Nexpro)')}</label><input value={form.receivedBy} onChange={set('receivedBy')} /></div>
            </div>
            <div className="field"><label>{t('Notas')}</label><input value={form.notes} onChange={set('notes')} /></div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>💾 {t('Puedes guardarlo incompleto (sin monto, descripción o pago) y completarlo después con "Editar" y "Registrar pago" en el comprobante.')}</div>
            <div className="field"><label>{t('Fotos o documentos (trabajo terminado, recibo firmado, captura del pago…)')}</label>
              <input type="file" multiple onChange={async (e) => { const l = Array.from(e.target.files || []); try { setFiles(await readFilesNow(l)); } catch { setFiles(l); } }} />
              {files.length > 0 && <div className="muted" style={{ fontSize: 12 }}>✓ {files.length} {t('archivo(s) listo(s) para adjuntar')}</div>}</div>
            <div className="modal-footer">
              {error && <div className="error-banner" style={{ margin: 0, flexBasis: '100%' }}>{error}</div>}
              <button type="button" className="btn" onClick={() => setOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('Guardando…') : form.payNow === '1' ? t('Guardar y ver comprobante') : t('Guardar (pagar después)')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
