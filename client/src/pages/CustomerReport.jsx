import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { useI18n } from '../i18n.jsx';
import { splitRoles, roleLabel, contactTypeLabel, interactionLabel, money, shortDate } from '../crm/constants.js';

// Informe imprimible del cliente: datos, personas, resumen de cuenta, vehículos con sus equipos
// (seriales) y todo el historial de servicio, cotizaciones, facturas, pagos y solicitudes.
export default function CustomerReport() {
  const { t } = useI18n();
  const { id } = useParams();
  const [d, setD] = useState(null);
  useEffect(() => { api.get(`/crm/customers/${id}/360`).then(setD).catch(console.error); }, [id]);
  if (!d) return <div className="content">{t('Cargando…')}</div>;
  const { customer: c, summary: s } = d;
  const now = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="topbar no-print">
        <div><h1>{t('Informe del cliente')}</h1><div className="sub">{c.name}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/clientes/${c.id}`} className="btn">{t('← Volver')}</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        <div className="card invoice-sheet report-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('INFORME DEL CLIENTE')}</h2>
              <div><strong>{t('Fecha:')}</strong> {now}</div>
            </div>
          </div>

          <div className="doc-grid">
            <div className="doc-box">
              <div className="doc-box-title">{t('Cliente')}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
              <div className="muted">{splitRoles(c.roles).map((r) => t(roleLabel(r))).join(' · ')}{c.aliases ? ` · ${c.aliases}` : ''}</div>
              <div>{[c.address, c.city, c.state, c.zip].filter(Boolean).join(', ')}</div>
              <div>{[c.phone, c.phone2, c.email].filter(Boolean).join(' · ')}</div>
              {c.tax_id && <div>{t('NIT/ID:')} {c.tax_id}</div>}
            </div>
            <div className="doc-box">
              <div className="doc-box-title">{t('Resumen de cuenta')}</div>
              <div className="report-kv"><span>{t('Facturado total')}</span><strong>{money(s.total_invoiced)}</strong></div>
              <div className="report-kv"><span>{t('Pagado')}</span><strong>{money(s.total_paid)}</strong></div>
              <div className="report-kv"><span>{t('Saldo por cobrar')}</span><strong>{money(s.balance_due)}</strong></div>
              {s.overdue > 0 && <div className="report-kv"><span>{t('Vencido')}</span><strong className="text-danger">{money(s.overdue)}</strong></div>}
              <div className="report-kv"><span>{t('Vehículos / equipos')}</span><strong>{s.vehicles} / {s.equipment}</strong></div>
              <div className="report-kv"><span>{t('Órdenes de trabajo')}</span><strong>{s.work_orders}</strong></div>
            </div>
          </div>

          <h3 className="report-h">{t('Personas')}</h3>
          {d.contacts.length === 0 ? <div className="muted">—</div> : (
            <table><thead><tr><th>{t('Nombre')}</th><th>{t('Cargo')}</th><th>{t('Teléfono')}</th><th>{t('Email')}</th></tr></thead>
              <tbody>{d.contacts.map((k) => <tr key={k.id}><td>{k.name}{k.is_primary ? ' ★' : ''}</td><td>{[t(contactTypeLabel(k.contact_type)), k.role].filter(Boolean).join(' · ')}</td><td>{[k.mobile, k.phone].filter(Boolean).join(' / ')}</td><td>{k.email}</td></tr>)}</tbody>
            </table>
          )}

          <h3 className="report-h">{t('Vehículos, equipos e historial de servicio')}</h3>
          {d.vehicles.length === 0 && <div className="muted">—</div>}
          {d.vehicles.map((v) => (
            <div key={v.id} className="report-vehicle">
              <div><strong className="mono">VIN {v.vin}</strong> · {[v.year, v.make, v.model, v.plate].filter(Boolean).join(' ')} · {t('Recibido')} {shortDate(v.received_at)}{v.contact_name ? ` · ${v.contact_name}` : ''}</div>
              {v.equipment.length > 0 && <div style={{ fontSize: 12.5 }}>{t('Equipos:')} {v.equipment.map((e) => `${e.type_name || ''}${e.manufacturer ? ` ${e.manufacturer}` : ''}${e.model ? ` ${e.model}` : ''}${e.serial_number ? ` (S/N ${e.serial_number})` : ''}`).join('; ')}</div>}
              {v.work_orders.length > 0 && (
                <table style={{ marginTop: 4 }}><thead><tr><th>{t('Orden')}</th><th>{t('Fecha')}</th><th>{t('Trabajo realizado')}</th><th className="text-right">{t('Total')}</th></tr></thead>
                  <tbody>{v.work_orders.map((w) => (
                    <tr key={w.id}><td className="mono">{w.number}</td><td className="nw">{shortDate(w.created_at)}</td>
                      <td>{[...w.services.map((x) => x.description), ...w.parts.map((x) => `${x.description}${x.serial ? ` S/N ${x.serial}` : ''}`)].join('; ') || w.diagnosis || '—'}</td>
                      <td className="text-right">{money(w.total)}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          ))}

          <h3 className="report-h">{t('Facturas y pagos')}</h3>
          {d.invoices.length === 0 ? <div className="muted">—</div> : (
            <table><thead><tr><th>{t('Factura')}</th><th>{t('Fecha')}</th><th>{t('Estado')}</th><th className="text-right">{t('Total')}</th><th className="text-right">{t('Pagado')}</th><th className="text-right">{t('Saldo')}</th></tr></thead>
              <tbody>{d.invoices.map((i) => <tr key={i.id}><td className="mono">{i.number}</td><td className="nw">{shortDate(i.issue_date)}</td><td>{t(i.status)}</td><td className="text-right">{money(i.total)}</td><td className="text-right">{money(i.paid)}</td><td className="text-right">{money(i.balance)}</td></tr>)}</tbody>
            </table>
          )}

          <h3 className="report-h">{t('Cotizaciones')}</h3>
          {d.salesOrders.length === 0 ? <div className="muted">—</div> : (
            <table><thead><tr><th>{t('Número')}</th><th>{t('Fecha')}</th><th>{t('Estado')}</th><th className="text-right">{t('Total')}</th></tr></thead>
              <tbody>{d.salesOrders.map((so) => <tr key={so.id}><td className="mono">{so.number}</td><td className="nw">{shortDate(so.created_at)}</td><td>{t(so.status)}</td><td className="text-right">{money(so.total)}</td></tr>)}</tbody>
            </table>
          )}

          <h3 className="report-h">{t('Solicitudes')}</h3>
          {d.requests.length === 0 ? <div className="muted">—</div> : (
            <table><thead><tr><th>{t('Número')}</th><th>{t('Fecha')}</th><th>{t('Persona')}</th><th>{t('Lo que pide')}</th><th>{t('Estado')}</th></tr></thead>
              <tbody>{d.requests.map((r) => <tr key={r.id}><td className="mono">{r.number}</td><td className="nw">{shortDate(r.created_at)}</td><td>{r.contact_name || '—'}</td><td>{r.items.map((i) => i.description).join(', ') || r.subject}</td><td>{t(r.status.replace('_', ' '))}</td></tr>)}</tbody>
            </table>
          )}

          <h3 className="report-h">{t('Últimas interacciones')}</h3>
          {d.interactions.length === 0 ? <div className="muted">—</div> : (
            <table><thead><tr><th>{t('Fecha')}</th><th>{t('Tipo')}</th><th>{t('Persona')}</th><th>{t('Tema')}</th></tr></thead>
              <tbody>{d.interactions.slice(0, 25).map((a) => <tr key={a.id}><td className="nw">{String(a.occurred_at || a.created_at).slice(0, 10)}</td><td>{t(interactionLabel(a.type))}</td><td>{a.contact_name || '—'}</td><td>{a.subject}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
