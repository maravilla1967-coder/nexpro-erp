import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import { money } from '../components/PaymentModal.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';

// Números de serie: dónde está cada unidad, de qué compra vino y a quién se vendió o en qué
// camión quedó instalada.
const STATUSES = ['disponible', 'vendido', 'instalado', 'dado_de_baja'];
const EVENT_LABEL = { recibido: 'Recibido', alta_manual: 'Alta manual', vendido: 'Vendido', instalado: 'Instalado', dado_de_baja: 'Dado de baja', disponible: 'Devuelto a disponible' };

const S_COLUMNS = [
  { label: 'Serial', value: (r) => r.serial, mono: true },
  { label: 'Producto', value: (r) => r.product_name },
  { label: 'SKU', value: (r) => r.product_sku },
  { label: 'Estado', value: (r) => r.status },
  { label: 'Proveedor', value: (r) => r.supplier_name },
  { label: 'Orden de compra', value: (r) => r.purchase_order_number },
  { label: 'Recibido', value: (r) => r.received_date },
  { label: 'Costo', value: (r) => r.unit_cost, type: 'money', noTotal: false },
  { label: 'Factura', value: (r) => r.invoice_number },
  { label: 'Cliente', value: (r) => r.customer_name },
  { label: 'VIN instalado', value: (r) => r.vehicle_vin },
];
const sDate = (r) => r.received_date;

export default function SerialsPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [productId, setProductId] = useState(params.get('producto') || '');
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [action, setAction] = useState(null); // { status, invoiceId, vehicleId, notes }
  const [adding, setAdding] = useState(null);
  const [error, setError] = useState('');

  function load() { api.get('/serials', { q, status, productId }).then(setList).catch(console.error); }
  useEffect(load, [q, status, productId]);
  useEffect(() => {
    api.get('/products').then(setProducts).catch(() => {});
    api.get('/invoices').then(setInvoices).catch(() => {});
    api.get('/vehicles').then(setVehicles).catch(() => {});
  }, []);

  const ex = useListExport({ rows: list, getDate: sDate });

  async function open(s) { setError(''); setAction(null); setViewing(await api.get(`/serials/${s.id}`)); }

  async function applyAction(e) {
    e.preventDefault(); setError('');
    try { setViewing(await api.post(`/serials/${viewing.id}/status`, action)); setAction(null); load(); }
    catch (err) { setError(err.message); }
  }

  async function saveNew(e) {
    e.preventDefault(); setError('');
    try {
      await api.post('/serials', { ...adding, serials: adding.text.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean) });
      setAdding(null); load();
    } catch (err) { setError(err.message); }
  }

  async function remove() {
    if (!window.confirm(t('¿Borrar este serial?'))) return;
    try { await api.del(`/serials/${viewing.id}`); setViewing(null); load(); } catch (err) { setError(err.message); }
  }

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Números de serie')}</h1><div className="sub">{t('Trazabilidad de cada unidad: compra, venta e instalación')}</div></div>
        <button className="btn btn-primary" onClick={() => { setError(''); setAdding({ productId: productId || '', text: '', notes: '', addToStock: false }); }}>{t('+ Agregar seriales')}</button>
      </div>
      <div className="content">
        <div className="toolbar">
          <input className="search-input" placeholder={t('Buscar serial, producto o SKU…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 220 }} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{t('Todos los productos')}</option>
            {products.filter((p) => p.track_serials).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t('Todos los estados')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(s.replace(/_/g, ' '))}</option>)}
          </select>
        </div>
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay números de serie. Activa "Maneja números de serie" en el producto y se capturan al recibir la orden de compra.')}</div> : (
            <>
              <ListExportBar ex={ex} title={t('Números de serie')} filename="seriales" columns={S_COLUMNS} />
              <table>
                <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Serial')}</th><th>{t('Producto')}</th><th>{t('Estado')}</th><th>{t('Origen')}</th><th>{t('Destino')}</th></tr></thead>
                <tbody>
                  {ex.visible.map((s) => (
                    <tr key={s.id} className="clickable" onClick={() => open(s)}>
                      <td onClick={(e) => e.stopPropagation()}><RowBox ex={ex} row={s} /></td>
                      <td className="mono"><strong>{s.serial}</strong></td>
                      <td>{s.product_name}{s.product_sku ? <div className="muted mono" style={{ fontSize: 12 }}>{s.product_sku}</div> : null}</td>
                      <td><Pill value={s.status} /></td>
                      <td className="muted">{s.supplier_name || '—'}{s.purchase_order_number ? ` · OC ${s.purchase_order_number}` : ''}{s.received_date ? <div style={{ fontSize: 12 }}>{s.received_date}</div> : null}</td>
                      <td className="muted">{s.customer_name || ''}{s.invoice_number ? ` · ${s.invoice_number}` : ''}{s.vehicle_vin ? <div className="mono" style={{ fontSize: 12 }}>VIN {s.vehicle_vin}</div> : null}{!s.customer_name && !s.vehicle_vin ? '—' : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {viewing && (
        <Modal title={`${t('Serial')} ${viewing.serial}`} onClose={() => setViewing(null)} wide>
          {error && <div className="error-banner">{error}</div>}
          <div className="doc-grid">
            <div className="doc-box">
              <div className="doc-box-title">{t('Unidad')}</div>
              <div style={{ fontWeight: 700 }}>{viewing.product_name}</div>
              <div className="muted">{viewing.product_sku}</div>
              <div style={{ marginTop: 6 }}><Pill value={viewing.status} /> {viewing.status_date ? <span className="muted">· {viewing.status_date}</span> : null}</div>
            </div>
            <div className="doc-box">
              <div className="doc-box-title">{t('Origen (compra)')}</div>
              <div>{viewing.supplier_name || '—'}</div>
              {viewing.purchase_order_id && <div><Link to={`/compras/${viewing.purchase_order_id}/documento`}>{t('OC')} {viewing.purchase_order_number}</Link>{viewing.goods_receipt_number ? ` · ${viewing.goods_receipt_number}` : ''}</div>}
              <div className="muted">{t('Recibido')} {viewing.received_date || '—'} · {t('Costo')} {viewing.unit_cost ? money(viewing.unit_cost) : '—'}</div>
            </div>
          </div>
          {(viewing.customer_name || viewing.vehicle_vin || viewing.invoice_number) && (
            <div className="doc-box" style={{ marginTop: 12 }}>
              <div className="doc-box-title">{t('Destino')}</div>
              {viewing.customer_name && <div>{t('Cliente:')} <strong>{viewing.customer_name}</strong></div>}
              {viewing.invoice_id && <div><Link to={`/facturas/${viewing.invoice_id}`}>{t('Factura')} {viewing.invoice_number}</Link></div>}
              {viewing.vehicle_id && <div><Link to={`/vehiculos/${viewing.vehicle_id}`}>VIN {viewing.vehicle_vin}</Link> · {[viewing.vehicle_make, viewing.vehicle_model, viewing.vehicle_year].filter(Boolean).join(' ')}</div>}
            </div>
          )}
          <div className="doc-box" style={{ marginTop: 12 }}>
            <div className="doc-box-title">{t('Historia')}</div>
            {viewing.events.map((e) => (
              <div key={e.id} style={{ fontSize: 13, marginBottom: 4 }}>
                <span className="muted">{String(e.created_at).slice(0, 16)}</span> · <strong>{t(EVENT_LABEL[e.event] || e.event)}</strong>{e.reference ? ` — ${e.reference}` : ''}{e.created_by_name ? ` · ${e.created_by_name}` : ''}{e.notes ? <div className="muted">{e.notes}</div> : null}
              </div>
            ))}
            {viewing.warranties && viewing.warranties.length > 0 && (
              <div style={{ marginTop: 6 }}>{t('Garantías:')} {viewing.warranties.map((w) => <Link key={w.id} to={`/garantias/${w.id}/documento`} style={{ marginRight: 8 }}>{w.number}</Link>)}</div>
            )}
          </div>

          {action ? (
            <form onSubmit={applyAction} className="doc-box" style={{ marginTop: 12 }}>
              <div className="doc-box-title">{t(EVENT_LABEL[action.status])}</div>
              {action.status === 'vendido' && (
                <div className="field"><label>{t('Factura')}</label>
                  <select required value={action.invoiceId || ''} onChange={(e) => setAction({ ...action, invoiceId: e.target.value })}>
                    <option value="">{t('— Seleccionar —')}</option>
                    {invoices.map((i) => <option key={i.id} value={i.id}>{i.number} · {i.customer_name}</option>)}
                  </select>
                </div>
              )}
              {(action.status === 'instalado' || action.status === 'vendido') && (
                <div className="field"><label>{action.status === 'instalado' ? t('Vehículo donde quedó instalado') : t('Vehículo (opcional)')}</label>
                  <select required={action.status === 'instalado'} value={action.vehicleId || ''} onChange={(e) => setAction({ ...action, vehicleId: e.target.value })}>
                    <option value="">{t('— Ninguno —')}</option>
                    {vehicles.map((v) => <option key={v.id} value={v.id}>{v.vin} · {[v.make, v.model, v.year].filter(Boolean).join(' ')}{v.customer_name ? ` · ${v.customer_name}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div className="field"><label>{t('Notas')}</label><input value={action.notes || ''} onChange={(e) => setAction({ ...action, notes: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn" onClick={() => setAction(null)}>{t('Cancelar')}</button>
                <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
              </div>
            </form>
          ) : (
            <div className="modal-footer">
              {viewing.status === 'disponible' && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={remove}>{t('Eliminar')}</button>}
              <Link className="btn" to={`/garantias?nuevo=reclamo&serial=${viewing.id}`}>{t('🛡️ Garantía')}</Link>
              {viewing.status !== 'vendido' && <button className="btn" onClick={() => setAction({ status: 'vendido' })}>{t('Vendido')}</button>}
              {viewing.status !== 'instalado' && <button className="btn" onClick={() => setAction({ status: 'instalado', vehicleId: viewing.vehicle_id || '' })}>{t('Instalado en vehículo')}</button>}
              {viewing.status !== 'dado_de_baja' && <button className="btn" onClick={() => setAction({ status: 'dado_de_baja' })}>{t('Dar de baja')}</button>}
              {viewing.status !== 'disponible' && <button className="btn" onClick={() => setAction({ status: 'disponible' })}>{t('Volver a disponible')}</button>}
            </div>
          )}
        </Modal>
      )}

      {adding && (
        <Modal title={t('Agregar números de serie')} onClose={() => setAdding(null)}>
          <form onSubmit={saveNew}>
            {error && <div className="error-banner">{error}</div>}
            <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>{t('Para unidades que ya estaban en inventario o llegaron sin orden de compra. Lo normal es capturarlos al recibir la OC.')}</div>
            <div className="field"><label>{t('Producto *')}</label>
              <select required value={adding.productId} onChange={(e) => setAdding({ ...adding, productId: e.target.value })}>
                <option value="">{t('— Seleccionar —')}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
              </select>
            </div>
            <div className="field"><label>{t('Números de serie (uno por línea)')}</label><textarea rows={5} className="mono" required value={adding.text} onChange={(e) => setAdding({ ...adding, text: e.target.value })} /></div>
            <div className="field"><label>{t('Notas')}</label><input value={adding.notes} onChange={(e) => setAdding({ ...adding, notes: e.target.value })} /></div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={adding.addToStock} onChange={(e) => setAdding({ ...adding, addToStock: e.target.checked })} />
              {t('Sumar estas unidades al stock (déjalo sin marcar si ya están contadas en el inventario)')}
            </label>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setAdding(null)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
