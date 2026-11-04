import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import CustomerPicker from '../components/CustomerPicker.jsx';
import AssigneeSelect, { assigneePayload } from '../components/AssigneeSelect.jsx';
import { api } from '../api.js';
import { useI18n, pickLang } from '../i18n.jsx';

const EMPTY_SERVICE = { serviceId: '', description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 };

// Adivina marca y modelo de lo que se anotó en la llamada: "Vanair Viper G60 Gas-powered…" →
// marca "Vanair", modelo "Viper G60" (hasta la primera palabra con número). Siempre editable.
function guessMakeModel(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).slice(0, 5);
  const idx = words.findIndex((w, i) => i > 0 && /\d/.test(w) && /[a-z]/i.test(w));
  if (idx < 1 || idx > 3) return { make: '', model: '' };
  return { make: words[0].replace(/[,.;:]$/, ''), model: words.slice(1, idx + 1).join(' ').replace(/[,.;:]$/, '') };
}

// Desde la llamada: recibir el equipo / vehículo y abrir la orden de servicio con los datos que ya
// se tomaron, sin volver a escribirlos en Recepción ni en Órdenes de trabajo.
export default function ServiceOrderModal({ request: r, onClose, onDone }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [services, setServices] = useState([]);
  const [equipTypes, setEquipTypes] = useState([]);
  const [existing, setExisting] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const guess = useMemo(() => guessMakeModel(r.notes || r.subject), [r]);
  const equipItem = r.items.find((i) => i.kind === 'equipo');
  const [form, setForm] = useState({
    customerName: r.customer_name || '', vin: '', make: guess.make, model: guess.model, year: '', plate: '',
    notes: [r.subject, r.notes].filter(Boolean).join(' — '),
    eqType: equipItem ? equipItem.description : '', eqSerial: '', eqManufacturer: '', eqModel: '',
  });
  const [assignee, setAssignee] = useState('');
  const [rows, setRows] = useState([{ ...EMPTY_SERVICE }]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/customers').then(setCustomers).catch(() => {});
    api.get('/mechanics', { active: 'true' }).then(setMechanics).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/vehicles/equipment-types').then(setEquipTypes).catch(() => {});
    api.get('/services', { active: 'true' }).then((list) => {
      setServices(list);
      // Los servicios que se pidieron en la llamada entran ya en la orden, con su tarifa
      const fromReq = r.items.filter((i) => i.kind === 'servicio' && i.service_id).map((i) => {
        const s = list.find((x) => x.id === i.service_id);
        return s ? { serviceId: s.id, description: pickLang(s.name, s.name_en, lang), pricingType: s.pricing_type, hours: i.quantity || 1, hourlyRate: s.hourly_rate || 0, flatPrice: s.flat_price || 0 } : null;
      }).filter(Boolean);
      if (fromReq.length) setRows(fromReq);
    }).catch(() => {});
  }, []);

  // ¿El VIN / serial ya está registrado? Entonces se usa ese vehículo (no se duplica la recepción)
  async function checkVin() {
    const vin = form.vin.trim().toUpperCase();
    if (!vin) { setExisting(null); return; }
    try { setExisting(await api.get(`/vehicles/by-vin/${encodeURIComponent(vin)}`)); } catch (_) { setExisting(null); }
  }

  function setRow(idx, patch) { setRows((rs) => rs.map((x, i) => (i === idx ? { ...x, ...patch } : x))); }
  function pickService(idx, id) {
    const s = services.find((x) => String(x.id) === String(id));
    setRow(idx, s ? { serviceId: s.id, description: pickLang(s.name, s.name_en, lang), pricingType: s.pricing_type, hourlyRate: s.hourly_rate || 0, flatPrice: s.flat_price || 0 } : { serviceId: '' });
  }

  const nameChanged = form.customerName.trim() && form.customerName.trim().toLowerCase() !== String(r.customer_name || '').trim().toLowerCase();
  const isNewCustomer = nameChanged && !customers.some((c) => c.name.trim().toLowerCase() === form.customerName.trim().toLowerCase());

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!form.vin.trim() && !existing) { setError(t('Escribe el VIN o el número de serie del equipo')); return; }
    setBusy(true);
    try {
      const out = await api.post(`/crm/requests/${r.id}/service-order`, {
        vin: form.vin.trim(), vehicleId: existing ? existing.id : undefined,
        customerName: nameChanged ? form.customerName.trim() : undefined,
        make: form.make, model: form.model, year: form.year, plate: form.plate, notes: form.notes,
        equipment: form.eqType.trim() ? { typeName: form.eqType.trim(), serialNumber: form.eqSerial, manufacturer: form.eqManufacturer, model: form.eqModel } : undefined,
        ...assigneePayload(assignee),
        services: rows.filter((s) => String(s.description).trim()).map((s) => ({ ...s, hours: parseFloat(s.hours) || 0, hourlyRate: parseFloat(s.hourlyRate) || 0, flatPrice: parseFloat(s.flatPrice) || 0 })),
      });
      navigate(`/vehiculos/${out.vehicleId}`, { state: { fromRequest: r.number, workOrderNumber: out.workOrderNumber, merged: out.link && out.link.merge } });
      onDone && onDone(out.request);
    } catch (err) { if (!err.pendingApproval) setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal title={`${t('Recibir equipo y crear orden de servicio')} — ${r.number}`} onClose={onClose} xwide>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          {t('Se usan los datos de la llamada: el equipo queda recibido, enlazado a esta solicitud, y la orden de servicio se abre de una vez.')}
        </div>
        <div className="grid grid-2">
          <div className="field">
            <label>{t('Cliente')}</label>
            <CustomerPicker freeText customers={customers} value={form.customerName} onChange={(name) => set('customerName', name)} placeholder={t('Escribe o elige el cliente')} />
            {nameChanged && (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {isNewCustomer ? `✚ ${t('Cliente nuevo: se crea al guardar.')} ` : ''}
                {t('La llamada y su historial pasan a este cliente; si el nombre de la llamada era provisional, se fusiona en él.')}
              </div>
            )}
          </div>
          <div className="field">
            <label>{t('VIN / número de serie *')}</label>
            <input value={form.vin} onChange={(e) => set('vin', e.target.value.toUpperCase())} onBlur={checkVin} placeholder="1HT… / 30-19C0420" autoFocus />
            {existing && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>✓ {t('Ya está registrado:')} {[existing.make, existing.model].filter(Boolean).join(' ')} {existing.customer_name ? `· ${existing.customer_name}` : ''} — {t('se usa ese vehículo, no se duplica.')}</div>}
          </div>
          {!existing && <>
            <div className="field"><label>{t('Marca')}</label><input value={form.make} onChange={(e) => set('make', e.target.value)} /></div>
            <div className="field"><label>{t('Modelo')}</label><input value={form.model} onChange={(e) => set('model', e.target.value)} /></div>
            <div className="field"><label>{t('Año')}</label><input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} /></div>
            <div className="field"><label>{t('Placa')}</label><input value={form.plate} onChange={(e) => set('plate', e.target.value)} /></div>
          </>}
        </div>

        <div className="form-section">{t('Equipo montado (opcional)')}</div>
        <div className="grid grid-2">
          <div className="field"><label>{t('Tipo de equipo')}</label>
            <input list="so-equip-types" value={form.eqType} onChange={(e) => set('eqType', e.target.value)} placeholder={t('Compresor, grúa, bucket lift…')} />
            <datalist id="so-equip-types">{equipTypes.map((x) => <option key={x.id} value={x.name} />)}</datalist>
          </div>
          <div className="field"><label>{t('Serie')}</label><input value={form.eqSerial} onChange={(e) => set('eqSerial', e.target.value)} /></div>
          <div className="field"><label>{t('Fabricante')}</label><input value={form.eqManufacturer} onChange={(e) => set('eqManufacturer', e.target.value)} /></div>
          <div className="field"><label>{t('Modelo')}</label><input value={form.eqModel} onChange={(e) => set('eqModel', e.target.value)} /></div>
        </div>

        <div className="form-section">{t('Orden de servicio')}</div>
        <div className="field"><label>{t('Técnico asignado')}</label>
          <AssigneeSelect value={assignee} onChange={setAssignee} mechanics={mechanics} suppliers={suppliers} />
        </div>
        <div className="field"><label>{t('Notas / problema reportado')}</label><textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></div>
        <table className="line-items-table">
          <thead><tr><th>{t('Servicio')}</th><th>{t('Descripción')}</th><th style={{ width: 120 }}>{t('Tipo')}</th><th style={{ width: 80 }}>{t('Horas')}</th><th style={{ width: 100 }}>{t('$/hora')}</th><th style={{ width: 110 }}>{t('$ fijo')}</th><th></th></tr></thead>
          <tbody>
            {rows.map((s, idx) => (
              <tr key={idx}>
                <td><select value={s.serviceId} onChange={(e) => pickService(idx, e.target.value)}>
                  <option value="">— manual —</option>
                  {services.map((sv) => <option key={sv.id} value={sv.id}>{pickLang(sv.name, sv.name_en, lang)}</option>)}
                </select></td>
                <td><input value={s.description} onChange={(e) => setRow(idx, { description: e.target.value })} /></td>
                <td><select value={s.pricingType} onChange={(e) => setRow(idx, { pricingType: e.target.value })}>
                  <option value="hora">{t('Por hora')}</option>
                  <option value="servicio_completo">{t('Servicio completo')}</option>
                </select></td>
                <td><input type="number" step="0.25" disabled={s.pricingType !== 'hora'} value={s.hours} onChange={(e) => setRow(idx, { hours: e.target.value })} /></td>
                <td><input type="number" step="0.01" disabled={s.pricingType !== 'hora'} value={s.hourlyRate} onChange={(e) => setRow(idx, { hourlyRate: e.target.value })} /></td>
                <td><input type="number" step="0.01" disabled={s.pricingType !== 'servicio_completo'} value={s.flatPrice} onChange={(e) => setRow(idx, { flatPrice: e.target.value })} /></td>
                <td><button type="button" className="link-btn" onClick={() => setRows(rows.filter((_, i) => i !== idx))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setRows([...rows, { ...EMPTY_SERVICE }])}>{t('+ Agregar servicio')}</button>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('Guardando…') : t('🔧 Recibir y crear orden de servicio')}</button>
        </div>
      </form>
    </Modal>
  );
}
