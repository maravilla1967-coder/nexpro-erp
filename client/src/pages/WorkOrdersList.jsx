import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { useI18n, pickLang } from '../i18n.jsx';

export default function WorkOrdersList() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('');
  const [mechanics, setMechanics] = useState([]);
  const [services, setServices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [woMechanicId, setWoMechanicId] = useState('');
  const [woStatus, setWoStatus] = useState('pendiente');
  const [woServices, setWoServices] = useState([]);
  const [woNotes, setWoNotes] = useState('');
  const [woDiagnosis, setWoDiagnosis] = useState('');
  const [woResolution, setWoResolution] = useState('');
  const [woParts, setWoParts] = useState([]);
  const [error, setError] = useState('');

  function load() { api.get('/work-orders', { status }).then(setList).catch(console.error); }
  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    api.get('/mechanics', { active: 'true' }).then(setMechanics);
    api.get('/services', { active: 'true' }).then(setServices);
  }, []);

  function openEdit(wo) {
    setEditing(wo);
    setWoMechanicId(wo.mechanic_id || '');
    setWoStatus(wo.status);
    setWoServices(wo.services.map((s) => ({ ...s, hours: s.hours ?? 0, hourlyRate: s.hourly_rate ?? 0, flatPrice: s.flat_price ?? 0, pricingType: s.pricing_type })));
    setWoNotes(wo.notes || '');
    setWoDiagnosis(wo.diagnosis || '');
    setWoResolution(wo.resolution || '');
    setWoParts((wo.parts || []).map((p) => ({ ...p, unitCost: p.unit_cost ?? 0, notes: p.notes || '' })));
    setError('');
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
      ...copy[idx], service_id: serviceId, description: svc ? pickLang(svc.name, svc.name_en, lang) : copy[idx].description,
      pricingType: svc ? svc.pricing_type : copy[idx].pricingType,
      hourlyRate: svc ? svc.hourly_rate : copy[idx].hourlyRate,
      flatPrice: svc ? svc.flat_price : copy[idx].flatPrice,
    };
    setWoServices(copy);
  }
  function addRow() { setWoServices([...woServices, { description: '', pricingType: 'hora', hours: 1, hourlyRate: 0, flatPrice: 0 }]); }
  function removeRow(idx) { setWoServices(woServices.filter((_, i) => i !== idx)); }

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
      copy[idx] = { ...copy[idx], service_id: created.id, serviceId: created.id };
      setWoServices(copy);
    } catch (err) { setError(err.message); }
  }

  function updatePart(idx, field, value) {
    const copy = [...woParts];
    copy[idx] = { ...copy[idx], [field]: value };
    setWoParts(copy);
  }
  function addPartRow() { setWoParts([...woParts, { description: '', action: 'reemplazada', quantity: 1, unitCost: 0, notes: '' }]); }
  function removePartRow(idx) { setWoParts(woParts.filter((_, i) => i !== idx)); }

  async function saveEdit(e) {
    e.preventDefault();
    const payload = {
      mechanicId: woMechanicId || null, status: woStatus,
      notes: woNotes || null, diagnosis: woDiagnosis || null, resolution: woResolution || null,
      services: woServices.filter((s) => s.description).map((s) => ({
        serviceId: s.service_id || s.serviceId || null, description: s.description, pricingType: s.pricingType,
        hours: parseFloat(s.hours) || 0, hourlyRate: parseFloat(s.hourlyRate) || 0, flatPrice: parseFloat(s.flatPrice) || 0,
      })),
      parts: woParts.filter((p) => p.description).map((p) => ({
        description: p.description, action: p.action, quantity: parseFloat(p.quantity) || 1, unitCost: parseFloat(p.unitCost) || 0,
        notes: p.notes || null,
      })),
    };
    try { await api.put(`/work-orders/${editing.id}`, payload); setEditing(null); load(); }
    catch (err) { setError(err.message); }
  }

  async function invoiceWorkOrder(wo) {
    if (!window.confirm(`${t('¿Generar una factura a partir de la orden de trabajo')} ${wo.number}?`)) return;
    try {
      const invoice = await api.post('/invoices/from-work-orders', { workOrderIds: [wo.id] });
      navigate(`/facturas/${invoice.id}`);
    } catch (err) { alert(err.message); }
  }

  const total = woServices.reduce((sum, s) => sum + (s.pricingType === 'servicio_completo' ? (parseFloat(s.flatPrice) || 0) : (parseFloat(s.hours) || 0) * (parseFloat(s.hourlyRate) || 0)), 0);

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Órdenes de Trabajo')}</h1><div className="sub">{t('Servicios asignados a mecánicos por vehículo')}</div></div>
      </div>
      <div className="content">
        <div className="toolbar">
          <select style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('Todos los estados')}</option>
            <option value="pendiente">{t('Pendiente')}</option>
            <option value="en_proceso">{t('En proceso')}</option>
            <option value="completado">{t('Completado')}</option>
            <option value="facturado">{t('Facturado')}</option>
          </select>
        </div>
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay órdenes de trabajo todavía. Se crean desde la ficha del vehículo.')}</div> : (
            <table>
              <thead><tr><th>{t('Número')}</th><th>{t('Vehículo')}</th><th>{t('Mecánico')}</th><th>{t('Total')}</th><th>{t('Estado')}</th><th>{t('Fecha')}</th><th></th><th></th></tr></thead>
              <tbody>
                {list.map((wo) => (
                  <tr key={wo.id}>
                    <td className="mono">{wo.number}</td>
                    <td><Link to={`/vehiculos/${wo.vehicle_id}`}>{wo.vin}</Link> <span className="muted">{wo.make} {wo.model}</span></td>
                    <td>{wo.mechanic_name || '—'}</td>
                    <td><strong>${Number(wo.total).toLocaleString()}</strong></td>
                    <td><Pill value={wo.status} /></td>
                    <td className="muted">{wo.created_at}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-row-action edit" onClick={() => openEdit(wo)}>{t('Editar')}</button>
                        {wo.invoice_id ? (
                          <Link className="btn-row-action" to={`/facturas/${wo.invoice_id}`}>{t('Ver factura')}</Link>
                        ) : (
                          wo.status === 'completado' && <button className="btn-row-action" onClick={() => invoiceWorkOrder(wo)}>{t('Facturar')}</button>
                        )}
                      </div>
                    </td>
                    <td><Link to={`/ordenes-trabajo/${wo.id}/documento`}>{t('Documento')}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing && (
        <Modal title={`${t('Orden de trabajo')} ${editing.number}`} onClose={() => setEditing(null)} wide>
          <form onSubmit={saveEdit}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field"><label>{t('Mecánico')}</label>
                <select value={woMechanicId} onChange={(e) => setWoMechanicId(e.target.value)}>
                  <option value="">{t('— Sin asignar —')}</option>
                  {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Estado')}</label>
                <select value={woStatus} onChange={(e) => setWoStatus(e.target.value)}>
                  <option value="pendiente">{t('Pendiente')}</option>
                  <option value="en_proceso">{t('En proceso')}</option>
                  <option value="completado">{t('Completado')}</option>
                  <option value="facturado">{t('Facturado')}</option>
                </select>
              </div>
            </div>
            <table className="line-items-table">
              <thead><tr><th>{t('Servicio')}</th><th>{t('Descripción')}</th><th style={{ width: 120 }}>{t('Tipo')}</th><th style={{ width: 80 }}>{t('Horas')}</th><th style={{ width: 100 }}>{t('$/hora')}</th><th style={{ width: 110 }}>{t('$ fijo')}</th><th style={{ width: 90 }}>{t('Total')}</th><th></th></tr></thead>
              <tbody>
                {woServices.map((s, idx) => {
                  const rowTotal = s.pricingType === 'servicio_completo' ? (parseFloat(s.flatPrice) || 0) : (parseFloat(s.hours) || 0) * (parseFloat(s.hourlyRate) || 0);
                  return (
                    <tr key={idx}>
                      <td>
                        <select value={s.service_id || s.serviceId || ''} onChange={(e) => pickService(idx, e.target.value)}>
                          <option value="">— manual —</option>
                          {services.map((sv) => <option key={sv.id} value={sv.id}>{pickLang(sv.name, sv.name_en, lang)}</option>)}
                        </select>
                      </td>
                      <td>
                        <input value={s.description} onChange={(e) => updateWoService(idx, 'description', e.target.value)} />
                        {!(s.service_id || s.serviceId) && s.description && (
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
                      <td className="text-right">${rowTotal.toLocaleString()}</td>
                      <td><button type="button" className="link-btn" onClick={() => removeRow(idx)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addRow}>{t('+ Agregar servicio')}</button>
            <div className="text-right" style={{ marginTop: 10, fontWeight: 700 }}>{t('Total')}: ${total.toLocaleString()}</div>

            <div className="field" style={{ marginTop: 16 }}><label>{t('Problema reportado / Síntomas')}</label><textarea rows={2} value={woNotes} onChange={(e) => setWoNotes(e.target.value)} /></div>
            <div className="field"><label>{t('Diagnóstico')}</label><textarea rows={2} value={woDiagnosis} onChange={(e) => setWoDiagnosis(e.target.value)} /></div>
            <div className="field"><label>{t('Solución / Reparación realizada')}</label><textarea rows={2} value={woResolution} onChange={(e) => setWoResolution(e.target.value)} /></div>

            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)' }}>{t('Partes reemplazadas o reparadas')}</label>
            <table className="line-items-table" style={{ marginTop: 6 }}>
              <thead><tr><th>{t('Descripción')}</th><th style={{ width: 150 }}>{t('Acción')}</th><th style={{ width: 80 }}>{t('Cant.')}</th><th style={{ width: 110 }}>{t('Costo unit.')}</th><th style={{ width: 200 }}>{t('Nota (opcional)')}</th><th></th></tr></thead>
              <tbody>
                {woParts.map((p, idx) => (
                  <tr key={idx}>
                    <td><input value={p.description} onChange={(e) => updatePart(idx, 'description', e.target.value)} /></td>
                    <td>
                      <select value={p.action} onChange={(e) => updatePart(idx, 'action', e.target.value)}>
                        <option value="reemplazada">{t('Reemplazada')}</option>
                        <option value="reparada">{t('Reparada')}</option>
                        <option value="garantia">{t('Garantía')}</option>
                        <option value="cliente">{t('Suministrada por el cliente')}</option>
                      </select>
                    </td>
                    <td><input type="number" step="1" value={p.quantity} onChange={(e) => updatePart(idx, 'quantity', e.target.value)} /></td>
                    <td><input type="number" step="0.01" value={p.unitCost} onChange={(e) => updatePart(idx, 'unitCost', e.target.value)} /></td>
                    <td><input placeholder={t('Nota sobre la parte (ej. garantía, quién la suministró, etc.)')} value={p.notes || ''} onChange={(e) => updatePart(idx, 'notes', e.target.value)} /></td>
                    <td><button type="button" className="link-btn" onClick={() => removePartRow(idx)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addPartRow}>{t('+ Agregar parte')}</button>

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setEditing(null)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
