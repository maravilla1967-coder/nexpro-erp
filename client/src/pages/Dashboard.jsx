import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import { channelIcon, money, shortDate } from '../crm/constants.js';

const STAGES = ['nuevo', 'calificado', 'propuesta', 'negociacion', 'ganado', 'perdido'];
const STAGE_COLOR = { nuevo: '#94a3b8', calificado: '#60a5fa', propuesta: '#f97316', negociacion: '#eab308', ganado: '#22c55e', perdido: '#ef4444' };

// Tarjeta del dashboard: todo el recuadro lleva a la lista correspondiente.
function Kpi({ to, label, value, sub, alert, accent }) {
  return (
    <Link to={to} className={`kpi kpi-link ${accent ? 'kpi-accent' : ''}`}>
      <div className="label">{label}</div>
      <div className={`value ${alert ? 'alert' : ''}`}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{sub}</div>}
      <span className="kpi-go">→</span>
    </Link>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [updated, setUpdated] = useState(null);

  // Se actualiza solo cada minuto mientras el dashboard está abierto
  useEffect(() => {
    const load = () => api.get('/dashboard').then((d) => { setData(d); setUpdated(new Date()); }).catch(console.error);
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return <div className="content">{t('Cargando…')}</div>;
  const { totals: T, pipeline, topOpportunities, recentRequests, recentActivities, recentVehicles, overdueInvoices } = data;
  const byStage = Object.fromEntries(pipeline.map((p) => [p.stage, p]));
  const openStages = STAGES.filter((s) => !['ganado', 'perdido'].includes(s));
  const maxStage = Math.max(1, ...STAGES.map((s) => (byStage[s] ? byStage[s].total : 0)));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">{t('Resumen general de Nexpro')}{updated && <span className="muted"> · {t('actualizado')} {updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/crm/llamada" className="btn btn-primary">{t('📞 Atender llamada')}</Link>
        </div>
      </div>
      <div className="content">
        <div className="dash-kpis">
          <Kpi to="/crm/oportunidades" accent label={t('Oportunidades abiertas')} value={money(T.oppOpenTotal)}
            sub={`${T.oppOpenCount} ${t('oportunidades')} · ${t('ponderado')} ${money(T.oppWeighted)}`} />
          <Kpi to="/pedidos" label={t('Cotizaciones abiertas')} value={money(T.openSalesOrdersTotal)} sub={`${T.openSalesOrders} ${t('pedidos sin facturar')}`} />
          <Kpi to="/facturas" label={t('Facturado este mes')} value={money(T.invoicedMonth)} sub={`${T.invoicedMonthCount} ${t('facturas')} · ${t('cobrado')} ${money(T.collectedMonth)}`} />
          <Kpi to="/cartera" label={t('Por cobrar')} value={money(T.pendingInvoicesTotal)} alert={T.overdueTotal > 0}
            sub={`${T.pendingInvoices} ${t('facturas')}${T.overdueTotal > 0 ? ` · ${t('vencido')} ${money(T.overdueTotal)}` : ''}`} />
          <Kpi to="/crm/solicitudes" label={t('Solicitudes abiertas')} value={T.openRequests} alert={T.newRequests > 0}
            sub={`${T.newRequests} ${t('nuevas sin atender')} · ${T.requestsToday} ${t('hoy')}`} />
          <Kpi to="/vehiculos" label={t('Vehículos en taller')} value={T.vehiclesInShop} sub={`${T.openWorkOrders} ${t('órdenes de trabajo abiertas')}`} />
          <Kpi to="/clientes" label={t('Clientes / Leads')} value={T.customers} sub={`${T.leads} ${t('leads y prospectos')}`} />
          <Kpi to="/productos" label={t('Productos')} value={T.products} alert={T.lowStock > 0} sub={`${T.lowStock} ${t('sin existencias')}`} />
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-title">{t('Embudo de oportunidades')} <Link className="btn btn-sm" to="/crm/oportunidades">{t('Ver todas')}</Link></div>
            {STAGES.map((s) => {
              const p = byStage[s] || { count: 0, total: 0 };
              return (
                <div key={s} className="funnel-row" onClick={() => navigate(`/crm/oportunidades?etapa=${s}`)}>
                  <span className="funnel-label">{t(s)}</span>
                  <span className="funnel-bar"><span style={{ width: `${Math.max(2, (p.total / maxStage) * 100)}%`, background: STAGE_COLOR[s] }} /></span>
                  <span className="funnel-val">{money(p.total)}</span>
                  <span className="muted funnel-count">{p.count}</span>
                </div>
              );
            })}
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {t('Abiertas')}: {money(openStages.reduce((s, x) => s + (byStage[x] ? byStage[x].total : 0), 0))} · {t('Ganadas')}: {money(T.oppWonTotal)}
            </div>
          </div>

          <div className="card">
            <div className="card-title">{t('Oportunidades más grandes')} <Link className="btn btn-sm" to="/crm/oportunidades">{t('Ver todas')}</Link></div>
            {topOpportunities.length === 0 ? <div className="empty-state">{t('Sin oportunidades abiertas.')}</div> : (
              <table>
                <thead><tr><th>{t('Oportunidad')}</th><th>{t('Cliente')}</th><th>{t('Etapa')}</th><th className="text-right">{t('Valor')}</th></tr></thead>
                <tbody>
                  {topOpportunities.map((o) => (
                    <tr key={o.id} className="clickable" onClick={() => navigate(`/crm/oportunidades?abrir=${o.id}`)}>
                      <td><strong>{o.title}</strong></td><td>{o.customer_name}</td><td><Pill value={o.stage} /></td>
                      <td className="text-right">{o.value ? money(o.value) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-title">{t('Solicitudes por atender')} <Link className="btn btn-sm" to="/crm/solicitudes">{t('Ver todas')}</Link></div>
            {recentRequests.length === 0 ? <div className="empty-state">{t('No hay solicitudes abiertas.')}</div> : (
              <table>
                <tbody>
                  {recentRequests.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => navigate(`/crm/solicitudes?abrir=${r.id}`)}>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{channelIcon(r.channel)} {r.number}</td>
                      <td>{r.customer_name}<div className="muted" style={{ fontSize: 12 }}>{r.subject}</div></td>
                      <td><Pill value={r.status} /></td>
                      <td className="muted">{shortDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-title">{t('Facturas vencidas')} <Link className="btn btn-sm" to="/cartera">{t('Ir a cartera')}</Link></div>
            {overdueInvoices.length === 0 ? <div className="empty-state">{t('No hay facturas vencidas. 👍')}</div> : (
              <table>
                <tbody>
                  {overdueInvoices.map((i) => (
                    <tr key={i.id} className="clickable" onClick={() => navigate(`/facturas/${i.id}`)}>
                      <td className="mono">{i.number}</td><td>{i.customer_name}</td>
                      <td className="text-danger">{t('venció')} {shortDate(i.due_date)}</td>
                      <td className="text-right"><strong>{money(i.balance)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-title">{t('Vehículos recibidos recientemente')} <Link className="btn btn-sm" to="/vehiculos">{t('Ver todos')}</Link></div>
            {recentVehicles.length === 0 ? (
              <div className="empty-state">{t('Aún no se han recibido vehículos.')}</div>
            ) : (
              <table>
                <thead><tr><th>VIN</th><th>{t('Vehículo')}</th><th>{t('Cliente')}</th><th>{t('Estado')}</th></tr></thead>
                <tbody>
                  {recentVehicles.map((v) => (
                    <tr key={v.id} className="clickable" onClick={() => navigate(`/vehiculos/${v.id}`)}>
                      <td className="mono">{v.vin}</td>
                      <td>{v.make} {v.model} {v.year}</td>
                      <td>{v.customer_name || '—'}</td>
                      <td><Pill value={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-title">{t('Tareas y seguimientos pendientes (CRM)')}</div>
            {recentActivities.length === 0 ? (
              <div className="empty-state">{t('No hay tareas pendientes.')}</div>
            ) : (
              <table>
                <thead><tr><th>{t('Cliente')}</th><th>{t('Asunto')}</th><th>{t('Fecha')}</th></tr></thead>
                <tbody>
                  {recentActivities.map((a) => (
                    <tr key={a.id} className="clickable" onClick={() => navigate(`/clientes/${a.customer_id}?tab=interacciones`)}>
                      <td>{a.customer_name}</td>
                      <td>{a.subject}</td>
                      <td>{a.due_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
