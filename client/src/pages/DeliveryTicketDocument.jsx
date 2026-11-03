import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { useI18n } from '../i18n.jsx';

// Boleta de entrega (Delivery Ticket) de una factura: lista todo lo facturado (sin precios),
// los seriales entregados y los vehículos, con firmas de quien entrega y quien recibe.
// Los datos de entrega (fecha, entregado por, recibido por, notas) se guardan en la factura;
// el número NX-DT-… se asigna la primera vez que se guarda la boleta.
export default function DeliveryTicketDocument() {
  const { t } = useI18n();
  const { id } = useParams();
  const [inv, setInv] = useState(null);
  const [serials, setSerials] = useState([]);
  const [form, setForm] = useState({ deliveryDate: '', deliveredBy: '', receivedBy: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function fill(i) {
    setInv(i);
    setForm({
      deliveryDate: i.delivery_date || new Date().toISOString().slice(0, 10),
      deliveredBy: i.delivery_delivered_by || '',
      receivedBy: i.delivery_received_by || '',
      notes: i.delivery_notes || '',
    });
  }
  useEffect(() => {
    api.get(`/invoices/${id}`).then(fill).catch((e) => setError(e.message));
    api.get('/serials', { invoiceId: id }).then(setSerials).catch(() => {});
  }, [id]);

  async function save() {
    setSaving(true); setError(''); setSaved(false);
    try { fill(await api.post(`/invoices/${id}/delivery`, form)); setSaved(true); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (error && !inv) return <div className="content"><div className="error-banner">{error}</div></div>;
  if (!inv) return <div className="content">{t('Cargando…')}</div>;

  const ticketNo = inv.delivery_number;
  const items = inv.items || [];
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const serialsFor = (it) => serials.filter((s) => it.product_id && String(s.product_id) === String(it.product_id));
  const looseSerials = serials.filter((s) => !items.some((it) => it.product_id && String(s.product_id) === String(it.product_id)));
  const veh = (v) => [v.year, v.make, v.model].filter(Boolean).join(' ');

  return (
    <>
      <div className="topbar no-print">
        <div>
          <h1>{t('Boleta de entrega')} {ticketNo || ''}</h1>
          <div className="sub">{t('Factura')} <Link to={`/facturas/${inv.id}`}>{inv.number}</Link> · {inv.customer_name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to={`/facturas/${inv.id}`} className="btn">{t('← Volver a la factura')}</Link>
          <button className="btn btn-primary" disabled={!ticketNo} title={!ticketNo ? t('Guarda la boleta primero para asignarle número') : ''} onClick={() => window.print()}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>

      <div className="content">
        <div className="card no-print" style={{ marginBottom: 14, padding: 14 }}>
          {error && <div className="error-banner">{error}</div>}
          <div className="grid" style={{ gridTemplateColumns: '160px 1fr 1fr', gap: 12 }}>
            <div className="field"><label>{t('Fecha de entrega')}</label><input type="date" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} /></div>
            <div className="field"><label>{t('Entregado por (Nexpro)')}</label><input value={form.deliveredBy} onChange={(e) => setForm({ ...form, deliveredBy: e.target.value })} /></div>
            <div className="field"><label>{t('Recibido por (cliente)')}</label><input value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} placeholder={t('Se puede dejar vacío y llenar a mano')} /></div>
          </div>
          <div className="field"><label>{t('Notas de entrega')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button className="btn btn-primary" disabled={saving} onClick={save}>{ticketNo ? t('Guardar cambios') : t('Crear boleta de entrega')}</button>
            {saved && <span className="muted">✓ {t('Guardado')}</span>}
            {!ticketNo && <span className="muted" style={{ fontSize: 12 }}>{t('Al crearla se le asigna el número')} {String(inv.number).startsWith('NX-INV-') ? inv.number.replace('NX-INV-', 'NX-DT-') : ''}</span>}
          </div>
        </div>

        <div className="card invoice-sheet">
          <div className="invoice-header">
            <DocumentBrand />
            <div className="invoice-meta">
              <h2>{t('BOLETA DE ENTREGA')}</h2>
              <div style={{ fontSize: 11, letterSpacing: '.06em' }} className="muted">DELIVERY TICKET</div>
              <div><strong>No.</strong> {ticketNo || '—'}</div>
              <div><strong>{t('Factura:')}</strong> {inv.number}</div>
              <div><strong>{t('Fecha:')}</strong> {form.deliveryDate}</div>
            </div>
          </div>

          <div className="doc-grid" style={{ marginTop: 6 }}>
            <div className="invoice-bill-to" style={{ marginTop: 0 }}>
              <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{t('Entregar a')}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{inv.customer_name}</div>
              <div className="muted">{inv.customer_address} {inv.customer_city || ''} {inv.customer_zip || ''}</div>
              <div className="muted">{inv.customer_email} {inv.customer_phone}</div>
            </div>
            {inv.vehicles && inv.vehicles.length > 0 && (
              <div className="invoice-bill-to" style={{ marginTop: 0 }}>
                <div className="muted" style={{ fontSize: 12, textTransform: 'uppercase' }}>{inv.vehicles.length > 1 ? t('Vehículos') : t('Vehículo')}</div>
                {inv.vehicles.map((v) => (
                  <div key={v.id}><strong className="mono">VIN {v.vin}</strong>{veh(v) ? ` · ${veh(v)}` : ''}{v.plate ? ` · ${t('Placa')} ${v.plate}` : ''}</div>
                ))}
              </div>
            )}
          </div>

          <table style={{ marginTop: 18 }}>
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th>{t('Artículo')}</th>
                <th>{t('Descripción')}</th>
                <th className="text-right" style={{ width: 70 }}>{t('Cant.')}</th>
                <th style={{ width: 90, textAlign: 'center' }}>{t('Recibido')} ✓</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const sn = serialsFor(it);
                return (
                  <tr key={it.id}>
                    <td className="muted">{i + 1}</td>
                    <td className="mono" style={{ fontSize: 12 }}>{it.product_item_number || it.product_sku || '—'}</td>
                    <td>
                      {it.description}
                      {sn.length > 0 && <div style={{ fontSize: 12, marginTop: 2 }}><strong>{t('Serial(es):')}</strong> <span className="mono">{sn.map((s) => s.serial).join(', ')}</span></div>}
                    </td>
                    <td className="text-right">{Number(it.quantity).toLocaleString()}{it.product_unit && it.product_unit !== 'unidad' ? ` ${it.product_unit}` : ''}</td>
                    <td style={{ textAlign: 'center' }}><span style={{ display: 'inline-block', width: 16, height: 16, border: '1.5px solid #334155', borderRadius: 3 }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-right muted" style={{ marginTop: 6, fontSize: 12 }}>{items.length} {t('línea(s)')} · {t('Total de unidades:')} {totalQty.toLocaleString()}</div>

          {looseSerials.length > 0 && (
            <div className="doc-box" style={{ marginTop: 14 }}>
              <div className="doc-box-title">{t('Otros números de serie entregados')}</div>
              {looseSerials.map((s) => <div key={s.id}><span className="mono"><strong>{s.serial}</strong></span> — {s.product_name}{s.vehicle_vin ? ` · VIN ${s.vehicle_vin}` : ''}</div>)}
            </div>
          )}

          {form.notes && <div style={{ marginTop: 14 }}><strong>{t('Notas:')}</strong> {form.notes}</div>}

          <div className="doc-box" style={{ marginTop: 16, fontSize: 12.5 }}>
            {t('El cliente declara haber recibido los artículos listados arriba completos y en buen estado, salvo lo anotado en esta boleta.')}
            <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>The customer acknowledges receipt of the items listed above, complete and in good condition, except as noted on this ticket.</div>
          </div>

          <div className="signature-block">
            <div className="signature-box">
              <div style={{ minHeight: 18, fontWeight: 600 }}>{form.deliveredBy}</div>
              <div className="signature-line"></div>
              <div className="muted">{t('Entregado por — Nexpro (nombre y firma)')}</div>
            </div>
            <div className="signature-box">
              <div style={{ minHeight: 18, fontWeight: 600 }}>{form.receivedBy}</div>
              <div className="signature-line"></div>
              <div className="muted">{t('Recibido por — Cliente (nombre y firma)')}</div>
            </div>
            <div className="signature-box" style={{ flex: 0.6 }}>
              <div style={{ minHeight: 18 }}></div>
              <div className="signature-line"></div>
              <div className="muted">{t('Fecha / hora')}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
