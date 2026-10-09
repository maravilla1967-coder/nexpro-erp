import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { useI18n } from '../i18n.jsx';

export default function SalesOrderDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const [so, setSo] = useState(null);

  useEffect(() => { api.get(`/sales-orders/${id}`).then(setSo).catch(console.error); }, [id]);

  if (!so) return <div className="content">{t('Cargando…')}</div>;

  const total = so.items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_price), 0);

  return (
    <>
      <div className="topbar no-print">
        <div><h1>{t('Pedido')} {so.number}</h1><div className="sub"><Pill value={so.status} /></div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/pedidos" className="btn">{t('← Volver')}</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('ORDEN DE PEDIDO')}</h2>
              <div><strong>No.</strong> {so.number}</div>
              <div><strong>{t('Fecha:')}</strong> {so.created_at}</div>
            </div>
          </div>

          <div className="invoice-bill-to">
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t('Cliente')}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{so.customer_name}</div>
            <div className="muted">{so.customer_address} {so.customer_city || ''} {so.customer_zip || ''}</div>
            <div className="muted">{so.customer_tax_id && `${t('NIT/ID:')} ${so.customer_tax_id}`}</div>
            <div className="muted">{so.customer_email} {so.customer_phone}</div>
          </div>

          <table style={{ marginTop: 20 }}>
            <thead><tr><th>{t('Descripción')}</th><th className="text-right">{t('Cant.')}</th><th className="text-right">{t('Precio unit.')}</th><th className="text-right">{t('Subtotal')}</th></tr></thead>
            <tbody>
              {so.items.map((it) => (
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
            <div className="invoice-total-grand"><span>{t('Total')}</span><span>${total.toLocaleString()}</span></div>
          </div>

          {so.notes && <div style={{ marginTop: 20 }}><strong>{t('Notas:')}</strong> {so.notes}</div>}

          <div className="signature-block">
            <div className="signature-box">
              <div className="signature-line"></div>
              <div className="muted">{t('Firma del cliente — Acepta el pedido')}</div>
            </div>
            <div className="signature-box">
              <div className="signature-line"></div>
              <div className="muted">{t('Fecha')}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
