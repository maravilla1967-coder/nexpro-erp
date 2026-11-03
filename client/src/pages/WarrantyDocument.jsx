import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { useI18n } from '../i18n.jsx';

// Documento imprimible de garantía (reclamo al fabricante o registro de garantía), con el
// mismo formato que la orden de compra, la factura y la recepción de vehículos.
export default function WarrantyDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const [w, setW] = useState(null);

  useEffect(() => { api.get(`/warranties/${id}`).then(setW).catch(console.error); }, [id]);
  if (!w) return <div className="content">{t('Cargando…')}</div>;

  const isClaim = w.kind === 'reclamo';
  const money = (v) => (v === null || v === undefined || v === '' ? '—' : `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const Row = ({ label, children, mono }) => (
    <div className="doc-row"><span className="muted">{label}</span><span className={mono ? 'mono' : ''}>{children || '—'}</span></div>
  );

  return (
    <>
      <div className="topbar no-print">
        <div><h1>{isClaim ? t('Reclamo de garantía') : t('Registro de garantía')} {w.number}</h1><div className="sub"><Pill value={w.status} /></div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/garantias" className="btn">{t('← Volver')}</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{isClaim ? t('RECLAMO DE GARANTÍA') : t('REGISTRO DE GARANTÍA')}</h2>
              <div><strong>No.</strong> {w.number}</div>
              <div><strong>{t('Fecha:')}</strong> {(isClaim ? w.claim_date : w.purchase_date) || (w.created_at || '').slice(0, 10)}</div>
              <div><strong>{t('Estado:')}</strong> <Pill value={w.status} /></div>
              {w.manufacturer_claim_number && <div><strong>{t('Reclamo fabricante:')}</strong> {w.manufacturer_claim_number}</div>}
            </div>
          </div>

          <div className="doc-grid">
            <div className="doc-box">
              <div className="doc-box-title">{isClaim ? t('Fabricante / Proveedor') : t('Proveedor')}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{w.supplier_name || w.manufacturer || '—'}</div>
              {w.supplier_address && <div className="muted">{w.supplier_address} {w.supplier_city || ''} {w.supplier_zip || ''}</div>}
              {(w.supplier_email || w.supplier_phone) && <div className="muted">{w.supplier_email} {w.supplier_phone}</div>}
              {w.purchase_order_number && <div className="muted">{t('Orden de compra:')} {w.purchase_order_number}</div>}
            </div>
            <div className="doc-box">
              <div className="doc-box-title">{t('Responsable Nexpro')}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{w.responsible_name || '—'}</div>
              {w.responsible_email && <div className="muted">{w.responsible_email}</div>}
              {w.customer_name && <div className="muted" style={{ marginTop: 6 }}>{t('Cliente:')} {w.customer_name}</div>}
            </div>
          </div>

          <div className="doc-box" style={{ marginTop: 14 }}>
            <div className="doc-box-title">{t('Equipo / vehículo')}</div>
            {w.item_description && <div style={{ fontWeight: 700, marginBottom: 6 }}>{w.item_description}</div>}
            <div className="doc-rows">
              <Row label={t('VIN')} mono>{w.vin}</Row>
              <Row label={t('No. de serie')} mono>{w.serial_number}</Row>
              <Row label={t('Fabricante')}>{w.manufacturer}</Row>
              <Row label={t('Modelo')}>{w.model}</Row>
              <Row label={t('Año')}>{w.year}</Row>
              <Row label={t('Fecha de compra')}>{w.purchase_date}</Row>
              <Row label={t('Garantía desde')}>{w.warranty_start}</Row>
              <Row label={t('Garantía hasta')}>{w.warranty_end}</Row>
            </div>
          </div>

          {isClaim && (
            <>
              <div className="doc-box" style={{ marginTop: 14 }}>
                <div className="doc-box-title">{t('Falla / problema reportado')}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{w.problem_description || <span className="muted">{t('Sin descripción.')}</span>}</div>
              </div>
              <div className="doc-grid" style={{ marginTop: 14 }}>
                <div className="doc-box">
                  <div className="doc-box-title">{t('Montos')}</div>
                  <div className="doc-rows">
                    <Row label={t('Monto reclamado')}>{money(w.claim_amount)}</Row>
                    <Row label={t('Monto aprobado')}>{money(w.approved_amount)}</Row>
                  </div>
                </div>
                <div className="doc-box">
                  <div className="doc-box-title">{t('Resolución del fabricante')}</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{w.resolution || <span className="muted">{t('Pendiente.')}</span>}</div>
                </div>
              </div>
            </>
          )}

          {w.attachments && w.attachments.length > 0 && (
            <div className="doc-box" style={{ marginTop: 14 }}>
              <div className="doc-box-title">{isClaim ? t('Documentos adjuntos') : t('Constancia de registro adjunta')}</div>
              {w.attachments.map((a) => <div key={a.id}>• {a.original_name || a.file_url.split('/').pop()}</div>)}
            </div>
          )}

          {w.notes && <div style={{ marginTop: 14 }}><strong>{t('Notas:')}</strong> {w.notes}</div>}

          <div className="signature-block">
            <div className="signature-box"><div className="signature-line" />{t('Firma responsable Nexpro')}</div>
            <div className="signature-box"><div className="signature-line" />{isClaim ? t('Firma / sello fabricante') : t('Fecha de registro')}</div>
          </div>
        </div>
      </div>
    </>
  );
}
