import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import PaymentModal, { money, uploadPaymentFiles } from '../components/PaymentModal.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';

// Cartera / cuentas por cobrar: quién debe, cuánto y desde cuándo, por rango de antigüedad.
export const BUCKETS = ['corriente', '1-30', '31-60', '61-90', '+90'];
const BUCKET_LABEL = { pagada: 'Pagada', corriente: 'Corriente', '1-30': '1–30 días', '31-60': '31–60 días', '61-90': '61–90 días', '+90': 'Más de 90' };

const rDate = (r) => r.due_date;
const rNumber = (r) => r.number;
const R_COLUMNS = [
  { label: 'Factura', value: (r) => r.number, mono: true },
  { label: 'Cliente', value: (r) => r.customer_name },
  { label: 'Emitida', value: (r) => r.issue_date },
  { label: 'Vence', value: (r) => r.due_date },
  { label: 'Días vencida', value: (r) => (r.days_overdue > 0 ? r.days_overdue : 0), type: 'number' },
  { label: 'Antigüedad', value: (r) => BUCKET_LABEL[r.bucket] },
  { label: 'Total', value: (r) => r.total, type: 'money' },
  { label: 'Pagado', value: (r) => r.paid, type: 'money' },
  { label: 'Saldo', value: (r) => r.balance, type: 'money' },
];

export default function ReceivablesPage() {
  const { t } = useI18n();
  const [data, setData] = useState({ rows: [], termDays: 30 });
  const [termDays, setTermDays] = useState(30);
  const [customer, setCustomer] = useState('');
  const [bucket, setBucket] = useState('');
  const [paying, setPaying] = useState(null);
  const [includePaid, setIncludePaid] = useState(false);

  function load() { api.get('/invoices/receivables', { termDays, includePaid: includePaid ? '1' : '' }).then(setData).catch(console.error); }
  useEffect(load, [termDays, includePaid]);

  const customers = useMemo(() => {
    const m = new Map();
    for (const r of data.rows) {
      if (r.bucket === 'pagada') continue;
      const c = m.get(r.customer_id) || { id: r.customer_id, name: r.customer_name, total: 0, buckets: {} };
      c.total += r.balance; c.buckets[r.bucket] = (c.buckets[r.bucket] || 0) + r.balance;
      m.set(r.customer_id, c);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [data]);

  const totals = useMemo(() => {
    const o = { all: 0 };
    BUCKETS.forEach((b) => { o[b] = 0; });
    data.rows.forEach((r) => { if (r.bucket === 'pagada') return; o[r.bucket] += r.balance; o.all += r.balance; });
    return o;
  }, [data]);

  const rows = data.rows.filter((r) => (!customer || String(r.customer_id) === customer) && (!bucket || r.bucket === bucket));
  const ex = useListExport({ rows, getDate: rDate, getNumber: rNumber });

  async function savePayment(payload, files) {
    const r = await api.post(`/invoices/${paying.id}/payments`, payload);
    await uploadPaymentFiles(`/invoices/${paying.id}`, r.newPaymentId, files);
    setPaying(null); load();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Cartera')}</h1><div className="sub">{t('Cuentas por cobrar por antigüedad')}</div></div>
        <div className="field" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ margin: 0, whiteSpace: 'nowrap' }}>{t('Días de crédito si la factura no tiene vencimiento')}</label>
          <input type="number" min="0" style={{ width: 80 }} value={termDays} onChange={(e) => setTermDays(e.target.value)} />
        </div>
      </div>
      <div className="content">
        <div className="aging-cards">
          <button className={`aging-card ${bucket === '' ? 'active' : ''}`} onClick={() => setBucket('')}>
            <span>{t('Total por cobrar')}</span><strong>{money(totals.all)}</strong>
          </button>
          {BUCKETS.map((b) => (
            <button key={b} className={`aging-card b-${b.replace('+', 'p')} ${bucket === b ? 'active' : ''}`} onClick={() => setBucket(bucket === b ? '' : b)}>
              <span>{t(BUCKET_LABEL[b])}</span><strong>{money(totals[b])}</strong>
            </button>
          ))}
        </div>

        {customers.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>{t('Por cliente')}</h3>
            <table>
              <thead><tr><th>{t('Cliente')}</th>{BUCKETS.map((b) => <th key={b} className="text-right">{t(BUCKET_LABEL[b])}</th>)}<th className="text-right">{t('Total')}</th></tr></thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setCustomer(customer === String(c.id) ? '' : String(c.id))} style={customer === String(c.id) ? { background: '#fff7ed' } : null}>
                    <td><strong>{c.name}</strong></td>
                    {BUCKETS.map((b) => <td key={b} className={`text-right ${c.buckets[b] ? '' : 'muted'}`}>{c.buckets[b] ? money(c.buckets[b]) : '—'}</td>)}
                    <td className="text-right"><strong>{money(c.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="toolbar">
          <select style={{ width: 280 }} value={customer} onChange={(e) => setCustomer(e.target.value)}>
            <option value="">{t('Todos los clientes')}</option>
            {[...new Map(data.rows.map((r) => [r.customer_id, r.customer_name])).entries()].map(([cid, name]) => <option key={cid} value={cid}>{name}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={includePaid} onChange={(e) => setIncludePaid(e.target.checked)} />
            {t('Incluir facturas pagadas (ver todas, como en Facturación)')}
          </label>
        </div>
        <div className="card">
          {rows.length === 0 ? <div className="empty-state">{includePaid ? t('No hay facturas.') : t('No hay facturas con saldo pendiente.')}</div> : (
            <>
              <ListExportBar ex={ex} title={customer ? `${t('Estado de cuenta')} — ${customers.find((c) => String(c.id) === customer)?.name || ''}` : t('Cartera')} filename="cartera" columns={R_COLUMNS} />
              <table>
                <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Factura')}</th><th>{t('Cliente')}</th><th>{t('Vence')}</th><th>{t('Antigüedad')}</th><th className="text-right">{t('Total')}</th><th className="text-right">{t('Pagado')}</th><th className="text-right">{t('Saldo')}</th><th></th></tr></thead>
                <tbody>
                  {ex.visible.map((r) => (
                    <tr key={r.id}>
                      <td><RowBox ex={ex} row={r} /></td>
                      <td className="mono"><Link to={`/facturas/${r.id}`}>{r.number}</Link></td>
                      <td>{r.customer_name}</td>
                      <td className="muted">{r.due_date}{r.due_date_estimated && <span title={t('Calculada con los días de crédito')}> *</span>}</td>
                      <td>{r.bucket === 'pagada' ? <Pill value="pagada" /> : r.days_overdue > 0 ? <span className={`aging-pill b-${r.bucket.replace('+', 'p')}`}>{r.days_overdue} {t('días')}</span> : <Pill value="corriente" />}</td>
                      <td className="text-right">{money(r.total)}</td>
                      <td className="text-right muted">{money(r.paid)}</td>
                      <td className="text-right"><strong>{money(r.balance)}</strong></td>
                      <td>{r.balance > 0.004 && <button className="link-btn" onClick={() => setPaying(r)}>{t('Registrar pago')}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>* {t('Vencimiento calculado con los días de crédito (la factura no tiene fecha de vencimiento).')}</div>
            </>
          )}
        </div>
      </div>
      {paying && <PaymentModal title={`${t('Registrar pago')} · ${paying.number}`} balance={paying.balance} onSave={savePayment} onClose={() => setPaying(null)} />}
    </>
  );
}
