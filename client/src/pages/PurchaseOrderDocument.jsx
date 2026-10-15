import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { useI18n } from '../i18n.jsx';

// Documento imprimible de la orden de compra: lo que se guarda como PDF o se imprime para
// enviarle al proveedor (por correo o a mano) cuando se hace un pedido. Solo se puede
// imprimir/guardar desde aquí -no hay botón de "enviar"-, igual que el resto de los
// documentos del ERP (factura, pedido, recepción de vehículo).
export default function PurchaseOrderDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const [po, setPo] = useState(null);

  useEffect(() => { api.get(`/purchase-orders/${id}`).then(setPo).catch(console.error); }, [id]);

  if (!po) return <div className="content">{t('Cargando…')}</div>;

  const total = po.items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_cost), 0);

  return (
    <>
      <div className="topbar no-print">
        <div><h1>{t('Orden de Compra')} {po.number}</h1><div className="sub"><Pill value={po.status} /></div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/compras" className="btn">{t('← Volver')}</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('ORDEN DE COMPRA')}</h2>
              <div><strong>No.</strong> {po.number}</div>
              <div><strong>{t('Fecha:')}</strong> {po.order_date || po.created_at}</div>
              <div><strong>{t('Estado:')}</strong> <Pill value={po.status} /></div>
            </div>
          </div>

          <div className="invoice-bill-to">
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t('Proveedor')}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{po.supplier_name}</div>
            {po.supplier_address && (
              <div className="muted">{po.supplier_address} {po.supplier_city || ''} {po.supplier_zip || ''}</div>
            )}
            {po.supplier_tax_id && <div className="muted">{t('NIT/ID:')} {po.supplier_tax_id}</div>}
            {(po.supplier_email || po.supplier_phone) && (
              <div className="muted">{po.supplier_email} {po.supplier_phone}</div>
            )}
          </div>

          <table style={{ marginTop: 20 }}>
            <thead><tr><th>{t('Descripción')}</th><th className="text-right">{t('Cant.')}</th><th className="text-right">{t('Costo unit.')}</th><th className="text-right">{t('Subtotal')}</th></tr></thead>
            <tbody>
              {po.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.description}</td>
                  <td className="text-right">{it.quantity}</td>
                  <td className="text-right">${Number(it.unit_cost).toLocaleString()}</td>
                  <td className="text-right">${(it.quantity * it.unit_cost).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoice-totals">
            <div className="invoice-total-grand"><span>{t('Total')}</span><span>${total.toLocaleString()}</span></div>
          </div>

          {po.notes && <div style={{ marginTop: 20 }}><strong>{t('Notas:')}</strong> {po.notes}</div>}
        </div>
      </div>
    </>
  );
}
