import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import Modal from '../components/Modal.jsx';
import { useI18n } from '../i18n.jsx';
import { useAuth } from '../auth.jsx';
import { LoanModal, LoanPaymentModal, LoanTermsModal, CATEGORY_LABELS, fmt$ } from '../components/FinanceModals.jsx';

// Préstamos recibidos de socios y terceros: cuánto entró, cuánto se ha abonado y el saldo.
export default function LoansPage() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [loans, setLoans] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [modal, setModal] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  // Consultar los intereses a cualquier fecha sin registrar un pago.
  React.useEffect(() => { if (viewing && viewing.interest_rate && asOf) api.get(`/bank/loans/${viewing.id}`, { asOf }).then((l) => setViewing((v) => (v && v.id === l.id ? l : v))).catch(() => {}); }, [asOf, viewing && viewing.id]);
  const [error, setError] = useState('');
  function load() {
    api.get('/bank/loans').then((l) => { setLoans(l); const v = params.get('ver'); if (v) { setViewing(l.find((x) => String(x.id) === v) || null); setParams({}, { replace: true }); } }).catch((e) => setError(e.message));
    api.get('/bank/accounts').then((a) => setAccounts(a.filter((x) => x.active))).catch(() => {});
  }
  useEffect(load, []);
  const done = () => { setModal(null); setViewing(null); load(); };
  const open = loans.filter((l) => l.balance > 0.004);
  async function del(l) {
    if (!window.confirm(`${t('¿Borrar el préstamo')} ${l.number} ${t('y todos sus movimientos en el banco?')}`)) return;
    try { await api.del(`/bank/loans/${l.id}`); done(); } catch (err) { alert(err.message); }
  }

  if (error) return <div className="content"><div className="error-banner">{error}</div></div>;
  return (
    <>
      <div className="topbar">
        <div><h1>{t('Préstamos')}</h1><div className="sub">{t('Dinero recibido de socios y terceros, abonos y saldo pendiente')}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {loans.length > 0 && <Link className="btn" to="/finanzas/prestamos/informe">{t('🖨️ Informe de préstamos')}</Link>}
          {accounts.length > 0 && <button className="btn btn-primary" onClick={() => setModal({ type: 'loan' })}>{t('+ Préstamo recibido')}</button>}
        </div>
      </div>
      <div className="content">
        <div className="chain-summary">
          <div className="chain-box"><span>{t('Saldo por pagar')}</span><strong>{fmt$(open.reduce((s, l) => s + l.balance, 0))}</strong></div>
          <div className="chain-box"><span>{t('De socios')}</span><strong>{fmt$(open.filter((l) => l.lender_type === 'socio').reduce((s, l) => s + l.balance, 0))}</strong></div>
          <div className="chain-box"><span>{t('De terceros / bancos')}</span><strong>{fmt$(open.filter((l) => l.lender_type !== 'socio').reduce((s, l) => s + l.balance, 0))}</strong></div>
          <div className="chain-box"><span>{t('Intereses por pagar a hoy')}</span><strong>{fmt$(open.reduce((s, l) => s + l.interest_due, 0))}</strong></div>
          <div className="chain-box"><span>{t('Intereses pagados')}</span><strong>{fmt$(loans.reduce((s, l) => s + l.interest_paid, 0))}</strong></div>
        </div>
        <div className="card">
          {accounts.length === 0 && <div className="muted" style={{ marginBottom: 8 }}>{t('Primero crea una cuenta en Finanzas → Bancos.')}</div>}
          {loans.length === 0 ? <div className="empty-state">{t('No hay préstamos registrados.')}</div> : (
            <table>
              <thead><tr><th>{t('Número')}</th><th>{t('Prestamista')}</th><th>{t('Tipo')}</th><th>{t('Fecha')}</th><th className="text-right">{t('Monto')}</th><th className="text-right">{t('Abonado')}</th><th className="text-right">{t('Saldo')}</th><th className="text-right">{t('Interés')}</th><th className="text-right">{t('Intereses a hoy')}</th><th>{t('Estado')}</th><th></th></tr></thead>
              <tbody>{loans.map((l) => (
                <tr key={l.id} className="clickable" onClick={() => setViewing(l)}>
                  <td className="mono">{l.number}</td><td>{l.lender_name}</td><td>{t(l.lender_type === 'socio' ? 'Socio' : l.lender_type === 'banco' ? 'Banco / entidad' : 'Tercero')}</td>
                  <td className="muted">{l.loan_date}</td><td className="text-right">{fmt$(l.principal)}</td><td className="text-right muted">{fmt$(l.repaid)}</td>
                  <td className="text-right"><strong>{fmt$(l.balance)}</strong></td>
                  <td className="text-right muted">{l.interest_rate ? `${l.interest_rate}%` : '—'}</td>
                  <td className="text-right">{l.interest_rate ? fmt$(l.interest_due) : '—'}</td>
                  <td><Pill value={l.status} /></td>
                  <td onClick={(e) => e.stopPropagation()}>{l.balance > 0.004 && <button className="link-btn" onClick={() => setModal({ type: 'pay', loan: l })}>{t('Registrar abono')}</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
      {viewing && (
        <Modal title={`${t('Préstamo')} ${viewing.number} · ${viewing.lender_name}`} onClose={() => setViewing(null)} wide>
          <div className="chain-summary">
            <div className="chain-box"><span>{t('Monto')}</span><strong>{fmt$(viewing.principal)}</strong></div>
            <div className="chain-box"><span>{t('Abonado a capital')}</span><strong>{fmt$(viewing.repaid)}</strong></div>
            <div className="chain-box"><span>{t('Intereses pagados')}</span><strong>{fmt$(viewing.interest_paid)}</strong></div>
            <div className="chain-box"><span>{t('Saldo')}</span><strong>{fmt$(viewing.balance)}</strong></div>
            {viewing.interest_rate ? <div className="chain-box"><span>{t('Intereses por pagar al')} {viewing.interest_as_of}</span><strong>{fmt$(viewing.interest_due)}</strong><span>{fmt$(viewing.daily_interest)} {t('por día')}</span></div> : null}
          </div>
          {viewing.interest_rate ? (
            <div style={{ fontSize: 13, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div><strong>{t('Cálculo de intereses')}</strong> · {viewing.interest_rate}% {t('anual')} · {t('año de')} {viewing.day_basis || 365} {t('días')} · {t('desde')} {viewing.interest_start || viewing.loan_date}</div>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>{t('Calcular al')} <input type="date" style={{ width: 160 }} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
              </div>
              <div className="muted">{t('Causados')}: {fmt$(viewing.interest_accrued)} − {t('pagados')}: {fmt$(viewing.interest_paid)} = <strong>{fmt$(viewing.interest_due)}</strong> ({viewing.interest_days} {t('días')})</div>
              {viewing.interest_segments.length > 1 && (
                <table style={{ marginTop: 6 }}><thead><tr><th>{t('Desde')}</th><th>{t('Hasta')}</th><th className="text-right">{t('Días')}</th><th className="text-right">{t('Saldo de capital')}</th><th className="text-right">{t('Intereses')}</th></tr></thead>
                  <tbody>{viewing.interest_segments.map((sg, i) => <tr key={i}><td>{sg.from}</td><td>{sg.to}</td><td className="text-right">{sg.days}</td><td className="text-right">{fmt$(sg.balance)}</td><td className="text-right">{fmt$(sg.interest)}</td></tr>)}</tbody></table>
              )}
            </div>
          ) : null}
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            {viewing.interest_rate != null && <span>{t('Interés anual:')} {viewing.interest_rate}% · </span>}
            {viewing.due_date && <span>{t('Vence:')} {viewing.due_date} · </span>}
            {viewing.notes && <span>{viewing.notes}</span>}
          </div>
          <table>
            <thead><tr><th>{t('Fecha')}</th><th>{t('Movimiento')}</th><th>{t('Cuenta')}</th><th>{t('Referencia')}</th><th className="text-right">{t('Monto')}</th></tr></thead>
            <tbody>{viewing.transactions.map((x) => (
              <tr key={x.id}><td className="muted">{x.tx_date}</td><td>{t(CATEGORY_LABELS[x.category] || x.category)}</td><td>{x.account_name}</td><td>{x.reference || '—'}</td>
                <td className="text-right" style={{ color: x.direction === 'in' ? '#15803d' : 'var(--red)' }}>{x.direction === 'in' ? '+' : '−'}{fmt$(x.amount)}</td></tr>
            ))}</tbody>
          </table>
          <div className="modal-footer">
            {isAdmin && <button className="btn btn-danger" onClick={() => del(viewing)}>{t('Eliminar')}</button>}
            <Link className="btn" to={`/finanzas/prestamos/${viewing.id}/estado?al=${asOf}`}>{t('🖨️ Imprimir estado de cuenta')}</Link>
            <button className="btn" onClick={() => setModal({ type: 'terms', loan: viewing })}>{t('✏️ Condiciones / interés')}</button>
            {viewing.balance > 0.004 && <button className="btn btn-primary" onClick={() => setModal({ type: 'pay', loan: viewing })}>{t('Registrar abono')}</button>}
          </div>
        </Modal>
      )}
      {modal?.type === 'loan' && <LoanModal accounts={accounts} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'terms' && <LoanTermsModal loan={modal.loan} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'pay' && <LoanPaymentModal accounts={accounts} loan={modal.loan} onDone={done} onClose={() => setModal(null)} />}
    </>
  );
}
