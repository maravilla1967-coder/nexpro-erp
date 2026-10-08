import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';

// Documento de recepción del vehículo: siempre disponible desde que el vehículo entra
// (no depende de que ya exista una orden de trabajo), para que el cliente lo firme al
// dejar el equipo. Si ya hay una o más órdenes de trabajo, también muestra el
// diagnóstico, la solución y las partes/servicios realizados.
export default function VehicleReceptionDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);

  useEffect(() => { api.get(`/vehicles/${id}`).then(setVehicle).catch(console.error); }, [id]);

  if (!vehicle) return <div className="content">{t('Cargando…')}</div>;

  const allServices = vehicle.workOrders.flatMap((wo) => wo.services || []);
  const allParts = vehicle.workOrders.flatMap((wo) => wo.parts || []);
  const servicesTotal = allServices.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const partsTotal = allParts.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const grandTotal = servicesTotal + partsTotal;
  const diagnoses = vehicle.workOrders.map((wo) => wo.diagnosis).filter(Boolean);
  const resolutions = vehicle.workOrders.map((wo) => wo.resolution).filter(Boolean);
  const reportedIssue = vehicle.notes || vehicle.workOrders.map((wo) => wo.notes).filter(Boolean).join(' | ');

  return (
    <>
      <div className="topbar no-print">
        <div>
          <h1 className="mono">{vehicle.vin}</h1>
          <div className="sub"><Pill value={vehicle.status} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/vehiculos/${vehicle.id}`} className="btn">{t('← Volver')}</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <div className="invoice-brand">
              <img src="/nexpro-logo.png" alt="Nexpro Trucks & Equipment Corp." className="invoice-logo"
                   onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
              <div className="invoice-brand-fallback" style={{ display: 'none' }}>
                <strong>NEXPRO TRUCKS &amp; EQUIPMENT CORP.</strong>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>7380 NW 77th CT, Miami, FL 33166 · Tel: 786-631-5922</div>
            </div>
            <div className="invoice-meta">
              <h2>{t('RECEPCIÓN DE VEHÍCULO')}</h2>
              <div><strong>{t('Recibido:')}</strong> {vehicle.received_at}</div>
            </div>
          </div>

          <div className="doc-grid">
            <div className="doc-box">
              <div className="doc-box-title">{t('Cliente')}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{vehicle.customer_name || '—'}</div>
              <div className="muted">{vehicle.customer_address || ''} {vehicle.customer_city || ''}</div>
              <div className="muted">{vehicle.customer_tax_id && `${t('NIT/ID:')} ${vehicle.customer_tax_id}`}</div>
              <div className="muted">{vehicle.customer_phone} {vehicle.customer_phone && vehicle.customer_email ? '|' : ''} {vehicle.customer_email}</div>
            </div>
            <div className="doc-box">
              <div className="doc-box-title">{t('Vehículo')}</div>
              <div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{t('VIN:')} {vehicle.vin}</div>
              {vehicle.plate && <div><strong>{t('Placa:')}</strong> {vehicle.plate}</div>}
              <div className="muted">{vehicle.make} {vehicle.model} {vehicle.year} {vehicle.chassis_type ? `(${vehicle.chassis_type})` : ''}</div>
            </div>
          </div>

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Equipos instalados')}</div>
            {vehicle.equipment.length === 0 ? (
              <div className="muted">{t('Sin equipos registrados.')}</div>
            ) : (
              <table>
                <thead><tr><th>{t('Tipo')}</th><th>{t('Marca / Fabricante')}</th><th>{t('Número de serie')}</th><th>{t('Modelo')}</th></tr></thead>
                <tbody>
                  {vehicle.equipment.map((e) => (
                    <tr key={e.id}>
                      <td>{e.equipment_type_name || e.custom_type_name}</td>
                      <td>{e.manufacturer || '—'}</td>
                      <td className="mono">{e.serial_number || '—'}</td>
                      <td>{e.model || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Problema reportado / Síntomas')}</div>
            <div>{reportedIssue || <span className="muted">{t('Sin notas registradas.')}</span>}</div>
          </div>

          {vehicle.workOrders.length === 0 ? (
            <div className="doc-box" style={{ marginTop: 14 }}>
              <div className="doc-box-title">{t('Diagnóstico y trabajo realizado')}</div>
              <div className="muted">{t('Aún no se ha creado una orden de trabajo para este vehículo. Este documento se puede imprimir y firmar ahora, en la recepción; el diagnóstico y el trabajo realizado se agregarán aquí una vez que se registre la orden de trabajo.')}</div>
            </div>
          ) : (
            <>
              {diagnoses.length > 0 && (
                <div className="doc-box" style={{ marginTop: 14 }}>
                  <div className="doc-box-title">{t('Diagnóstico')}</div>
                  {diagnoses.map((d, i) => <div key={i} style={{ marginBottom: diagnoses.length > 1 ? 6 : 0 }}>{d}</div>)}
                </div>
              )}
              {resolutions.length > 0 && (
                <div className="doc-box" style={{ marginTop: 14 }}>
                  <div className="doc-box-title">{t('Solución / Reparación realizada')}</div>
                  {resolutions.map((r, i) => <div key={i} style={{ marginBottom: resolutions.length > 1 ? 6 : 0 }}>{r}</div>)}
                </div>
              )}

              <div className="doc-box" style={{ marginTop: 14 }}>
                <div className="doc-box-title">{t('Partes reemplazadas o reparadas')}</div>
                {allParts.length === 0 ? (
                  <div className="muted">{t('No se reemplazaron ni repararon partes.')}</div>
                ) : (
                  <table>
                    <thead><tr><th>{t('Descripción')}</th><th>{t('Acción')}</th><th className="text-right">{t('Cant.')}</th><th className="text-right">{t('Costo unit.')}</th><th className="text-right">{t('Subtotal')}</th></tr></thead>
                    <tbody>
                      {allParts.map((p) => (
                        <tr key={p.id}>
                          <td>{p.description}</td>
                          <td>{t(p.action === 'reparada' ? 'Reparada' : 'Reemplazada')}</td>
                          <td className="text-right">{p.quantity}</td>
                          <td className="text-right">${Number(p.unit_cost).toLocaleString()}</td>
                          <td className="text-right">${Number(p.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="doc-box" style={{ marginTop: 14 }}>
                <div className="doc-box-title">{t('Mano de obra y servicios')}</div>
                {allServices.length === 0 ? (
                  <div className="muted">{t('Sin servicios registrados.')}</div>
                ) : (
                  <table>
                    <thead><tr><th>{t('Servicio')}</th><th className="text-right">{t('Total')}</th></tr></thead>
                    <tbody>
                      {allServices.map((s) => (
                        <tr key={s.id}>
                          <td>{s.description}</td>
                          <td className="text-right">${Number(s.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="invoice-totals">
                <div><span>{t('Mano de obra / servicios')}</span><span>${servicesTotal.toLocaleString()}</span></div>
                <div><span>{t('Partes')}</span><span>${partsTotal.toLocaleString()}</span></div>
                <div className="invoice-total-grand"><span>{t('Total')}</span><span>${grandTotal.toLocaleString()}</span></div>
              </div>
            </>
          )}

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Conformidad del cliente')}</div>
            <div className="muted" style={{ fontSize: 13 }}>{t('Al firmar, el cliente confirma haber entregado el vehículo con la información descrita en este documento.')}</div>
          </div>

          <div className="signature-block">
            <div className="signature-box">
              <div className="signature-line"></div>
              <div className="muted">{t('Firma del cliente')}</div>
            </div>
            <div className="signature-box">
              <div className="signature-line"></div>
              <div className="muted">{t('Recibido por (técnico/asesor)')}</div>
            </div>
            <div className="signature-box">
              <div className="signature-line"></div>
              <div className="muted">{t('Fecha')}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
