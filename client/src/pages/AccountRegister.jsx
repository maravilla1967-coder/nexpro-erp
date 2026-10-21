import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport } from '../components/ListExport.jsx';
import { TxModal, PayrollModal, TransferModal, AccountModal, CATEGORY_LABELS, ACCOUNT_TYPES, fmt$ } from '../components/FinanceModals.jsx';

// Registro de una cuenta (como la chequera de Microsoft Money): cada movimiento con su
// documento, ingreso/egreso, saldo corrido y casilla de conciliado.
export default function AccountRegister() {
  const { t } = useI18n();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [range, setRange] = useState({ from: '', to: '' });
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api.get(`/bank/accounts/${id}/register`, range).then(setData).catch((e) => setError(e.message));
    api.get('/bank/accounts').then(setAccounts).catch(() => {});
  }
  useEffect(load, [id, range]);

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = norm(q).split(/\s+/).filter(Boolean);
  const rows = (data ? data.rows : []).filter((r) => (!cat || r.category === cat) && (!words.length || words.every((w) =>
    norm([r.payee, r.description, r.reference, r.doc && r.doc.number, t(CATEGORY_LABELS[r.category] || ''), r.amount, r.date, r.period].join(' ')).includes(w))));
  const ex = useListExport({ rows, getDate: (r) => r.date, getNumber: () => '' });
  const COLUMNS = [
    { label: 'Fecha', value: (r) => r.date }, { label: 'Beneficiario / pagador', value: (r) => r.payee || '' },
    { label: 'Categoría', value: (r) => t(CATEGORY_LABELS[r.category] || r.category) }, { label: 'Documento', value: (r) => (r.doc ? `${r.doc.type} ${r.doc.number}` : '') },
    { label: 'Descripción', value: (r) => [r.description, r.reference].filter(Boolean).join(' · ') },
    { label: 'Ingreso', value: (r) => (r.direction === 'in' ? r.amount : ''), type: 'money' }, { label: 'Egreso', value: (r) => (r.direction === 'out' ? r.amount : ''), type: 'money' },
    { label: 'Saldo', value: (r) => r.balance, type: 'money', noTotal: true },
  ];

  async function toggleCleared(r) {
    await api.post('/bank/cleared', { kind: r.kind, id: r.id, cleared: !r.cleared });
    setData({ ...data, rows: data.rows.map((x) => (x.kind === r.kind && x.id === r.id ? { ...x, cleared: !r.cleared } : x)) });
  }
  async function editManual(r) { setModal({ type: 'edit', tx: await api.get(`/bank/transactions/${r.id}`) }); }
  async function delManual(r) {
    if (!window.confirm(r.transfer_group ? t('¿Borrar esta transferencia? Se borra en las dos cuentas.') : t('¿Borrar este movimiento?'))) return;
    try { await api.del(`/bank/transactions/${r.id}`); load(); } catch (err) { alert(err.message); }
  }

  if (error) return <div className="content"><div className="error-banner">{error}</div></div>;
  if (!data) return <div className="content">{t('Cargando…')}</div>;
  const a = data.account;
  const active = accounts.filter((x) => x.active);
  const done = () => { setModal(null); load(); };
  const cats = [...new Set(data.rows.map((r) => r.category))];

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{a.name}{a.is_default ? ' ★' : ''}</h1>
          <div className="sub">{[a.bank_name, t(ACCOUNT_TYPES[a.account_type] || a.account_type), a.account_masked].filter(Boolean).join(' · ')}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Link to="/finanzas" className="btn">{t('← Bancos')}</Link>
          <button className="btn" onClick={() => setModal({ type: 'account' })}>{t('✏️ Cuenta')}</button>
          <button className="btn" onClick={() => setModal({ type: 'in' })}>{t('+ Ingreso')}</button>
          <button className="btn" onClick={() => setModal({ type: 'out' })}>{t('+ Egreso')}</button>
          <button className="btn" onClick={() => setModal({ type: 'payroll' })}>{t('Nómina')}</button>
          <button className="btn" onClick={() => setModal({ type: 'transfer' })}>{t('Transferencia')}</button>
        </div>
      </div>
      <div className="content">
        <div className="chain-summary">
          <div className="chain-box"><span>{t('Saldo actual')}</span><strong className={a.balance < 0 ? 'text-danger' : ''}>{fmt$(a.balance)}</strong></div>
          <div className="chain-box"><span>{t('Saldo conciliado')}</span><strong>{fmt$(a.cleared_balance)}</strong></div>
          <div className="chain-box"><span>{t('Saldo inicial')}</span><strong>{fmt$(a.opening_balance)}</strong>{a.opening_date && <span>{a.opening_date}</span>}</div>
          {(range.from || range.to) && <div className="chain-box"><span>{t('Saldo al inicio del periodo')}</span><strong>{fmt$(data.startBalance)}</strong></div>}
        </div>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <input className="search-input" style={{ flex: '1 1 260px' }} placeholder={t('🔎 Buscar beneficiario, documento, referencia, monto…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 210 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{t('Todas las categorías')}</option>
            {cats.map((c) => <option key={c} value={c}>{t(CATEGORY_LABELS[c] || c)}</option>)}
          </select>
        </div>
        <div className="card">
          {rows.length === 0 ? <div className="empty-state">{t('Sin movimientos.')}</div> : (
            <>
              <ListExportBar ex={ex} title={`${t('Movimientos')} — ${a.name}`} filename={`banco-${a.name}`} columns={COLUMNS} />
              <table className="register">
                <thead><tr><th title={t('Conciliado con el extracto')}>✓</th><th>{t('Fecha')}</th><th>{t('Beneficiario / pagador')}</th><th>{t('Categoría')}</th><th>{t('Documento')}</th>
                  <th className="text-right">{t('Ingreso')}</th><th className="text-right">{t('Egreso')}</th><th className="text-right">{t('Saldo')}</th><th></th></tr></thead>
                <tbody>{ex.visible.map((r) => (
                  <tr key={r.kind + r.id} className={r.cleared ? 'cleared' : ''}>
                    <td><input type="checkbox" style={{ width: 'auto' }} checked={r.cleared} onChange={() => toggleCleared(r)} /></td>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td>{r.payee || '—'}{(r.description || r.reference || r.period) && <div className="muted" style={{ fontSize: 12 }}>{[r.period && `${t('Periodo')}: ${r.period}`, r.description, r.reference && `Ref. ${r.reference}`].filter(Boolean).join(' · ')}</div>}
                      {r.kind === 'invoice' && (r.surcharge > 0 || r.processor_fee > 0) && <div className="muted" style={{ fontSize: 11 }}>{fmt$(r.doc_amount)}{r.surcharge > 0 ? ` + ${fmt$(r.surcharge)} ${t('recargo')}` : ''}{r.processor_fee > 0 ? ` − ${fmt$(r.processor_fee)} ${t('comisión')}` : ''}</div>}</td>
                    <td style={{ fontSize: 13 }}>{t(CATEGORY_LABELS[r.category] || r.category)}</td>
                    <td style={{ fontSize: 13 }}>{r.doc ? <Link to={r.doc.link}>{t(r.doc.type)} <span className="mono">{r.doc.number}</span></Link> : <span className="muted">{r.files_count ? `📎 ${r.files_count}` : '—'}</span>}</td>
                    <td className="text-right" style={{ color: '#15803d' }}>{r.direction === 'in' ? fmt$(r.amount) : ''}</td>
                    <td className="text-right" style={{ color: 'var(--red)' }}>{r.direction === 'out' ? fmt$(r.amount) : ''}</td>
                    <td className="text-right"><strong>{fmt$(r.balance)}</strong></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.kind === 'manual' && <>
                      <button className="link-btn" onClick={() => editManual(r)}>{t('Editar')}</button>{' '}
                      {!(r.loan_id && ['prestamo_socio', 'prestamo_tercero'].includes(r.category)) && <button className="link-btn" onClick={() => delManual(r)}>✕</button>}
                    </>}</td>
                  </tr>
                ))}</tbody>
              </table>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('Los cobros y pagos que vienen de facturas, proveedores o pagos sin factura se corrigen desde su documento (enlace en "Documento"). Marca ✓ cuando el movimiento aparezca en el extracto del banco.')}</div>
            </>
          )}
        </div>
      </div>
      {modal?.type === 'account' && <AccountModal initial={a} onDone={done} onClose={() => setModal(null)} />}
      {(modal?.type === 'in' || modal?.type === 'out') && <TxModal accounts={active} accountId={a.id} direction={modal.type} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <TxModal accounts={active} initial={modal.tx} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'payroll' && <PayrollModal accounts={active} accountId={a.id} onDone={done} onClose={() => setModal(null)} />}
      {modal?.type === 'transfer' && <TransferModal accounts={active} accountId={a.id} onDone={done} onClose={() => setModal(null)} />}
    </>
  );
}
