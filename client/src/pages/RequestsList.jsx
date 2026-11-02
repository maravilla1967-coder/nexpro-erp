import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import RequestModal from '../crm/RequestModal.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
import { channelIcon, contactTypeLabel, money, shortDate } from '../crm/constants.js';

const FILTERS = [['abiertas', 'Abiertas'], ['nueva', 'Nuevas'], ['en_proceso', 'En proceso'], ['cotizada', 'Cotizadas'], ['ganada', 'Ganadas'], ['perdida', 'Perdidas'], ['cerrada', 'Cerradas'], ['', 'Todas']];
const COLUMNS = [
  { label: 'Número', value: (r) => r.number },
  { label: 'Fecha', value: (r) => shortDate(r.created_at) },
  { label: 'Cliente', value: (r) => r.customer_name },
  { label: 'Persona', value: (r) => r.contact_name },
  { label: 'Medio', value: (r) => r.channel },
  { label: 'Lo que pide', value: (r) => r.items.map((i) => `${i.quantity} x ${i.description}`).join('; ') || r.subject },
  { label: 'Estado', value: (r) => r.status },
  { label: 'Cotización', value: (r) => r.sales_order_number },
  { label: 'Total', value: (r) => (r.sales_order_id ? r.sales_order_total : '') },
];

export default function RequestsList() {
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('abiertas');
  const [q, setQ] = useState('');
  const ex = useListExport({ rows: list });
  const openId = params.get('abrir');

  function load() { api.get('/crm/requests', { status, q }).then(setList).catch(console.error); }
  useEffect(() => { load(); }, [status, q]);

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Solicitudes de clientes')}</h1><div className="sub">{t('Todo lo que los clientes han pedido por llamada, correo o texto')}</div></div>
        <Link to="/crm/llamada" className="btn btn-primary">{t('📞 Atender llamada / nueva solicitud')}</Link>
      </div>
      <div className="content">
        <div className="toolbar">
          <div className="seg">
            {FILTERS.map(([k, l]) => <button key={k} type="button" className={`seg-btn ${status === k ? 'active' : ''}`} onClick={() => setStatus(k)}>{t(l)}</button>)}
          </div>
          <input className="search-input" placeholder={t('Buscar cliente, persona, producto, número…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay solicitudes con este filtro.')}</div> : (
            <>
              <ListExportBar ex={ex} title={t('Solicitudes')} filename="solicitudes" columns={COLUMNS} />
              <table>
                <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Número')}</th><th>{t('Fecha')}</th><th>{t('Cliente')}</th><th>{t('Persona')}</th><th>{t('Lo que pide')}</th><th>{t('Estado')}</th><th>{t('Cotización')}</th><th>{t('Acuse')}</th></tr></thead>
                <tbody>
                  {ex.visible.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => setParams({ abrir: r.id })}>
                      <td onClick={(e) => e.stopPropagation()}><RowBox ex={ex} row={r} /></td>
                      <td className="mono">{channelIcon(r.channel)} {r.number}{r.priority === 'urgente' || r.priority === 'alta' ? <span className="pill red" style={{ marginLeft: 6 }}>{t(r.priority)}</span> : null}</td>
                      <td className="muted">{shortDate(r.created_at)}</td>
                      <td><Link to={`/clientes/${r.customer_id}`} onClick={(e) => e.stopPropagation()}>{r.customer_name}</Link></td>
                      <td>{r.contact_name || '—'}{r.contact_type && <div className="muted" style={{ fontSize: 11.5 }}>{t(contactTypeLabel(r.contact_type))}</div>}</td>
                      <td style={{ maxWidth: 340 }}>{r.items.map((i) => i.description).join(', ') || r.subject}</td>
                      <td><Pill value={r.status} /></td>
                      <td>{r.sales_order_id ? <><span className="mono">{r.sales_order_number}</span><div className="muted" style={{ fontSize: 12 }}>{money(r.sales_order_total)}</div></> : '—'}</td>
                      <td>{r.ack_sent_at ? '✓' : <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
      {openId && <RequestModal id={openId} onClose={() => setParams({})} onChanged={load} />}
    </>
  );
}
