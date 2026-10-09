import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { useI18n } from '../i18n.jsx';

const PART_ACTION_LABELS = { reemplazada: 'Reemplazada', reparada: 'Reparada', garantia: 'Garantía', cliente: 'Suministrada por el cliente' };

export default function WorkOrderDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const [wo, setWo] = useState(null);
  const [vehicle, setVehicle] = useState(null);

  useEffect(() => {
    api.get(`/work-orders/${id}`).then((data) => {
      setWo(data);
      if (data && data.vehicle_id) {
        api.get(`/vehicles/${data.vehicle_id}`).then(setVehicle).catch(console.error);
      }
    }).catch(console.error);
  }, [id]);

  if (!wo || !vehicle) return <div className="content">{t('Cargando…')}</div>;

  const servicesTotal = wo.services.reduce((sum, s) => sum + Number(s.total), 0);
  const partsTotal = wo.parts.reduce((sum, p) => sum + Number(p.total), 0);

  return (
    <>
      <div className="topbar no-print">
        <div>
          <h1 className="mono">{wo.number}</h1>
          <div className="sub">
            <Pill value={wo.status} />
            {wo.invoice_id && <> · <Link to={`/facturas/${wo.invoice_id}`}>{t('Ver factura')} {wo.invoice_number}</Link></>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/vehiculos/${wo.vehicle_id}`} className="btn">{t('← Volver')}</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('DOCUMENTO DE SERVICIO')}</h2>
              <div><strong>{t('No.')}</strong> {wo.number}</div>
              <div><strong>{t('Recibido:')}</strong> {vehicle.received_at}</div>
            </div>
          </div>

          <div className="doc-grid">
            <div className="doc-box">
              <div className="doc-box-title">{t('Cliente')}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{vehicle.customer_name || '—'}</div>
              <div className="muted">{vehicle.customer_address || ''} {vehicle.customer_city || ''} {vehicle.customer_zip || ''}</div>
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

          {wo.notes && (
            <div className="doc-box" style={{ marginTop: 14 }}>
              <div className="doc-box-title">{t('Problema reportado / Síntomas')}</div>
              <div>{wo.notes}</div>
            </div>
          )}

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Diagnóstico')}</div>
            <div>{wo.diagnosis || <span className="muted">{t('Sin diagnóstico registrado.')}</span>}</div>
          </div>

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Solución / Reparación realizada')}</div>
            <div>{wo.resolution || <span className="muted">{t('Sin solución registrada.')}</span>}</div>
          </div>

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Partes reemplazadas o reparadas')}</div>
            {wo.parts.length === 0 ? (
              <div className="muted">{t('No se reemplazaron ni repararon partes.')}</div>
            ) : (
              <table>
                <thead><tr><th>{t('Descripción')}</th><th>{t('Acción')}</th><th className="text-right">{t('Cant.')}</th><th className="text-right">{t('Costo unit.')}</th><th className="text-right">{t('Subtotal')}</th></tr></thead>
                <tbody>
                  {wo.parts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.description}
                        {p.notes && <div className="muted" style={{ fontSize: 11 }}>{p.notes}</div>}
                      </td>
                      <td>{t(PART_ACTION_LABELS[p.action] || 'Reemplazada')}</td>
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
            {wo.services.length === 0 ? (
              <div className="muted">{t('Sin servicios registrados.')}</div>
            ) : (
              <table>
                <thead><tr><th>{t('Servicio')}</th><th className="text-right">{t('Total')}</th></tr></thead>
                <tbody>
                  {wo.services.map((s) => (
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
            <div className="invoice-total-grand"><span>{t('Total')}</span><span>${Number(wo.total).toLocaleString()}</span></div>
          </div>

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Conformidad del cliente')}</div>
            <div className="muted" style={{ fontSize: 13 }}>{t('Al firmar, el cliente confirma haber recibido el vehículo y aceptar el trabajo realizado y descrito en este documento.')}</div>
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
