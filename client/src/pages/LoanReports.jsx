import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { CATEGORY_LABELS, fmt$ } from '../components/FinanceModals.jsx';
import { useI18n } from '../i18n.jsx';

const todayIso = () => new Date().toISOString().slice(0, 10);
const d10 = (x) => String(x || '').slice(0, 10);
const lenderTypeLabel = (lt) => (lt === 'socio' ? 'Socio' : lt === 'banco' ? 'Banco / entidad' : 'Tercero');

// Cifras del préstamo a una fecha de corte: solo cuentan los movimientos hasta esa fecha.
// (Los intereses causados ya vienen del servidor calculados a la misma fecha.)
export function loanAsOf(loan, asOf) {
  const txs = (loan.transactions || []).filter((x) => d10(x.tx_date) <= asOf);
  const sum = (f) => Math.round(txs.filter(f).reduce((s, x) => s + Number(x.amount), 0) * 100) / 100;
  const received = sum((x) => x.direction === 'in');
  const repaid = sum((x) => x.direction === 'out' && x.category === 'abono_prestamo');
  const interestPaid = sum((x) => x.direction === 'out' && x.category === 'intereses_prestamo');
  const started = d10(loan.interest_start || loan.loan_date) <= asOf;
  const principal = started ? Number(loan.principal) || 0 : 0;
  const balance = Math.round((principal - repaid) * 100) / 100;
  const interestDue = Math.max(0, Math.round(((Number(loan.interest_accrued) || 0) - interestPaid) * 100) / 100);
  // Movimientos con saldo de capital corrido
  let run = principal > 0 && received === 0 ? principal : 0;
  const rows = txs.map((x) => {
    const isIn = x.direction === 'in';
    const isCap = x.category === 'abono_prestamo';
    const isInt = x.category === 'intereses_prestamo';
    if (isIn) run += Number(x.amount);
    if (isCap) run -= Number(x.amount);
    return { ...x, isIn, isCap, isInt, runBalance: Math.round(run * 100) / 100 };
  });
  return { txs: rows, received, repaid, interestPaid, principal, balance, interestDue, totalOwed: Math.round((Math.max(0, balance) + interestDue) * 100) / 100 };
}

function ReportBar({ backTo, asOf, setAsOf, children }) {
  const { t } = useI18n();
  return (
    <div className="topbar no-print">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link to={backTo} className="btn">{t('← Volver')}</Link>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>{t('Fecha de corte')}
          <input type="date" style={{ width: 160 }} value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} /></label>
        {children}
      </div>
      <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
    </div>
  );
}

function useAsOf() {
  const [params, setParams] = useSearchParams();
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(params.get('al') || '') ? params.get('al') : todayIso();
  const setAsOf = (v) => { const p = new URLSearchParams(params); p.set('al', v); setParams(p, { replace: true }); };
  return [asOf, setAsOf, params, setParams];
}

// Tabla de movimientos (desembolsos, abonos a capital e intereses) con saldo de capital corrido.
function MovementsTable({ rows, t }) {
  if (rows.length === 0) return <div className="muted">{t('Sin movimientos a la fecha de corte.')}</div>;
  return (
    <table className="loan-report-table">
      <thead><tr>
        <th>{t('Fecha')}</th><th>{t('Movimiento')}</th><th>{t('Cuenta')}</th><th>{t('Referencia')}</th>
        <th className="text-right">{t('Desembolso')}</th><th className="text-right">{t('Abono a capital')}</th>
        <th className="text-right">{t('Intereses pagados')}</th><th className="text-right">{t('Saldo de capital')}</th>
      </tr></thead>
      <tbody>{rows.map((x) => (
        <tr key={x.id}>
          <td style={{ whiteSpace: 'nowrap' }}>{d10(x.tx_date)}</td>
          <td>{t(CATEGORY_LABELS[x.category] || x.category)}</td>
          <td>{x.account_name || '—'}</td>
          <td>{x.reference || x.description || '—'}</td>
          <td className="text-right">{x.isIn ? fmt$(x.amount) : ''}</td>
          <td className="text-right">{x.isCap ? fmt$(x.amount) : ''}</td>
          <td className="text-right">{x.isInt ? fmt$(x.amount) : ''}</td>
          <td className="text-right"><strong>{fmt$(x.runBalance)}</strong></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function InterestTable({ loan, t }) {
  if (!loan.interest_rate) return null;
  return (
    <>
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        {loan.interest_rate}% {t('anual')} · {t('interés simple')} · {t('año de')} {loan.day_basis || 365} {t('días')} · {t('desde')} {loan.interest_start || loan.loan_date}
      </div>
      {loan.interest_segments.length === 0 ? <div className="muted">{t('Sin intereses causados a la fecha de corte.')}</div> : (
        <table className="loan-report-table">
          <thead><tr><th>{t('Desde')}</th><th>{t('Hasta')}</th><th className="text-right">{t('Días')}</th><th className="text-right">{t('Saldo de capital')}</th><th className="text-right">{t('Intereses')}</th></tr></thead>
          <tbody>
            {loan.interest_segments.map((sg, i) => <tr key={i}><td>{sg.from}</td><td>{sg.to}</td><td className="text-right">{sg.days}</td><td className="text-right">{fmt$(sg.balance)}</td><td className="text-right">{fmt$(sg.interest)}</td></tr>)}
            <tr><td colSpan={2}><strong>{t('Total causado')}</strong></td><td className="text-right"><strong>{loan.interest_days}</strong></td><td></td><td className="text-right"><strong>{fmt$(loan.interest_accrued)}</strong></td></tr>
          </tbody>
        </table>
      )}
    </>
  );
}

// ---------- Estado de cuenta de un préstamo ----------
export function LoanStatementDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const [asOf, setAsOf] = useAsOf();
  const [loan, setLoan] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/bank/loans/${id}`, { asOf }).then(setLoan).catch((e) => setError(e.message)); }, [id, asOf]);
  if (!loan) return <div className="content">{error || t('Cargando…')}</div>;
  const r = loanAsOf(loan, asOf);
  return (
    <>
      <ReportBar backTo={`/finanzas/prestamos?ver=${loan.id}`} asOf={asOf} setAsOf={setAsOf} />
      <div className="content">
        <div className="card invoice-sheet loan-report">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('ESTADO DE CUENTA DE PRÉSTAMO')}</h2>
              <div><strong>{t('No.')}</strong> {loan.number}</div>
              <div><strong>{t('Fecha de corte:')}</strong> {asOf}</div>
              <div className="muted" style={{ fontSize: 11 }}>{t('Generado el')} {new Date().toLocaleString()}</div>
            </div>
          </div>

          <div className="doc-grid">
            <div className="doc-box">
              <div className="doc-box-title">{t('Prestamista')}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{loan.lender_name}</div>
              <div className="muted">{t(lenderTypeLabel(loan.lender_type))}</div>
            </div>
            <div className="doc-box">
              <div className="doc-box-title">{t('Condiciones')}</div>
              <div><strong>{t('Fecha del préstamo:')}</strong> {loan.interest_start || loan.loan_date}</div>
              <div><strong>{t('Monto:')}</strong> {fmt$(loan.principal)}</div>
              <div><strong>{t('Interés anual:')}</strong> {loan.interest_rate ? `${loan.interest_rate}% (${t('año de')} ${loan.day_basis || 365} ${t('días')})` : t('Sin interés')}</div>
              {loan.due_date && <div><strong>{t('Vence:')}</strong> {loan.due_date}</div>}
              {loan.notes && <div className="muted">{loan.notes}</div>}
            </div>
          </div>

          <div className="loan-report-kpis">
            <div><span>{t('Monto del préstamo')}</span><strong>{fmt$(r.principal)}</strong></div>
            <div><span>{t('Abonado a capital')}</span><strong>{fmt$(r.repaid)}</strong></div>
            <div><span>{t('Saldo de capital')}</span><strong>{fmt$(r.balance)}</strong></div>
            {loan.interest_rate ? <div><span>{t('Intereses causados')}</span><strong>{fmt$(loan.interest_accrued)}</strong></div> : null}
            {loan.interest_rate ? <div><span>{t('Intereses pagados')}</span><strong>{fmt$(r.interestPaid)}</strong></div> : null}
            {loan.interest_rate ? <div><span>{t('Intereses por pagar')}</span><strong>{fmt$(r.interestDue)}</strong></div> : null}
          </div>

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Movimientos')}</div>
            <MovementsTable rows={r.txs} t={t} />
          </div>

          {loan.interest_rate ? (
            <div className="doc-box" style={{ marginTop: 14 }}>
              <div className="doc-box-title">{t('Cálculo de intereses')}</div>
              <InterestTable loan={loan} t={t} />
            </div>
          ) : null}

          <div className="invoice-totals">
            <div><span>{t('Saldo de capital')}</span><span>{fmt$(r.balance)}</span></div>
            {loan.interest_rate ? <div><span>{t('Intereses por pagar')}</span><span>{fmt$(r.interestDue)}</span></div> : null}
            <div className="invoice-total-grand"><span>{t('Total adeudado al')} {asOf}</span><span>{fmt$(r.totalOwed)}</span></div>
            {loan.interest_rate && r.balance > 0.004 ? <div className="muted" style={{ fontSize: 12 }}><span>{t('Interés diario sobre el saldo')}</span><span>{fmt$(r.balance * loan.interest_rate / 100 / (loan.day_basis || 365))}</span></div> : null}
          </div>

          <div className="signature-block">
            <div className="signature-box"><div className="signature-line" />{t('Nexpro Trucks & Equipment Corp.')}</div>
            <div className="signature-box"><div className="signature-line" />{loan.lender_name}</div>
          </div>

        </div>
      </div>
    </>
  );
}

// ---------- Informe general de préstamos ----------
export function LoansReportDocument() {
  const { t } = useI18n();
  const [asOf, setAsOf, params, setParams] = useAsOf();
  const [loans, setLoans] = useState(null);
  const [error, setError] = useState('');
  const scope = params.get('ver') || 'vigentes';
  const detail = params.get('detalle') === '1';
  const kind = params.get('tipo') || 'todos'; // todos / socio / tercero (terceros + bancos)
  const from = /^\d{4}-\d{2}-\d{2}$/.test(params.get('desde') || '') ? params.get('desde') : '';
  const setParam = (k, v) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p, { replace: true }); };
  useEffect(() => { api.get('/bank/loans', { asOf }).then(setLoans).catch((e) => setError(e.message)); }, [asOf]);
  if (!loans) return <div className="content">{error || t('Cargando…')}</div>;

  const rows = loans
    .map((l) => ({ l, r: loanAsOf(l, asOf) }))
    .filter(({ l, r }) => r.principal > 0 || r.txs.length > 0)
    .filter(({ r }) => scope === 'todos' || r.balance > 0.004 || r.interestDue > 0.004)
    .filter(({ l }) => kind === 'todos' || (kind === 'socio' ? l.lender_type === 'socio' : l.lender_type !== 'socio'))
    .filter(({ l }) => !from || d10(l.interest_start || l.loan_date) >= from)
    .sort((a, b) => (d10(a.l.interest_start || a.l.loan_date) < d10(b.l.interest_start || b.l.loan_date) ? -1 : 1));
  const tot = (k) => rows.reduce((s, x) => s + x.r[k], 0);
  const totAccrued = rows.reduce((s, x) => s + (Number(x.l.interest_accrued) || 0), 0);

  return (
    <>
      <ReportBar backTo="/finanzas/prestamos" asOf={asOf} setAsOf={setAsOf}>
        <select style={{ width: 190 }} value={scope} onChange={(e) => setParam('ver', e.target.value)}>
          <option value="vigentes">{t('Solo préstamos vigentes')}</option>
          <option value="todos">{t('Todos los préstamos')}</option>
        </select>
        <select style={{ width: 170 }} value={kind} onChange={(e) => setParam('tipo', e.target.value)}>
          <option value="todos">{t('Socios y terceros')}</option>
          <option value="socio">{t('Solo socios')}</option>
          <option value="tercero">{t('Solo terceros / bancos')}</option>
        </select>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>{t('Préstamos desde')}
          <input type="date" style={{ width: 150 }} value={from} onChange={(e) => setParam('desde', e.target.value)} /></label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
          <input type="checkbox" checked={detail} onChange={(e) => setParam('detalle', e.target.checked ? '1' : '0')} /> {t('Incluir movimientos de cada préstamo')}
        </label>
      </ReportBar>
      <div className="content">
        <div className="card invoice-sheet loan-report loan-report-wide">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('INFORME DE PRÉSTAMOS E INTERESES')}</h2>
              <div><strong>{t('Fecha de corte:')}</strong> {asOf}</div>
              <div className="muted">{t(scope === 'todos' ? 'Todos los préstamos' : 'Solo préstamos vigentes')}{kind !== 'todos' ? ` · ${t(kind === 'socio' ? 'Solo socios' : 'Solo terceros / bancos')}` : ''}{from ? ` · ${t('desde')} ${from}` : ''}</div>
              <div className="muted" style={{ fontSize: 11 }}>{t('Generado el')} {new Date().toLocaleString()}</div>
            </div>
          </div>

          <div className="loan-report-kpis">
            <div><span>{t('Préstamos')}</span><strong>{rows.length}</strong></div>
            <div><span>{t('Saldo de capital')}</span><strong>{fmt$(tot('balance'))}</strong></div>
            <div><span>{t('Intereses por pagar')}</span><strong>{fmt$(tot('interestDue'))}</strong></div>
            <div><span>{t('Total adeudado')}</span><strong>{fmt$(tot('totalOwed'))}</strong></div>
            <div><span>{t('Intereses pagados')}</span><strong>{fmt$(tot('interestPaid'))}</strong></div>
          </div>

          {rows.length === 0 ? <div className="empty-state">{t('No hay préstamos para esta fecha de corte.')}</div> : (
            <table className="loan-report-table" style={{ marginTop: 14 }}>
              <thead><tr>
                <th>{t('Número')}</th><th>{t('Prestamista')}</th><th>{t('Fecha')}</th><th className="text-right">{t('Tasa')}</th>
                <th className="text-right">{t('Monto')}</th><th className="text-right">{t('Abonado')}</th><th className="text-right">{t('Saldo')}</th>
                <th className="text-right">{t('Int. causados')}</th><th className="text-right">{t('Int. pagados')}</th><th className="text-right">{t('Int. por pagar')}</th>
                <th className="text-right">{t('Total adeudado')}</th>
              </tr></thead>
              <tbody>
                {rows.map(({ l, r }) => (
                  <tr key={l.id}>
                    <td className="mono" style={{ whiteSpace: 'nowrap' }}>{l.number}</td>
                    <td>{l.lender_name}<div className="muted" style={{ fontSize: 11 }}>{t(lenderTypeLabel(l.lender_type))}</div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.interest_start || l.loan_date}</td>
                    <td className="text-right">{l.interest_rate ? `${l.interest_rate}%` : '—'}</td>
                    <td className="text-right">{fmt$(r.principal)}</td>
                    <td className="text-right">{fmt$(r.repaid)}</td>
                    <td className="text-right">{fmt$(r.balance)}</td>
                    <td className="text-right">{l.interest_rate ? fmt$(l.interest_accrued) : '—'}</td>
                    <td className="text-right">{l.interest_rate ? fmt$(r.interestPaid) : '—'}</td>
                    <td className="text-right">{l.interest_rate ? fmt$(r.interestDue) : '—'}</td>
                    <td className="text-right"><strong>{fmt$(r.totalOwed)}</strong></td>
                  </tr>
                ))}
                <tr className="loan-report-total">
                  <td colSpan={4}><strong>{t('Totales')}</strong></td>
                  <td className="text-right"><strong>{fmt$(tot('principal'))}</strong></td>
                  <td className="text-right"><strong>{fmt$(tot('repaid'))}</strong></td>
                  <td className="text-right"><strong>{fmt$(tot('balance'))}</strong></td>
                  <td className="text-right"><strong>{fmt$(totAccrued)}</strong></td>
                  <td className="text-right"><strong>{fmt$(tot('interestPaid'))}</strong></td>
                  <td className="text-right"><strong>{fmt$(tot('interestDue'))}</strong></td>
                  <td className="text-right"><strong>{fmt$(tot('totalOwed'))}</strong></td>
                </tr>
              </tbody>
            </table>
          )}

          {detail && rows.map(({ l, r }) => (
            <div key={l.id} className="doc-box loan-report-detail" style={{ marginTop: 14 }}>
              <div className="doc-box-title">{l.number} · {l.lender_name}</div>
              <MovementsTable rows={r.txs} t={t} />
              {l.interest_rate ? <div style={{ marginTop: 8 }}><InterestTable loan={l} t={t} /></div> : null}
            </div>
          ))}

        </div>
      </div>
    </>
  );
}
