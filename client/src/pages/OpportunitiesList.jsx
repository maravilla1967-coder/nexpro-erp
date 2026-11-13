import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import OpportunityModal from '../crm/OpportunityModal.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
import { money, shortDate } from '../crm/constants.js';

const STAGES = ['nuevo', 'calificado', 'propuesta', 'negociacion', 'ganado', 'perdido'];
const COLUMNS = [
  { label: 'Oportunidad', value: (o) => o.title },
  { label: 'Cliente', value: (o) => o.customer_name },
  { label: 'Etapa', value: (o) => o.stage },
  { label: 'Valor', value: (o) => o.value },
  { label: 'Probabilidad', value: (o) => o.probability },
  { label: 'Cierre esperado', value: (o) => o.expected_close },
  { label: 'Cotización ERP', value: (o) => o.sales_order_number },
];

// Todas las oportunidades de todos los clientes, con la suma total y por etapa.
export default function OpportunitiesList() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ list: [], total: 0, weighted: 0, byStage: [] });
  const [stage, setStage] = useState(params.get('etapa') || 'abiertas');
  const [q, setQ] = useState('');
  const ex = useListExport({ rows: data.list });
  const openId = params.get('abrir');
  const opened = openId && data.list.find((o) => String(o.id) === String(openId));
  const [openCustomer, setOpenCustomer] = useState(null);

  function load() { api.get('/crm/opportunities', { stage, q }).then(setData).catch(console.error); }
  useEffect(() => { load(); }, [stage, q]); // eslint-disable-line react-hooks/exhaustive-deps
  // Si se abre una oportunidad que no está en el filtro actual, se busca su cliente
  useEffect(() => {
    if (openId && !opened) api.get(`/crm/opportunities/${openId}`).then((o) => setOpenCustomer(o.customer_id)).catch(() => {});
  }, [openId, opened]);

  const stageInfo = Object.fromEntries(data.byStage.map((s) => [s.stage, s]));
  const visibleTotal = ex.visible.reduce((s, o) => s + (Number(o.value) || 0), 0);

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Oportunidades')}</h1><div className="sub">{t('Todos los negocios en curso de todos los clientes')}</div></div>
      </div>
      <div className="content">
        <div className="dash-kpis" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
          {STAGES.map((s) => {
            const i = stageInfo[s] || { count: 0, total: 0 };
            return (
              <button key={s} type="button" className={`kpi kpi-link ${stage === s ? 'kpi-accent' : ''}`} onClick={() => setStage(stage === s ? 'abiertas' : s)} style={{ textAlign: 'left' }}>
                <div className="label">{t(s)}</div>
                <div className="value" style={{ fontSize: 20 }}>{money(i.total)}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{i.count} {t('oportunidades')}</div>
              </button>
            );
          })}
        </div>
        <div className="toolbar">
          <div className="seg">
            {[['abiertas', 'Abiertas'], ...STAGES.map((s) => [s, s]), ['todas', 'Todas']].map(([k, l]) => (
              <button key={k} type="button" className={`seg-btn ${stage === k ? 'active' : ''}`} onClick={() => setStage(k)}>{t(l)}</button>
            ))}
          </div>
          <input className="search-input" placeholder={t('Buscar oportunidad o cliente…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="card">
          <div className="opp-sum">
            <div><span>{t('Total')}</span><strong>{money(data.total)}</strong></div>
            <div><span>{t('Ponderado por probabilidad')}</span><strong>{money(data.weighted)}</strong></div>
            <div><span>{t('Oportunidades')}</span><strong>{data.list.length}</strong></div>
          </div>
          {data.list.length === 0 ? <div className="empty-state">{t('No hay oportunidades con este filtro.')}</div> : (
            <>
              <ListExportBar ex={ex} title={t('Oportunidades')} filename="oportunidades" columns={COLUMNS} />
              <table>
                <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Oportunidad')}</th><th>{t('Cliente')}</th><th>{t('Etapa')}</th><th>{t('Prob.')}</th><th>{t('Cierre esperado')}</th><th>{t('Documentos')}</th><th>{t('Cotización ERP')}</th><th className="text-right">{t('Valor')}</th></tr></thead>
                <tbody>
                  {ex.visible.map((o) => (
                    <tr key={o.id} className="clickable" onClick={() => setParams({ abrir: o.id })}>
                      <td onClick={(e) => e.stopPropagation()}><RowBox ex={ex} row={o} /></td>
                      <td><strong>{o.title}</strong><div className="muted" style={{ fontSize: 11.5 }}>{shortDate(o.created_at)}</div></td>
                      <td onClick={(e) => e.stopPropagation()}><Link to={`/clientes/${o.customer_id}?tab=oportunidades`}>{o.customer_name}</Link></td>
                      <td><Pill value={o.stage} /></td>
                      <td>{o.probability != null ? `${o.probability}%` : '—'}</td>
                      <td>{o.expected_close || '—'}</td>
                      <td>{o.files_count ? `📎 ${o.files_count}` : <span className="muted">—</span>}</td>
                      <td onClick={(e) => e.stopPropagation()}>{o.sales_order_id ? <Link to={`/pedidos?abrir=${o.sales_order_id}`} className="mono">{o.sales_order_number}</Link> : <span className="muted">—</span>}</td>
                      <td className="text-right"><strong>{o.value ? money(o.value) : '—'}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={8} className="text-right"><strong>{t('Total')}</strong></td><td className="text-right"><strong>{money(visibleTotal)}</strong></td></tr>
                </tfoot>
              </table>
            </>
          )}
        </div>
      </div>
      {openId && (opened || openCustomer) && (
        <OpportunityModal customerId={opened ? opened.customer_id : openCustomer} opportunityId={Number(openId)}
          onClose={() => { setParams({}); setOpenCustomer(null); }} onChanged={load} />
      )}
    </>
  );
}
