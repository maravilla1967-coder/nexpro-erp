import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { useI18n } from '../i18n.jsx';

const fmt$ = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const q = (n) => Number(Number(n || 0).toFixed(3));

// Acta de recepción de mercancía: cuadra lo ordenado contra lo recibido, línea por línea.
// /compras/:id/recepcion → todas las recepciones de la orden; ?gr=ID → una recepción en particular
// (muestra lo recibido en ese documento, lo recibido antes y lo que queda pendiente).
export default function GoodsReceiptDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const grId = Number(params.get('gr')) || null;
  const [po, setPo] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { api.get(`/purchase-orders/${id}`).then(setPo).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div className="content"><div className="error-banner">{err}</div></div>;
  if (!po) return <div className="content">{t('Cargando…')}</div>;

  const receipts = po.receipts || [];
  const gr = grId ? receipts.find((r) => r.id === grId) : null;
  const shown = gr ? [gr] : receipts;
  // Cantidad por línea: en esta recepción, en recepciones anteriores, y total con documento.
  const qtyIn = (list, itemId) => list.reduce((s, r) => s + r.items.filter((i) => i.purchase_order_item_id === itemId).reduce((a, i) => a + Number(i.quantity), 0), 0);
  const before = gr ? receipts.filter((r) => r.id < gr.id) : [];
  const serialsOf = (list, itemId) => list.flatMap((r) => r.items.filter((i) => i.purchase_order_item_id === itemId).flatMap((i) => (i.serials || []).map((s) => s.serial)));

  const rows = po.items.map((it) => {
    const ordered = Number(it.quantity);
    const received = Number(it.received_qty || 0);
    const short = Number(it.short_qty || 0);
    const pending = Math.max(0, ordered - received - short);
    const thisDoc = gr ? qtyIn([gr], it.id) : received;
    const prev = gr ? qtyIn(before, it.id) : 0;
    const status = received >= ordered - 0.0001 ? 'completo' : short > 0 && pending <= 0.0001 ? 'faltante' : received > 0 ? 'parcial' : 'pendiente';
    return { it, ordered, received, short, pending, thisDoc, prev, status, serials: serialsOf(gr ? [gr] : receipts, it.id) };
  });
  const visible = gr ? rows.filter((r) => r.thisDoc > 0) : rows;
  const tot = (f) => visible.reduce((s, r) => s + f(r), 0);
  const squared = rows.every((r) => r.pending <= 0.0001);
  const totalShort = rows.reduce((s, r) => s + r.short * Number(r.it.unit_cost), 0);
  const undocumented = (po.summary && po.summary.undocumented_qty) || 0;
  const label = { completo: t('Completo'), parcial: t('Parcial'), pendiente: t('Pendiente'), faltante: t('Faltante') };
  const color = { completo: 'var(--green, #15803d)', parcial: 'var(--orange-dark, #c2410c)', pendiente: 'var(--muted, #64748b)', faltante: 'var(--red, #b91c1c)' };

  return (
    <>
      <div className="topbar no-print">
        <div><h1>{t('Recepción de mercancía')} · {t('OC')} {po.number}</h1><div className="sub"><Pill value={po.status} /></div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {receipts.length > 1 && (
            <select value={grId || ''} onChange={(e) => navigate(e.target.value ? `?gr=${e.target.value}` : '?', { replace: true })}>
              <option value="">{t('Todas las recepciones')}</option>
              {receipts.map((r) => <option key={r.id} value={r.id}>{r.number} · {r.receipt_date}</option>)}
            </select>
          )}
          <Link to={`/compras?ver=${po.id}`} className="btn">{t('← Volver')}</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content">
        {undocumented > 0 && (
          <div className="error-banner no-print" style={{ background: '#fff7ed', color: '#9a3412' }}>
            {t('Hay mercancía marcada como recibida sin documento de recepción. Desde la orden de compra usa "Generar acta de recepción".')}
          </div>
        )}
        <div className="card invoice-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('RECEPCIÓN DE MERCANCÍA')}</h2>
              <div><strong>{gr ? 'No.' : t('Recepciones:')}</strong> {gr ? gr.number : (receipts.map((r) => r.number).join(', ') || '—')}</div>
              <div><strong>{t('Fecha:')}</strong> {gr ? gr.receipt_date : (receipts.length ? `${receipts[0].receipt_date}${receipts.length > 1 ? ` → ${receipts[receipts.length - 1].receipt_date}` : ''}` : '—')}</div>
              <div><strong>{t('Orden de compra:')}</strong> {po.number} · {po.order_date || ''}</div>
              <div><strong>{t('Cuadre:')}</strong> <span style={{ fontWeight: 700, color: squared ? color.completo : color.parcial }}>{squared ? `✓ ${t('Orden cuadrada')}` : `⚠ ${t('Con pendientes')}`}</span></div>
            </div>
          </div>

          <div className="invoice-bill-to">
            <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t('Proveedor')}</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{po.supplier_name}</div>
            {po.supplier_address && <div className="muted">{po.supplier_address} {po.supplier_city || ''} {po.supplier_zip || ''}</div>}
            {(po.supplier_email || po.supplier_phone) && <div className="muted">{po.supplier_email} {po.supplier_phone}</div>}
          </div>

          <table style={{ marginTop: 20, fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 260 }}>{t('Artículo')}</th>
                <th className="text-right">{t('Ordenado')}</th>
                {gr && <th className="text-right">{t('Recibido antes')}</th>}
                <th className="text-right">{gr ? t('Recibido aquí') : t('Recibido')}</th>
                <th className="text-right">{t('Faltante')}</th>
                <th className="text-right">{t('Pendiente')}</th>
                <th className="text-right">{t('Costo unit.')}</th>
                <th className="text-right">{t('Valor recibido')}</th>
                <th>{t('Estado')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.it.id} style={{ breakInside: 'avoid' }}>
                  <td>
                    <div>{r.it.description}</div>
                    {r.serials.length > 0 && <div className="mono" style={{ fontSize: 12, marginTop: 2 }}>S/N: {r.serials.join(', ')}</div>}
                    {r.it.product_sku && <div className="muted" style={{ fontSize: 11 }}>{t('Inventario:')} {r.it.product_sku} · {t('existencia')} {q(r.it.stock_qty)}</div>}
                  </td>
                  <td className="text-right">{q(r.ordered)}</td>
                  {gr && <td className="text-right muted">{q(r.prev)}</td>}
                  <td className="text-right"><strong>{q(r.thisDoc)}</strong></td>
                  <td className="text-right" style={{ color: r.short > 0 ? color.faltante : undefined }}>{r.short > 0 ? q(r.short) : '—'}</td>
                  <td className="text-right" style={{ color: r.pending > 0 ? color.parcial : undefined }}>{r.pending > 0 ? q(r.pending) : '—'}</td>
                  <td className="text-right">{fmt$(r.it.unit_cost)}</td>
                  <td className="text-right">{fmt$(r.thisDoc * r.it.unit_cost)}</td>
                  <td style={{ color: color[r.status], fontWeight: 600, whiteSpace: 'nowrap' }}>{label[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="invoice-totals">
            <div><span>{t('Valor ordenado')}</span><span>{fmt$(gr ? tot((r) => r.ordered * r.it.unit_cost) : po.summary.ordered)}</span></div>
            <div><span>{gr ? t('Valor recibido en esta recepción') : t('Valor recibido')}</span><span>{fmt$(tot((r) => r.thisDoc * r.it.unit_cost))}</span></div>
            {totalShort > 0 && <div><span>{t('Faltante (no llegará)')}</span><span style={{ color: color.faltante }}>{fmt$(totalShort)}</span></div>}
            <div className="invoice-total-grand"><span>{t('Pendiente por recibir')}</span><span>{fmt$(po.summary.pending)}</span></div>
          </div>

          {shown.some((r) => r.notes) || po.short_note ? (
            <div style={{ marginTop: 16, border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', breakInside: 'avoid', fontSize: 13 }}>
              {shown.filter((r) => r.notes).map((r) => <div key={r.id}><strong>{r.number}:</strong> {r.notes}</div>)}
              {po.short_note && <div style={{ whiteSpace: 'pre-wrap' }}><strong style={{ color: color.faltante }}>{t('Faltante:')}</strong> {po.short_note}</div>}
            </div>
          ) : null}

          {!gr && receipts.length > 0 && (
            <div style={{ marginTop: 16, fontSize: 12 }} className="muted">
              {receipts.map((r) => <div key={r.id}>{r.number} · {r.receipt_date}{r.created_by_name ? ` · ${t('recibió')} ${r.created_by_name}` : ''}{r.bill ? ` · ${t('factura')} ${r.bill.bill_number || `#${r.bill.id}`}` : ''}</div>)}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 48, breakInside: 'avoid' }}>
            <div style={{ borderTop: '1px solid #333', paddingTop: 6, fontSize: 12 }}>{t('Recibió (nombre y firma)')}</div>
            <div style={{ borderTop: '1px solid #333', paddingTop: 6, fontSize: 12 }}>{t('Revisó / Aprobó')}</div>
          </div>
        </div>
      </div>
    </>
  );
}
