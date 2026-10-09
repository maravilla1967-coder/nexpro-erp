import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
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

  useEffect(() => { api.get(`/invoices/${id}`).then(setInvoice).catch(console.error); }, [id]);

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

  if (!invoice) return <div className="content">{t('Cargando…')}</div>;

  return (
    <>
      <div className="topbar no-print">
        <div><h1>{t('Factura')} {invoice.number}</h1><div className="sub"><Pill value={invoice.status} /></div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/facturas" className="btn">{t('← Volver')}</Link>
          <button type="button" className="btn" disabled={savingWireInfo} onClick={toggleWireInfo}>
            {invoice.include_wire_info ? t('Quitar datos de transferencia') : t('+ Agregar datos de transferencia')}
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <div className="invoice-brand">
              <img src="/nexpro-logo.png" alt="Nexpro Trucks & Equipment Corp." className="invoice-logo"
                   onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
              <div className="invoice-brand-fallback" style={{ display: 'none' }}>
                <strong>NEXPRO TRUCKS &amp; EQUIPMENT CORP.</strong>
              </div>
              <div className="muted" style={{ marginTop: 6 }}>7380 NW 77th CT, Miami, FL 33166</div>
            </div>
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
          </div>

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
    </>
  );
}
