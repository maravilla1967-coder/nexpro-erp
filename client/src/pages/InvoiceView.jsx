import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import DocumentBrand from '../components/DocumentBrand.jsx';
import PaymentModal, { money, methodLabel, uploadPaymentFiles, PaymentFiles } from '../components/PaymentModal.jsx';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';

// Datos de la cuenta de Nexpro para recibir transferencias (ACH/wire). Es información fija
// de la empresa (no cambia por factura), así que se incluye en el código, igual que la
// dirección y el teléfono que ya aparecen en el encabezado de cada documento.
const WIRE_INFO = {
  bank: 'Truist Bank',
  accountName: 'Truist Dynamic Bus Checking',
  accountNumber: '1100035806448',
  routingNumber: '263191387',
  beneficiary: 'Nexpro Trucks & Equipment Corp.',
  bankAddress: '201 Alhambra Cir., 1st Fl., Coral Gables, FL 33134',
};

export default function InvoiceView() {
  const { t } = useI18n();
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [savingWireInfo, setSavingWireInfo] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editingPay, setEditingPay] = useState(null);
  async function updatePayment(payload, files) {
    const updated = await api.put(`/invoices/${id}/payments/${editingPay.id}`, payload);
    const withFiles = await uploadPaymentFiles(`/invoices/${id}`, editingPay.id, files);
    setInvoice(withFiles || updated); setEditingPay(null);
  }
  const [serials, setSerials] = useState([]);
  const [available, setAvailable] = useState([]);
  const [pickSerial, setPickSerial] = useState('');
  function loadSerials(inv) {
    api.get('/serials', { invoiceId: id }).then(setSerials).catch(() => {});
    const pids = [...new Set((inv.items || []).map((i) => i.product_id).filter(Boolean))];
    if (pids.length) api.get('/serials', { productIds: pids.join(','), status: 'disponible' }).then(setAvailable).catch(() => {});
    else setAvailable([]);
  }
  async function attachSerial() {
    if (!pickSerial) return;
    try { await api.post(`/serials/${pickSerial}/status`, { status: 'vendido', invoiceId: id }); setPickSerial(''); loadSerials(invoice); }
    catch (err) { alert(err.message); }
  }
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  async function deleteInvoice() {
    const extra = invoice.paid > 0 ? `\n\n${t('Tiene pagos registrados por')} ${money(invoice.paid)}; ${t('también se borrarán.')}` : '';
    if (!window.confirm(`${t('¿Eliminar la factura')} ${invoice.number}?${extra}\n\n${t('Esto no se puede deshacer.')}`)) return;
    try {
      const r = await api.del(`/invoices/${id}`);
      if (r && r.pending) { alert(r.message); return; }
      navigate('/facturas');
    } catch (err) { alert(err.message); }
  }

  async function savePayment(payload, files) {
    const created = await api.post(`/invoices/${id}/payments`, payload);
    const withFiles = await uploadPaymentFiles(`/invoices/${id}`, created.newPaymentId, files);
    setInvoice(withFiles || created); setPayOpen(false);
  }
  async function addProof(pid, files) {
    try { const u = await uploadPaymentFiles(`/invoices/${id}`, pid, files); if (u) setInvoice(u); } catch (err) { alert(err.message); }
  }
  async function removeProof(pid, f) {
    if (!window.confirm(t('¿Eliminar este archivo adjunto?'))) return;
    setInvoice(await api.del(`/invoices/${id}/payments/${pid}/files/${f.id}`));
  }
  async function deletePayment(pid) {
    if (!window.confirm(t('¿Borrar este pago?'))) return;
    try { setInvoice(await api.del(`/invoices/${id}/payments/${pid}`)); } catch (err) { alert(err.message); }
  }

  useEffect(() => { api.get(`/invoices/${id}`).then((inv) => { setInvoice(inv); loadSerials(inv); }).catch(console.error); }, [id]);

  async function toggleWireInfo() {
    setSavingWireInfo(true);
    try {
      const result = await api.put(`/invoices/${id}`, { includeWireInfo: !invoice.include_wire_info });
      if (result && result.pending) {
        alert(result.message || t('Los cambios se enviaron para autorización del administrador.'));
      } else {
        setInvoice(result);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingWireInfo(false);
    }
  }

  // Si después de facturar se agrega un servicio o una parte nueva en alguna de las
  // órdenes de trabajo que originaron esta factura (por ejemplo, el mecánico suma una
  // reparación que apareció después), esto trae esas líneas nuevas a la factura sin tocar
  // ni borrar ninguna línea que ya estaba.
  async function syncWorkOrders() {
    setSyncing(true);
    try {
      const result = await api.post(`/invoices/${id}/sync-work-orders`, {});
      if (result && result.pending) {
        alert(result.message || t('Los cambios se enviaron para autorización del administrador.'));
      } else if (result && result.added === 0) {
        alert(t('La factura ya tiene todas las líneas de sus órdenes de trabajo: no hay nada nuevo que agregar.'));
      } else if (result && result.invoice) {
        setInvoice(result.invoice);
        alert(t('Se agregaron {n} línea(s) nueva(s) a la factura.').replace('{n}', result.added));
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncing(false);
    }
  }

  if (!invoice) return <div className="content">{t('Cargando…')}</div>;

  return (
    <>
      <div className="topbar no-print">
        <div>
          <h1>{t('Factura')} {invoice.number}</h1>
          <div className="sub">
            <Pill value={invoice.status} />
            {invoice.workOrders && invoice.workOrders.length > 0 && (
              <>
                {' · '}
                {t('Generada desde')}{' '}
                {invoice.workOrders.map((wo, i) => (
                  <React.Fragment key={wo.id}>
                    {i > 0 && ', '}
                    <Link to={`/ordenes-trabajo/${wo.id}/documento`}>{wo.number}</Link>
                  </React.Fragment>
                ))}
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/facturas" className="btn">{t('← Volver')}</Link>
          <button type="button" className="btn btn-danger" onClick={deleteInvoice}>{t('Eliminar factura')}</button>
          {invoice.workOrders && invoice.workOrders.length > 0 && (
            <button type="button" className="btn" disabled={syncing} onClick={syncWorkOrders}>
              {syncing ? t('Sincronizando…') : t('Agregar líneas nuevas de la orden de trabajo')}
            </button>
          )}
          <button type="button" className="btn" disabled={savingWireInfo} onClick={toggleWireInfo}>
            {invoice.include_wire_info ? t('Quitar datos de transferencia') : t('+ Agregar datos de transferencia')}
          </button>
          {invoice.balance > 0.004 && !['cancelado', 'anulada'].includes(invoice.status) && (
            <button type="button" className="btn" onClick={() => setPayOpen(true)}>{t('💵 Registrar pago')}</button>
          )}
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('FACTURA')}</h2>
              <div><strong>No.</strong> {invoice.number}</div>
              <div><strong>{t('Fecha:')}</strong> {invoice.issue_date}</div>
              {invoice.due_date && <div><strong>{t('Vence:')}</strong> {invoice.due_date}</div>}
            </div>
          </div>

          <div className="invoice-bill-to">
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t('Facturar a')}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{invoice.customer_name}</div>
            <div className="muted">{invoice.customer_address} {invoice.customer_city || ''} {invoice.customer_zip || ''}</div>
            <div className="muted">{invoice.customer_tax_id && `${t('NIT/ID:')} ${invoice.customer_tax_id}`}</div>
            <div className="muted">{invoice.customer_email} {invoice.customer_phone}</div>
          </div>

          <table style={{ marginTop: 20 }}>
            <thead><tr><th>{t('Descripción')}</th><th className="text-right">{t('Cant.')}</th><th className="text-right">{t('Precio unit.')}</th><th className="text-right">{t('Subtotal')}</th></tr></thead>
            <tbody>
              {invoice.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.description}</td>
                  <td className="text-right">{it.quantity}</td>
                  <td className="text-right">${Number(it.unit_price).toLocaleString()}</td>
                  <td className="text-right">${(it.quantity * it.unit_price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoice-totals">
            <div><span>{t('Subtotal')}</span><span>${Number(invoice.subtotal).toLocaleString()}</span></div>
            <div><span>{t('Impuesto')} ({invoice.tax_rate}%)</span><span>${Number(invoice.tax_amount).toLocaleString()}</span></div>
            <div className="invoice-total-grand"><span>{t('Total')}</span><span>${Number(invoice.total).toLocaleString()}</span></div>
            {invoice.paid > 0 && <div><span>{t('Pagado')}</span><span>−{money(invoice.paid)}</span></div>}
            {invoice.paid > 0 && <div className="invoice-total-grand"><span>{t('Saldo')}</span><span>{money(invoice.balance)}</span></div>}
          </div>

          {(serials.length > 0 || available.length > 0) && (
            <div className="doc-box" style={{ marginTop: 20 }}>
              <div className="doc-box-title">{t('Números de serie entregados')}</div>
              {serials.length === 0 ? <div className="muted no-print">{t('Todavía no se han asignado seriales a esta factura.')}</div> : (
                <div>{serials.map((sr) => <div key={sr.id}><span className="mono"><strong>{sr.serial}</strong></span> — {sr.product_name}{sr.vehicle_vin ? ` · VIN ${sr.vehicle_vin}` : ''}</div>)}</div>
              )}
              {available.length > 0 && (
                <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 8, maxWidth: 520 }}>
                  <select value={pickSerial} onChange={(e) => setPickSerial(e.target.value)}>
                    <option value="">{t('— Asignar un serial disponible —')}</option>
                    {available.map((sr) => <option key={sr.id} value={sr.id}>{sr.serial} · {sr.product_name}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm" disabled={!pickSerial} onClick={attachSerial}>{t('Asignar')}</button>
                </div>
              )}
            </div>
          )}

          {invoice.payments && invoice.payments.length > 0 && (
            <div className="doc-box" style={{ marginTop: 20 }}>
              <div className="doc-box-title">{t('Pagos recibidos')}</div>
              <table>
                <thead><tr><th>{t('Fecha')}</th><th>{t('Forma de pago')}</th><th>{t('Referencia')}</th><th className="text-right">{t('Monto')}</th><th className="no-print"></th></tr></thead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td>{p.payment_date}</td>
                      <td>{methodLabel(t, p.method)}</td>
                      <td>{p.reference || '—'}{p.notes ? <div className="muted" style={{ fontSize: 11 }}>{p.notes}</div> : null}
                        <PaymentFiles files={p.files} onRemove={isAdmin ? (f) => removeProof(p.id, f) : null} />
                        <label className="link-btn no-print" style={{ fontSize: 12, cursor: 'pointer' }}>
                          {t('+ comprobante')}<input type="file" multiple hidden onChange={(e) => { addProof(p.id, e.target.files); e.target.value = ''; }} />
                        </label>
                      </td>
                      <td className="text-right">{money(p.amount)}{p.surcharge > 0 && <div className="muted" style={{ fontSize: 11 }}>+ {money(p.surcharge)} {t('recargo')} = {money(Number(p.amount) + Number(p.surcharge))}</div>}</td>
                      <td className="no-print" style={{ whiteSpace: 'nowrap' }}>{isAdmin && <><button className="link-btn" onClick={() => setEditingPay(p)}>{t('Editar')}</button> <button className="link-btn" onClick={() => deletePayment(p.id)}>✕</button></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoice.include_wire_info ? (
            <div className="doc-box" style={{ marginTop: 20 }}>
              <div className="doc-box-title">REMITTANCE — NEXPRO TRUCKS &amp; EQUIPMENT CORP.</div>
              <div className="doc-grid">
                <div>
                  <div><strong>BANK:</strong> {WIRE_INFO.bank}</div>
                  <div><strong>ACCOUNT NAME:</strong> {WIRE_INFO.accountName}</div>
                  <div><strong>ACCOUNT NO.:</strong> {WIRE_INFO.accountNumber}</div>
                </div>
                <div>
                  <div><strong>ROUTING NO.:</strong> {WIRE_INFO.routingNumber}</div>
                  <div><strong>BENEFICIARY:</strong> {WIRE_INFO.beneficiary}</div>
                  <div><strong>BANK ADDRESS:</strong> {WIRE_INFO.bankAddress}</div>
                </div>
              </div>
            </div>
          ) : null}

          {invoice.notes && <div style={{ marginTop: 20 }}><strong>{t('Notas:')}</strong> {invoice.notes}</div>}
        </div>
      </div>
      {editingPay && (
        <PaymentModal showSurcharge title={`${t('Corregir pago')} · ${invoice.number}`} initial={editingPay} balance={invoice.balance} submitLabel={t('Guardar cambios')} onSave={updatePayment} onClose={() => setEditingPay(null)} />
      )}
      {payOpen && (
        <PaymentModal showSurcharge title={`${t('Registrar pago')} · ${invoice.number}`} balance={invoice.balance} onSave={savePayment} onClose={() => setPayOpen(false)} />
      )}
    </>
  );
}
