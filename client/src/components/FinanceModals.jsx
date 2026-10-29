import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { readFilesNow } from './PaymentModal.jsx';
import { useAuth } from '../auth.jsx';

// Ventanas del módulo de Finanzas: ingreso, egreso, nómina, transferencia, préstamo recibido,
// abono a préstamo y cuenta bancaria.
export const CATEGORY_LABELS = {
  cobro_factura: 'Cobro de factura', prestamo_socio: 'Préstamo de socio', prestamo_tercero: 'Préstamo de tercero', aporte_capital: 'Aporte de capital',
  intereses_ganados: 'Intereses ganados', reembolso: 'Reembolso / devolución', transferencia_entrada: 'Transferencia recibida', otro_ingreso: 'Otro ingreso',
  pago_proveedor: 'Pago a proveedor', pago_sin_factura: 'Pago sin factura (servicios)', nomina: 'Nómina', abono_prestamo: 'Abono a préstamo',
  intereses_prestamo: 'Intereses de préstamo', comision_bancaria: 'Comisión bancaria', impuestos: 'Impuestos', gasto_general: 'Gasto general',
  retiro_socio: 'Retiro de socio', transferencia_salida: 'Transferencia enviada', otro_egreso: 'Otro egreso',
};
// Categorías que se registran a mano (las de facturas y proveedores llegan solas desde sus documentos).
const MANUAL_IN = ['aporte_capital', 'intereses_ganados', 'reembolso', 'otro_ingreso'];
const MANUAL_OUT = ['nomina', 'comision_bancaria', 'impuestos', 'gasto_general', 'retiro_socio', 'otro_egreso'];
export const ACCOUNT_TYPES = { corriente: 'Cuenta corriente (checking)', ahorros: 'Ahorros (savings)', tarjeta: 'Tarjeta de crédito', efectivo: 'Caja / efectivo', otra: 'Otra' };
export const fmt$ = (v) => (Number(v) < 0 ? '−' : '') + '$' + Math.abs(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const parse$ = (v) => parseFloat(String(v ?? '').replace(/[$,\s]/g, '')) || 0;

function AccountSelect({ accounts, value, onChange, label }) {
  const { t } = useI18n();
  return (
    <div className="field"><label>{label || t('Cuenta')}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('— Seleccionar —')}</option>
        {accounts.filter((a) => a.active !== 0).map((a) => <option key={a.id} value={a.id}>{a.name}{a.account_masked ? ` ${a.account_masked}` : ''}</option>)}
      </select>
    </div>
  );
}
function Footer({ error, saving, onClose, label, disabled }) {
  const { t } = useI18n();
  return (
    <div className="modal-footer">
      {error && <div className="error-banner" style={{ margin: 0, flexBasis: '100%' }}>{error}</div>}
      <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
      <button type="submit" className="btn btn-primary" disabled={saving || disabled}>{saving ? t('Guardando…') : (label || t('Guardar'))}</button>
    </div>
  );
}
const defaultId = (accounts, preset) => String(preset || (accounts.find((a) => a.is_default) || accounts[0] || {}).id || '');

// Ingreso o egreso manual (y edición de un movimiento propio del banco).
export function TxModal({ accounts, direction, accountId, initial, onDone, onClose }) {
  const { t } = useI18n();
  const dir = initial ? initial.direction : direction;
  const cats = dir === 'in' ? MANUAL_IN : MANUAL_OUT;
  const [f, setF] = useState(initial ? {
    accountId: String(initial.account_id), date: initial.tx_date, category: initial.category, amount: String(initial.amount), payee: initial.payee || '',
    description: initial.description || '', reference: initial.reference || '', period: initial.period || '',
  } : { accountId: defaultId(accounts, accountId), date: today(), category: cats[0], amount: '', payee: '', description: '', reference: '', period: '' });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const lockedCat = initial && !cats.includes(initial.category);
  async function save(e) {
    e.preventDefault(); setError('');
    if (!f.accountId) { setError(t('Elige la cuenta bancaria.')); return; }
    if (!(parse$(f.amount) > 0)) { setError(t('Escribe el monto.')); return; }
    const fd = new FormData();
    Object.entries({ ...f, direction: dir, amount: parse$(f.amount) }).forEach(([k, v]) => fd.append(k, String(v ?? '')));
    files.forEach((x) => fd.append('files', x, x.name));
    setSaving(true);
    try {
      if (initial) await api.putForm(`/bank/transactions/${initial.id}`, fd); else await api.postForm('/bank/transactions', fd);
      onDone();
    } catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={initial ? t('Editar movimiento') : dir === 'in' ? t('Registrar ingreso') : t('Registrar egreso')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        {!initial && <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>{dir === 'in'
          ? t('Los cobros de facturas entran solos al registrar el pago en la factura. Aquí van otros ingresos (aportes, intereses, reembolsos…). Préstamos: usa "Préstamo recibido".')
          : t('Los pagos a proveedores y pagos sin factura salen solos al registrar el pago. Aquí van otros egresos (comisiones, impuestos, gastos…). Nómina: usa "Nómina".')}</div>}
        <div className="grid grid-2">
          <AccountSelect accounts={accounts} value={f.accountId} onChange={(v) => setF({ ...f, accountId: v })} />
          <div className="field"><label>{t('Fecha')}</label><input type="date" value={f.date} onChange={set('date')} /></div>
          <div className="field"><label>{t('Categoría')}</label>
            {lockedCat ? <input disabled value={t(CATEGORY_LABELS[f.category] || f.category)} />
              : <select value={f.category} onChange={set('category')}>{cats.map((c) => <option key={c} value={c}>{t(CATEGORY_LABELS[c])}</option>)}</select>}
          </div>
          <div className="field"><label>{t('Monto')}</label><input inputMode="decimal" placeholder="0.00" value={f.amount} onChange={set('amount')} /></div>
          <div className="field"><label>{dir === 'in' ? t('Recibido de') : t('Pagado a')}</label><input value={f.payee} onChange={set('payee')} /></div>
          <div className="field"><label>{t('Referencia (cheque, confirmación…)')}</label><input value={f.reference} onChange={set('reference')} /></div>
          {f.category === 'nomina' && <div className="field"><label>{t('Periodo de nómina')}</label><input placeholder={t('Ej.: 1–15 oct 2026')} value={f.period} onChange={set('period')} /></div>}
        </div>
        <div className="field"><label>{t('Descripción')}</label><textarea rows={2} value={f.description} onChange={set('description')} /></div>
        <div className="field"><label>{t('Soporte (recibo, extracto, captura…)')}</label>
          <input type="file" multiple onChange={async (e) => { const l = Array.from(e.target.files || []); try { setFiles(await readFilesNow(l)); } catch { setFiles(l); } }} /></div>
        <Footer error={error} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

// Nómina: varias personas en un solo registro.
export function PayrollModal({ accounts, accountId, onDone, onClose }) {
  const { t } = useI18n();
  const [acc, setAcc] = useState(defaultId(accounts, accountId));
  const [date, setDate] = useState(today());
  const [period, setPeriod] = useState('');
  const [lines, setLines] = useState([{ payee: '', amount: '', reference: '' }]);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const upd = (i, k, v) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + parse$(l.amount), 0);
  async function save(e) {
    e.preventDefault(); setError('');
    if (!acc) { setError(t('Elige la cuenta bancaria.')); return; }
    setSaving(true);
    try { await api.post('/bank/payroll', { accountId: acc, date, period, lines }); onDone(); }
    catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={t('Registrar pago de nómina')} onClose={onClose} wide>
      <form onSubmit={save} noValidate>
        <div className="grid grid-2">
          <AccountSelect accounts={accounts} value={acc} onChange={setAcc} label={t('Cuenta de donde sale el pago')} />
          <div className="field"><label>{t('Fecha del pago')}</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>{t('Periodo')}</label><input placeholder={t('Ej.: 1–15 oct 2026')} value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
        </div>
        <table>
          <thead><tr><th>{t('Empleado')}</th><th style={{ width: 140 }}>{t('Monto')}</th><th style={{ width: 200 }}>{t('Referencia (cheque, depósito…)')}</th><th></th></tr></thead>
          <tbody>{lines.map((l, i) => (
            <tr key={i}>
              <td><input value={l.payee} onChange={(e) => upd(i, 'payee', e.target.value)} /></td>
              <td><input inputMode="decimal" placeholder="0.00" value={l.amount} onChange={(e) => upd(i, 'amount', e.target.value)} /></td>
              <td><input value={l.reference} onChange={(e) => upd(i, 'reference', e.target.value)} /></td>
              <td>{lines.length > 1 && <button type="button" className="link-btn" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>}</td>
            </tr>
          ))}</tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button type="button" className="btn btn-sm" onClick={() => setLines([...lines, { payee: '', amount: '', reference: '' }])}>{t('+ Agregar persona')}</button>
          <strong>{t('Total')}: {fmt$(total)}</strong>
        </div>
        <Footer error={error} saving={saving} onClose={onClose} label={t('Registrar nómina')} />
      </form>
    </Modal>
  );
}

export function TransferModal({ accounts, accountId, onDone, onClose }) {
  const { t } = useI18n();
  const [f, setF] = useState({ fromAccountId: defaultId(accounts, accountId), toAccountId: '', amount: '', date: today(), description: '', reference: '' });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try { await api.post('/bank/transfers', { ...f, amount: parse$(f.amount) }); onDone(); }
    catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={t('Transferencia entre cuentas')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="grid grid-2">
          <AccountSelect accounts={accounts} value={f.fromAccountId} onChange={(v) => setF({ ...f, fromAccountId: v })} label={t('Sale de')} />
          <AccountSelect accounts={accounts} value={f.toAccountId} onChange={(v) => setF({ ...f, toAccountId: v })} label={t('Entra a')} />
          <div className="field"><label>{t('Monto')}</label><input inputMode="decimal" placeholder="0.00" value={f.amount} onChange={set('amount')} /></div>
          <div className="field"><label>{t('Fecha')}</label><input type="date" value={f.date} onChange={set('date')} /></div>
          <div className="field"><label>{t('Referencia')}</label><input value={f.reference} onChange={set('reference')} /></div>
          <div className="field"><label>{t('Descripción')}</label><input value={f.description} onChange={set('description')} /></div>
        </div>
        <Footer error={error} saving={saving} onClose={onClose} label={t('Transferir')} />
      </form>
    </Modal>
  );
}

export function LoanModal({ accounts, onDone, onClose }) {
  const { t } = useI18n();
  const [f, setF] = useState({ lenderName: '', lenderType: 'socio', principal: '', loanDate: today(), accountId: defaultId(accounts), interestRate: '', dayBasis: '365', dueDate: '', reference: '', notes: '' });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault(); setError(''); setSaving(true);
    const fd = new FormData(); Object.entries({ ...f, principal: parse$(f.principal) }).forEach(([k, v]) => fd.append(k, String(v ?? '')));
    files.forEach((x) => fd.append('files', x, x.name));
    try { await api.postForm('/bank/loans', fd); onDone(); } catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={t('Préstamo recibido')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="grid grid-2">
          <div className="field"><label>{t('Quién prestó *')}</label><input value={f.lenderName} onChange={set('lenderName')} /></div>
          <div className="field"><label>{t('Tipo')}</label>
            <select value={f.lenderType} onChange={set('lenderType')}><option value="socio">{t('Socio')}</option><option value="tercero">{t('Tercero')}</option><option value="banco">{t('Banco / entidad')}</option></select></div>
          <div className="field"><label>{t('Monto recibido *')}</label><input inputMode="decimal" placeholder="0.00" value={f.principal} onChange={set('principal')} /></div>
          <div className="field"><label>{t('Fecha')}</label><input type="date" value={f.loanDate} onChange={set('loanDate')} /></div>
          <AccountSelect accounts={accounts} value={f.accountId} onChange={(v) => setF({ ...f, accountId: v })} label={t('Cuenta donde entró el dinero')} />
          <div className="field"><label>{t('Interés anual (%)')}</label><input inputMode="decimal" value={f.interestRate} onChange={set('interestRate')} /></div>
          <div className="field"><label>{t('Cálculo de intereses por días')}</label>
            <select value={f.dayBasis} onChange={set('dayBasis')}><option value="365">{t('Año de 365 días (días reales)')}</option><option value="360">{t('Año comercial de 360 días')}</option></select></div>
          <div className="field"><label>{t('Fecha de vencimiento')}</label><input type="date" value={f.dueDate} onChange={set('dueDate')} /></div>
          <div className="field"><label>{t('Referencia')}</label><input value={f.reference} onChange={set('reference')} /></div>
        </div>
        <div className="field"><label>{t('Condiciones / notas')}</label><textarea rows={2} value={f.notes} onChange={set('notes')} /></div>
        <div className="field"><label>{t('Soporte (pagaré, acuerdo, comprobante de la transferencia…)')}</label>
          <input type="file" multiple onChange={async (e) => { const l = Array.from(e.target.files || []); try { setFiles(await readFilesNow(l)); } catch { setFiles(l); } }} /></div>
        <Footer error={error} saving={saving} onClose={onClose} label={t('Registrar préstamo')} />
      </form>
    </Modal>
  );
}

export function LoanPaymentModal({ accounts, loan, onDone, onClose }) {
  const { t } = useI18n();
  const hasRate = Number(loan.interest_rate) > 0;
  // 'total': un solo monto, se aplica primero a intereses pendientes y el resto a capital.
  // 'manual': capital e intereses por separado.
  const [mode, setMode] = useState(hasRate ? 'total' : 'manual');
  const [f, setF] = useState({ accountId: defaultId(accounts.filter((a) => !a.is_direct)), total: '', amount: '', interest: '', date: today(), reference: '' });
  // ¿Quién pagó? Nexpro desde un banco, o un socio directamente (queda como préstamo nuevo de ese socio).
  const [payer, setPayer] = useState('nexpro');
  const [partner, setPartner] = useState({ name: '', rate: '' });
  const [partnerNames, setPartnerNames] = useState([]);
  const [allLoans, setAllLoans] = useState([]);
  useEffect(() => { api.get('/bank/loans').then(setAllLoans).catch(() => {}); }, []);
  useEffect(() => { setPartnerNames([...new Set(allLoans.filter((x) => (payer === 'socio' ? x.lender_type === 'socio' : x.lender_type !== 'socio')).map((x) => x.lender_name.trim()))]); }, [allLoans, payer]);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const [acc, setAcc] = useState(null);
  // Intereses causados hasta la fecha del pago (interés simple por días sobre el saldo).
  useEffect(() => { if (f.date) api.get(`/bank/loans/${loan.id}`, { asOf: f.date }).then(setAcc).catch(() => {}); }, [f.date, loan.id]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const due = acc ? Number(acc.interest_due) || 0 : 0;
  const balance = Number(loan.balance) || 0;
  const owed = Math.round((balance + due) * 100) / 100;
  const total = parse$(f.total);
  const toInterest = Math.min(total, due);
  const toCapital = Math.round((total - toInterest) * 100) / 100;
  const over = mode === 'total' && toCapital - balance > 0.004;
  async function save(e) {
    e.preventDefault(); setError(''); setSaving(true);
    if (payer !== 'nexpro' && !partner.name.trim()) { setError(t('Escribe quién hizo el pago.')); setSaving(false); return; }
    const who = payer !== 'nexpro' ? { paidByPartner: partner.name.trim(), paidByType: payer, partnerRate: partner.rate } : { accountId: f.accountId };
    const body = mode === 'total'
      ? { ...who, date: f.date, reference: f.reference, total }
      : { ...who, date: f.date, reference: f.reference, amount: parse$(f.amount), interest: parse$(f.interest) };
    try { await api.post(`/bank/loans/${loan.id}/payments`, body); onDone(); }
    catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={`${t('Abono a préstamo')} · ${loan.number} · ${loan.lender_name}`} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="loan-pay-owed">
          <div><span>{t('Saldo de capital')}</span><strong>{fmt$(balance)}</strong></div>
          {hasRate && <div><span>{t('Intereses pendientes al')} {acc ? acc.interest_as_of : f.date}</span><strong>{fmt$(due)}</strong></div>}
          {hasRate && <div><span>{t('Total adeudado')}</span><strong>{fmt$(owed)}</strong></div>}
        </div>
        {hasRate && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '4px 0 10px', fontSize: 13 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0, fontWeight: 400 }}><input type="radio" style={{ width: 'auto' }} checked={mode === 'total'} onChange={() => setMode('total')} /> {t('Monto total pagado (primero intereses, luego capital)')}</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0, fontWeight: 400 }}><input type="radio" style={{ width: 'auto' }} checked={mode === 'manual'} onChange={() => setMode('manual')} /> {t('Separar capital e intereses a mano')}</label>
          </div>
        )}
        <div className="grid grid-2">
          <div className="field" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
            <label>{t('¿Quién hizo el pago?')}</label>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0, fontWeight: 400 }}><input type="radio" style={{ width: 'auto' }} checked={payer === 'nexpro'} onChange={() => setPayer('nexpro')} /> {t('Nexpro, desde una cuenta del banco')}</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0, fontWeight: 400 }}><input type="radio" style={{ width: 'auto' }} checked={payer === 'socio'} onChange={() => setPayer('socio')} /> {t('Un socio pagó directamente')}</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0, fontWeight: 400 }}><input type="radio" style={{ width: 'auto' }} checked={payer === 'tercero'} onChange={() => setPayer('tercero')} /> {t('Un tercero pagó directamente')}</label>
            </div>
          </div>
          {payer === 'nexpro'
            ? <AccountSelect accounts={accounts.filter((a) => !a.is_direct)} value={f.accountId} onChange={(v) => setF({ ...f, accountId: v })} label={t('Cuenta de donde sale el pago')} />
            : (
              <div className="field">
                <label>{payer === 'socio' ? t('Socio que pagó') : t('Tercero que pagó')}</label>
                <input list="partner-names" value={partner.name} onChange={(e) => setPartner({ ...partner, name: e.target.value })} placeholder={payer === 'socio' ? t('Nombre del socio') : t('Nombre del tercero')} />
                <datalist id="partner-names">{partnerNames.map((n) => <option key={n} value={n} />)}</datalist>
                <input inputMode="decimal" style={{ marginTop: 6 }} value={partner.rate} onChange={(e) => setPartner({ ...partner, rate: e.target.value })} placeholder={t('Interés anual que se le reconoce (%) — opcional')} />
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('No sale de ningún banco de Nexpro: el abono queda registrado y se crea automáticamente la deuda con quien pagó (un préstamo a su nombre por el mismo monto), que aparece en Préstamos para pagársela después.')}</div>
              </div>
            )}
          <div className="field"><label>{t('Fecha')}</label><input type="date" value={f.date} onChange={set('date')} /></div>
          {mode === 'total' ? (
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>{t('Monto total pagado')}</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input inputMode="decimal" placeholder="0.00" value={f.total} onChange={set('total')} style={{ maxWidth: 260 }} />
                {owed > 0 && <button type="button" className="link-btn" onClick={() => setF({ ...f, total: owed.toFixed(2) })}>{t('Pagar todo')} ({fmt$(owed)})</button>}
              </div>
              {total > 0 && (
                <div className="loan-pay-split">
                  <div><span>{t('Aplicado a intereses')}</span><strong>{fmt$(toInterest)}</strong></div>
                  <div><span>{t('Aplicado a capital')}</span><strong>{fmt$(toCapital)}</strong></div>
                  <div><span>{t('Saldo de capital después')}</span><strong>{fmt$(Math.max(0, balance - toCapital))}</strong></div>
                  <div><span>{t('Intereses pendientes después')}</span><strong>{fmt$(Math.max(0, due - toInterest))}</strong></div>
                </div>
              )}
              {over && <div className="error-banner" style={{ marginTop: 6, marginBottom: 0 }}>{t('El pago es mayor que el total adeudado')} ({fmt$(owed)}).</div>}
            </div>
          ) : (
            <>
              <div className="field"><label>{t('Abono a capital')}</label><input inputMode="decimal" placeholder="0.00" value={f.amount} onChange={set('amount')} /></div>
              <div className="field"><label>{t('Intereses (opcional)')}</label><input inputMode="decimal" placeholder="0.00" value={f.interest} onChange={set('interest')} />
                {acc && hasRate && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    <span className="muted">{t('Pendientes al')} {acc.interest_as_of}: </span><strong>{fmt$(acc.interest_due)}</strong>{' '}
                    <span className="muted">({acc.interest_days} {t('días')}, {loan.interest_rate}% / {acc.day_basis || 365})</span>{' '}
                    {acc.interest_due > 0 && <button type="button" className="link-btn" onClick={() => setF({ ...f, interest: acc.interest_due.toFixed(2) })}>{t('Usar este valor')}</button>}
                  </div>
                )}
                {hasRate ? null : <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('El préstamo no tiene tasa de interés; si cobra intereses, ponle la tasa en el préstamo.')}</div>}
              </div>
            </>
          )}
          <div className="field"><label>{t('Referencia')}</label><input value={f.reference} onChange={set('reference')} /></div>
        </div>
        <Footer error={error} saving={saving} disabled={over} onClose={onClose} label={t('Registrar abono')} />
      </form>
    </Modal>
  );
}

export function AccountModal({ initial, accounts = [], onDone, onClose, onDeleted }) {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const others = accounts.filter((a) => initial && a.id !== initial.id);
  const [del, setDel] = useState({ open: false, moveTo: '', busy: false, error: '' });
  async function removeAccount() {
    if (!window.confirm(t('¿Borrar esta cuenta? Esta acción no se puede deshacer.'))) return;
    setDel({ ...del, busy: true, error: '' });
    try {
      const r = await api.del(`/bank/accounts/${initial.id}${del.moveTo ? `?moveTo=${del.moveTo}` : ''}`);
      (onDeleted || onDone)(r);
    } catch (err) { setDel({ ...del, busy: false, error: err.message }); }
  }
  const [f, setF] = useState(initial ? {
    name: initial.name, bankName: initial.bank_name || '', accountType: initial.account_type, accountNumber: initial.account_number || '', routingNumber: initial.routing_number || '',
    openingBalance: String(initial.opening_balance ?? 0), openingDate: initial.opening_date || '', notes: initial.notes || '', isDefault: !!initial.is_default, active: initial.active !== 0,
  } : { name: '', bankName: '', accountType: 'corriente', accountNumber: '', routingNumber: '', openingBalance: '', openingDate: today(), notes: '', isDefault: false, active: true });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault(); setError(''); setSaving(true);
    const payload = { ...f, openingBalance: parse$(f.openingBalance) };
    try { if (initial) await api.put(`/bank/accounts/${initial.id}`, payload); else await api.post('/bank/accounts', payload); onDone(); }
    catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={initial ? t('Editar cuenta bancaria') : t('Nueva cuenta bancaria')} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="grid grid-2">
          <div className="field"><label>{t('Nombre de la cuenta *')}</label><input placeholder={t('Ej.: Chase Operativa')} value={f.name} onChange={set('name')} /></div>
          <div className="field"><label>{t('Banco')}</label><input placeholder="Chase, Bank of America…" value={f.bankName} onChange={set('bankName')} /></div>
          <div className="field"><label>{t('Tipo')}</label>
            <select value={f.accountType} onChange={set('accountType')}>{Object.entries(ACCOUNT_TYPES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></div>
          <div className="field"><label>{t('Número de cuenta')}</label><input className="mono" value={f.accountNumber} onChange={set('accountNumber')} /></div>
          <div className="field"><label>{t('Routing / ABA')}</label><input className="mono" value={f.routingNumber} onChange={set('routingNumber')} /></div>
          <div className="field"><label>{t('Saldo inicial')}</label><input inputMode="decimal" placeholder="0.00" value={f.openingBalance} onChange={set('openingBalance')} /></div>
          <div className="field"><label>{t('Fecha del saldo inicial')}</label><input type="date" value={f.openingDate} onChange={set('openingDate')} /></div>
        </div>
        <div className="hint" style={{ marginBottom: 8 }}>{t('El saldo inicial es lo que tenía la cuenta en esa fecha según el extracto del banco; desde ahí el ERP suma y resta los movimientos.')}</div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} /> {t('Cuenta principal (se propone en todos los pagos)')}</label>
        {initial && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginTop: 4 }}><input type="checkbox" style={{ width: 'auto' }} checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {t('Activa')}</label>}
        <div className="field" style={{ marginTop: 8 }}><label>{t('Notas')}</label><input value={f.notes} onChange={set('notes')} /></div>
        {initial && isAdmin && (
          <div className="danger-zone">
            {!del.open ? (
              <button type="button" className="link-btn danger" onClick={() => setDel({ ...del, open: true })}>🗑 {t('Borrar esta cuenta')}</button>
            ) : (
              <>
                <strong>{t('Borrar esta cuenta')}</strong>
                <p className="hint" style={{ margin: '4px 0 8px' }}>{t('Si la cuenta tiene movimientos (cobros, pagos, préstamos, nómina), elige a qué cuenta pasarlos. Si no tiene, se borra directamente.')}</p>
                {others.length > 0 ? (
                  <div className="field"><label>{t('Pasar sus movimientos a')}</label>
                    <select value={del.moveTo} onChange={(e) => setDel({ ...del, moveTo: e.target.value })}>
                      <option value="">{t('— No tiene movimientos —')}</option>
                      {others.map((a) => <option key={a.id} value={a.id}>{a.name}{a.account_masked ? ` ${a.account_masked}` : ''}</option>)}
                    </select></div>
                ) : <p className="hint">{t('Es tu única cuenta: si tiene movimientos, primero crea la cuenta correcta del banco o simplemente cámbiale el nombre aquí arriba.')}</p>}
                {del.error && <div className="error-banner" style={{ margin: '6px 0' }}>{del.error}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn" onClick={() => setDel({ open: false, moveTo: '', busy: false, error: '' })}>{t('Cancelar')}</button>
                  <button type="button" className="btn btn-danger" disabled={del.busy} onClick={removeAccount}>{del.busy ? t('Borrando…') : t('Borrar cuenta')}</button>
                </div>
              </>
            )}
          </div>
        )}
        <Footer error={error} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

// Editar un movimiento de un préstamo (desembolso o abono): cuenta, fecha, monto y referencia.
// Solo el administrador. Para un pago hecho directamente por un socio, se elige la cuenta
// "Pagos directos de socios (sin banco)".
export function LoanTxEditModal({ accounts, tx, loan, onDone, onClose }) {
  const { t } = useI18n();
  const [list, setList] = useState(accounts);
  useEffect(() => { if (!accounts.some((a) => a.is_direct)) api.get('/bank/direct-account').then((d) => setList([...accounts, d])).catch(() => {}); }, [accounts]);
  const [f, setF] = useState({ accountId: String(tx.account_id), date: String(tx.tx_date).slice(0, 10), amount: String(tx.amount), reference: tx.reference || '', description: tx.description || '' });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isIn = tx.direction === 'in';
  async function save(e) {
    e.preventDefault(); setError('');
    if (!(parse$(f.amount) > 0)) { setError(t('Escribe el monto.')); return; }
    setSaving(true);
    const fd = new FormData();
    Object.entries({ accountId: f.accountId, date: f.date, amount: parse$(f.amount), reference: f.reference, description: f.description, direction: tx.direction, category: tx.category, payee: tx.payee || '' })
      .forEach(([k, v]) => fd.append(k, String(v ?? '')));
    try { await api.putForm(`/bank/transactions/${tx.id}`, fd); onDone(); } catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={`${t('Editar movimiento')} · ${t(CATEGORY_LABELS[tx.category] || tx.category)} · ${loan.number}`} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="grid grid-2">
          <div className="field"><label>{isIn ? t('Cuenta donde entró el dinero') : t('Cuenta de donde salió el pago')}</label>
            <select value={f.accountId} onChange={set('accountId')}>
              {list.filter((a) => a.active !== 0 || String(a.id) === f.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}{a.account_masked ? ` ${a.account_masked}` : ''}</option>)}
            </select>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('Si lo pagó o lo puso un socio o un tercero directamente (sin pasar por el banco), elige "Pagos directos de socios o terceros (sin banco)".')}</div>
          </div>
          <div className="field"><label>{t('Fecha')}</label><input type="date" value={f.date} onChange={set('date')} /></div>
          <div className="field"><label>{t('Monto')}</label><input inputMode="decimal" value={f.amount} onChange={set('amount')} />
            {isIn && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('Es el desembolso: cambiar el monto o la fecha cambia el monto y la fecha del préstamo.')}</div>}</div>
          <div className="field"><label>{t('Referencia')}</label><input value={f.reference} onChange={set('reference')} /></div>
        </div>
        <div className="field"><label>{t('Descripción')}</label><input value={f.description} onChange={set('description')} /></div>
        <Footer error={error} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}

export function LoanTermsModal({ loan, onDone, onClose }) {
  const { t } = useI18n();
  const [f, setF] = useState({ lenderName: loan.lender_name, lenderType: loan.lender_type, loanDate: loan.loan_date || '', interestRate: loan.interest_rate ?? '', dayBasis: String(loan.day_basis || 365), dueDate: loan.due_date || '', notes: loan.notes || '' });
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function save(e) {
    e.preventDefault(); setError(''); setSaving(true);
    try { await api.put(`/bank/loans/${loan.id}`, f); onDone(); } catch (err) { setError(err.message); setSaving(false); }
  }
  return (
    <Modal title={`${t('Condiciones del préstamo')} ${loan.number}`} onClose={onClose}>
      <form onSubmit={save} noValidate>
        <div className="grid grid-2">
          <div className="field"><label>{t('Quién prestó *')}</label><input value={f.lenderName} onChange={set('lenderName')} /></div>
          <div className="field"><label>{t('Tipo')}</label>
            <select value={f.lenderType} onChange={set('lenderType')}><option value="socio">{t('Socio')}</option><option value="tercero">{t('Tercero')}</option><option value="banco">{t('Banco / entidad')}</option></select></div>
          <div className="field"><label>{t('Fecha del préstamo (desde cuándo corren los intereses)')}</label><input type="date" value={f.loanDate} onChange={set('loanDate')} /></div>
          <div className="field"><label>{t('Interés anual (%)')}</label><input inputMode="decimal" value={f.interestRate} onChange={set('interestRate')} /></div>
          <div className="field"><label>{t('Cálculo de intereses por días')}</label>
            <select value={f.dayBasis} onChange={set('dayBasis')}><option value="365">{t('Año de 365 días (días reales)')}</option><option value="360">{t('Año comercial de 360 días')}</option></select></div>
          <div className="field"><label>{t('Fecha de vencimiento')}</label><input type="date" value={f.dueDate} onChange={set('dueDate')} /></div>
        </div>
        <div className="field"><label>{t('Condiciones / notas')}</label><textarea rows={2} value={f.notes} onChange={set('notes')} /></div>
        <Footer error={error} saving={saving} onClose={onClose} />
      </form>
    </Modal>
  );
}
