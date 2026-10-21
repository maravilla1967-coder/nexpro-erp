import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { TxModal, PayrollModal, TransferModal, LoanModal, AccountModal, CATEGORY_LABELS, ACCOUNT_TYPES, fmt$ } from '../components/FinanceModals.jsx';

// Finanzas → Bancos: saldo de cada cuenta, resumen del mes por categoría y cobros/pagos que
// todavía no tienen cuenta asignada.
const monthStart = () => new Date().toISOString().slice(0, 8) + '01';
const today = () => new Date().toISOString().slice(0, 10);

export default function FinancePage() {
  const { t } = useI18n();
  const [accounts, setAccounts] = useState(null);
  const [summary, setSummary] = useState(null);
  const [unassigned, setUnassigned] = useState([]);
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get('/bank/accounts').then(setAccounts).catch((e) => { setError(e.message); setAccounts([]); });
    api.get('/bank/unassigned').then(setUnassigned).catch(() => {});
  }
  useEffect(load, []);
  useEffect(() => { api.get('/bank/summary', range).then(setSummary).catch(() => {}); }, [range, accounts]);

  const active = (accounts || []).filter((a) => a.active);
  const total = active.reduce((s, a) => s + a.balance, 0);
  const done = () => { setModal(null); load(); };
  async function assign(row, accountId) {
    if (!accountId) return;
    await api.post('/bank/assign', { kind: row.kind, id: row.id, accountId }); load();
  }

  if (error) return <div className="content"><div className="error-banner">{error}</div></div>;
  return (
    <>
      <div className="topbar">
        <div><h1>{t('Bancos')}</h1><div className="sub">{t('Saldos y movimientos de las cuentas de la empresa')}</div></div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setModal({ type: 'account' })}>{t('+ Cuenta')}</button>
          {active.length > 0 && <>
            <button className="btn" onClick={() => setModal({ type: 'in' })}>{t('+ Ingreso')}</button>
            <button className="btn" onClick={() => setModal({ type: 'out' })}>{t('+ Egreso')}</button>
            <button className="btn" onClick={() => setModal({ type: 'payroll' })}>{t('Nómina')}</button>
            <button className="btn" onClick={() => setModal({ type: 'transfer' })}>{t('Transferencia')}</button>
            <button className="btn btn-primary" onClick={() => setModal({ type: 'loan' })}>{t('Préstamo recibido')}</button>
          </>}
        </div>
      </div>
      <div className="content">
        {accounts && accounts.length === 0 && (
          <div className="card empty-state">
            <p>{t('Todavía no hay cuentas bancarias.')}</p>
            <button className="btn btn-primary" onClick={() => setModal({ type: 'account' })}>{t('+ Crear la primera cuenta')}</button>
            <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>{t('Después, cada cobro de factura y cada pago a proveedor quedará en el banco que elijas al registrarlo.')}</p>
          </div>
        )}
        {active.length > 0 && (
          <div className="bank-cards">
            <div className="bank-card total"><span>{t('Total en cuentas')}</span><strong>{fmt$(total)}</strong><em>{active.length} {t('cuenta(s)')}</em></div>
            {active.map((a) => (
              <Link key={a.id} to={`/finanzas/cuenta/${a.id}`} className="bank-card">
                <span>{a.name}{a.is_default ? ' ★' : ''}</span>
                <strong className={a.balance < 0 ? 'neg' : ''}>{fmt$(a.balance)}</strong>
                <em>{[a.bank_name, t(ACCOUNT_TYPES[a.account_type] || a.account_type), a.account_masked].filter(Boolean).join(' · ')}</em>
                {a.pending_clear > 0 && <em>{a.pending_clear} {t('sin conciliar')} · {t('conciliado')} {fmt$(a.cleared_balance)}</em>}
              </Link>
            ))}
          </div>
        )}

        {active.length > 0 && summary && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">
              {t('Ingresos y egresos')}
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
                <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </span>
            </div>
            <div className="chain-summary">
              <div className="chain-box"><span>{t('Ingresos')}</span><strong style={{ color: '#15803d' }}>{fmt$(summary.income)}</strong></div>
              <div className="chain-box"><span>{t('Egresos')}</span><strong style={{ color: 'var(--red)' }}>{fmt$(summary.expense)}</strong></div>
              <div className="chain-box"><span>{t('Neto')}</span><strong>{fmt$(summary.net)}</strong></div>
            </div>
            {summary.categories.length === 0 ? <div className="muted">{t('Sin movimientos en estas fechas.')}</div> : (
              <table>
                <thead><tr><th>{t('Categoría')}</th><th className="text-right">{t('Movimientos')}</th><th className="text-right">{t('Ingresos')}</th><th className="text-right">{t('Egresos')}</th></tr></thead>
                <tbody>{summary.categories.map((c) => (
                  <tr key={c.direction + c.category}><td>{t(CATEGORY_LABELS[c.category] || c.category)}</td><td className="text-right muted">{c.count}</td>
                    <td className="text-right">{c.direction === 'in' ? fmt$(c.total) : ''}</td><td className="text-right">{c.direction === 'out' ? fmt$(c.total) : ''}</td></tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        {active.length > 0 && unassigned.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-title">{t('Cobros y pagos sin cuenta bancaria')} <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>{unassigned.length}</span></div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t('Se registraron antes de crear las cuentas (o sin elegir cuenta). Elige a qué banco entró o de qué banco salió cada uno para que cuadre el saldo.')}</div>
            <table>
              <thead><tr><th>{t('Fecha')}</th><th>{t('Documento')}</th><th>{t('Cliente / proveedor')}</th><th className="text-right">{t('Ingreso')}</th><th className="text-right">{t('Egreso')}</th><th>{t('Cuenta')}</th></tr></thead>
              <tbody>{unassigned.map((r) => (
                <tr key={r.kind + r.id}>
                  <td className="muted">{String(r.date).slice(0, 10)}</td>
                  <td className="mono">{r.kind === 'invoice' ? <Link to={`/facturas/${r.doc_id}`}>{r.doc_number}</Link> : r.voucher_id ? <Link to={`/pagos-sin-factura/${r.voucher_id}/documento`}>{r.doc_number}</Link> : <Link to={`/cuentas-por-pagar?ver=${r.doc_id}`}>{r.doc_number}</Link>}</td>
                  <td>{r.payee}</td>
                  <td className="text-right">{r.direction === 'in' ? fmt$(r.amount) : ''}</td>
                  <td className="text-right">{r.direction === 'out' ? fmt$(r.amount) : ''}</td>
                  <td><select defaultValue="" onChange={(e) => assign(r, e.target.value)} style={{ minWidth: 160 }}>
                    <option value="">{t('— Asignar —')}</option>
                    {active.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {modal?.type === 'account' && <AccountModal onDone={done} onClose={() => setModal(null)} />}
      {(modal?.type === 'in' || modal?.type === 'out') && <TxModal accounts={active} direction={modal.type} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'payroll' && <PayrollModal accounts={active} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'transfer' && <TransferModal accounts={active} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'loan' && <LoanModal accounts={active} onDone={done} onClose={() => setModal(null)} />}
    </>
  );
}
