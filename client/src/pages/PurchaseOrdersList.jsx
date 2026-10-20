import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import LineItemsEditor from '../components/LineItemsEditor.jsx';
import ReceiveModal from '../components/ReceiveModal.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
const poDate = (r) => r.order_date || r.created_at;
const poNumber = (r) => r.number;
const PO_COLUMNS = [
  { label: 'Número', value: (r) => r.number, mono: true },
  { label: 'Fecha', value: (r) => (r.order_date || r.created_at || '').slice(0, 10) },
  { label: 'Proveedor', value: (r) => r.supplier_name },
  { label: 'Descripción', value: (r) => r.items_summary },
  { label: 'Estado', value: (r) => r.status },
  { label: 'Total', value: (r) => r.total, type: 'money' },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function PurchaseOrdersList() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const ex = useListExport({ rows: list, getDate: poDate, getNumber: poNumber });
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPo, setEditingPo] = useState(null); // null = nueva orden; si no, se está editando esta orden existente
  const [viewing, setViewing] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(todayStr());
  const [items, setItems] = useState([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [uploadingDocs, setUploadingDocs] = useState(false);

  function load() { api.get('/purchase-orders').then(setList).catch(console.error); }
  useEffect(() => {
    load();
    api.get('/suppliers').then(setSuppliers);
    api.get('/products').then(setProducts);
  }, []);

  function openNew() {
    setEditingPo(null);
    setSupplierId(''); setOrderDate(todayStr()); setNotes('');
    setItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
    setError(''); setModalOpen(true);
  }

  async function openEdit(po) {
    const full = await api.get(`/purchase-orders/${po.id}`);
    setEditingPo(full);
    setSupplierId(full.supplier_id);
    setOrderDate(full.order_date || todayStr());
    setNotes(full.notes || '');
    setItems(
      full.items.length > 0
        ? full.items.map((it) => ({ productId: it.product_id || '', description: it.description, quantity: it.quantity, unitPrice: it.unit_cost }))
        : [{ productId: '', description: '', quantity: 1, unitPrice: 0 }]
    );
    setError(''); setModalOpen(true);
  }

  async function uploadPoDocs(fileList) {
    if (!editingPo || !fileList || fileList.length === 0) return;
    const fd = new FormData();
    Array.from(fileList).forEach((file) => fd.append('files', file));
    setUploadingDocs(true);
    try {
      const updated = await api.postForm(`/purchase-orders/${editingPo.id}/attachments`, fd);
      setEditingPo(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingDocs(false);
    }
  }

  async function deletePoDoc(attachmentId) {
    if (!editingPo || !window.confirm(t('¿Eliminar este archivo adjunto?'))) return;
    await api.del(`/purchase-orders/${editingPo.id}/attachments/${attachmentId}`);
    const updated = await api.get(`/purchase-orders/${editingPo.id}`);
    setEditingPo(updated);
  }

  const linesLocked = !!(editingPo && ['recibida', 'parcial', 'cerrada'].includes(editingPo.status));
  async function save(e) {
    e.preventDefault();
    const payload = {
      supplierId, orderDate, notes,
      items: linesLocked ? undefined : items.filter((i) => i.description).map((i) => ({ productId: i.productId || null, description: i.description, quantity: parseFloat(i.quantity) || 0, unitCost: parseFloat(i.unitPrice) || 0 })),
    };
    try {
      if (editingPo) {
        await api.put(`/purchase-orders/${editingPo.id}`, payload);
      } else {
        await api.post('/purchase-orders', payload);
      }
      setModalOpen(false); setEditingPo(null); load();
    } catch (err) { setError(err.message); }
  }

  const [receiving, setReceiving] = useState(null);
  async function openReceive(po) { setReceiving(await api.get(`/purchase-orders/${po.id}`)); }
  async function markStatus(po, status) {
    await api.put(`/purchase-orders/${po.id}`, { status });
    load();
    if (viewing && viewing.id === po.id) openView(po.id);
  }
  async function openView(id) {
    const po = await api.get(`/purchase-orders/${id}`);
    setViewing(po); setShortForm(null); setViewErr('');
  }
  const [shortForm, setShortForm] = useState(null);
  const [viewErr, setViewErr] = useState('');
  const fmt$ = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  async function doCloseShort() {
    try { await api.post(`/purchase-orders/${viewing.id}/close-short`, { note: shortForm }); await openView(viewing.id); load(); }
    catch (err) { setViewErr(err.message); }
  }
  async function doReopenShort() {
    try { await api.post(`/purchase-orders/${viewing.id}/reopen-short`, {}); await openView(viewing.id); load(); }
    catch (err) { setViewErr(err.message); }
  }

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Órdenes de Compra')}</h1><div className="sub">{t('Compras a proveedores')}</div></div>
        <button className="btn btn-primary" onClick={openNew}>{t('+ Nueva orden de compra')}</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay órdenes de compra todavía.')}</div> : (
            <><ListExportBar ex={ex} title={t('Órdenes de Compra')} filename="ordenes-de-compra" columns={PO_COLUMNS} />
            <table>
              <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Número')}</th><th>{t('Proveedor')}</th><th>{t('Estado')}</th><th>{t('Fecha')}</th><th style={{ textAlign: 'right' }}>{t('Total')}</th><th></th></tr></thead>
              <tbody>
                {ex.visible.map((po) => (
                  <tr key={po.id}>
                    <td><RowBox ex={ex} row={po} /></td>
                    <td className="mono clickable" onClick={() => openView(po.id)}>{po.number}</td>
                    <td>{po.supplier_name}</td>
                    <td><Pill value={po.status} /></td>
                    <td className="muted">{po.order_date || po.created_at}</td>
                    <td style={{ textAlign: 'right' }}>${Number(po.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ display: 'flex', gap: 10 }}>
                      <Link className="link-btn" to={`/compras/${po.id}/documento`}>{t('Imprimir')}</Link>
                      <Link className="link-btn" to={`/garantias?nuevo=registro&oc=${po.id}`}>{t('Garantía')}</Link>
                      {po.status !== 'cancelado' && <button className="link-btn" onClick={() => openEdit(po)}>{t('Editar')}</button>}
                      {po.status === 'borrador' && <button className="link-btn" onClick={() => markStatus(po, 'enviada')}>{t('Marcar enviada')}</button>}
                      {!['recibida', 'cancelado', 'cerrada'].includes(po.status) && <button className="link-btn" onClick={() => openReceive(po)}>{po.status === 'parcial' ? t('Recibir resto') : t('Recibir')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editingPo ? `${t('Editar orden de compra')} ${editingPo.number}` : t('Nueva orden de compra')} onClose={() => { setModalOpen(false); setEditingPo(null); }} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field"><label>{t('Proveedor *')}</label>
                <select required disabled={!!editingPo} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">{t('— Seleccionar —')}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Fecha de la orden')}</label>
                <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
              </div>
            </div>
            {linesLocked ? (
              <>
                <table>
                  <thead><tr><th>{t('Descripción')}</th><th className="text-right">{t('Pedido')}</th><th className="text-right">{t('Recibido')}</th><th className="text-right">{t('Costo unit.')}</th></tr></thead>
                  <tbody>{editingPo.items.map((it) => <tr key={it.id}><td>{it.description}</td><td className="text-right">{it.quantity}</td><td className="text-right">{it.received_qty || 0}</td><td className="text-right">${Number(it.unit_cost).toLocaleString('en-US')}</td></tr>)}</tbody>
                </table>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>🔒 {t('Las líneas no se pueden cambiar porque ya hay mercancía recibida (ya entró al inventario). Sí puedes cambiar la fecha, los comentarios y los adjuntos.')}</div>
              </>
            ) : (
              <>
                <LineItemsEditor items={items} setItems={setItems} products={products} priceLabel="Costo unit." priceSourceField="purchase_cost" />
                {editingPo && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('Puedes ajustar cantidades y líneas mientras la orden no esté marcada como recibida.')}</div>}
              </>
            )}

            <div className="field" style={{ marginTop: 16 }}>
              <label>{t('Comentarios e instrucciones para el proveedor')}</label>
              <textarea rows={6} style={{ resize: 'vertical', minHeight: 120 }} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={t('Ej.: condiciones de entrega, especificaciones del equipo, datos de facturación, contacto en sitio…')} />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('Aparece en la orden de compra impresa.')} · {notes.length.toLocaleString()} {t('caracteres')}</div>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--steel)', marginTop: 16, display: 'block' }}>{t('Archivos adjuntos')}</label>
            {editingPo ? (
              <div className="file-list">
                {(editingPo.attachments || []).map((a) => (
                  <div className="file-list-item" key={a.id}>
                    <a href={a.file_url} target="_blank" rel="noreferrer">{a.original_name || a.file_url.split('/').pop()}</a>
                    <button type="button" className="link-btn" onClick={() => deletePoDoc(a.id)}>✕</button>
                  </div>
                ))}
                <label className="btn btn-sm" style={{ marginTop: 6, display: 'inline-block', cursor: 'pointer' }}>
                  {uploadingDocs ? t('Subiendo…') : t('+ Adjuntar archivo')}
                  <input type="file" multiple hidden disabled={uploadingDocs} onChange={(e) => { uploadPoDocs(e.target.files); e.target.value = ''; }} />
                </label>
              </div>
            ) : (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('Guarda la orden primero para poder adjuntar archivos (cotización del proveedor, etc.).')}</div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => { setModalOpen(false); setEditingPo(null); }}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{editingPo ? t('Guardar cambios') : t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}

      {receiving && <ReceiveModal po={receiving} onClose={() => setReceiving(null)} onDone={() => { setReceiving(null); load(); }} />}

      {viewing && (
        <Modal title={`${t('Orden de compra')} ${viewing.number}`} onClose={() => setViewing(null)} wide>
          <div style={{ marginBottom: 10 }}>
            <Link className="btn btn-sm" to={`/compras/${viewing.id}/documento`}>{t('🖨️ Imprimir / Guardar PDF')}</Link>{' '}
            <Link className="btn btn-sm" to={`/garantias?nuevo=registro&oc=${viewing.id}`}>{t('🛡️ Registrar garantía')}</Link>{' '}
            <Link className="btn btn-sm" to={`/cuentas-por-pagar?nuevo=1&oc=${viewing.id}`}>{t('🧾 Registrar factura del proveedor')}</Link>{' '}
            {!['recibida', 'cancelado', 'cerrada'].includes(viewing.status) && <button className="btn btn-sm btn-primary" onClick={() => { setReceiving(viewing); setViewing(null); }}>{t('📦 Recibir mercancía')}</button>}
          </div>
          <p><strong>{t('Proveedor:')}</strong> {viewing.supplier_id && suppliers.find((s) => s.id === viewing.supplier_id)?.name}</p>
          <p><strong>{t('Estado:')}</strong> <Pill value={viewing.status} /></p>
          <p><strong>{t('Fecha de la orden:')}</strong> {viewing.order_date || '—'}</p>
          {viewing.summary && (
            <div className="chain-summary">
              {[['Pedido', viewing.summary.ordered], ['Recibido', viewing.summary.received], ['Pendiente', viewing.summary.pending], ['Faltante cerrado', viewing.summary.short], ['Facturado (por pagar)', viewing.summary.billed], ['Pagado', viewing.summary.paid]].map(([k, v]) => (
                <div key={k} className={`chain-box ${k === 'Faltante cerrado' && v > 0 ? 'warn' : ''}`}><span>{t(k)}</span><strong>{fmt$(v)}</strong></div>
              ))}
            </div>
          )}
          {viewing.summary && viewing.summary.unbilled > 0.004 && (
            <div className="error-banner" style={{ background: '#fff7ed', color: '#9a3412' }}>
              {t('Recibido sin factura del proveedor:')} <strong>{fmt$(viewing.summary.unbilled)}</strong>. <Link to={`/cuentas-por-pagar?nuevo=1&oc=${viewing.id}`}>{t('Registrar la factura')}</Link>
            </div>
          )}
          <table>
            <thead><tr><th>{t('Descripción')}</th><th className="text-right">{t('Pedido')}</th><th className="text-right">{t('Recibido')}</th><th className="text-right">{t('Pendiente')}</th><th className="text-right">{t('Faltante')}</th><th className="text-right">{t('Costo unit.')}</th><th className="text-right">{t('Subtotal')}</th></tr></thead>
            <tbody>
              {viewing.items.map((it) => {
                const pend = Math.max(0, it.quantity - (it.received_qty || 0) - (it.short_qty || 0));
                return (
                  <tr key={it.id}>
                    <td>{it.description}</td><td className="text-right">{it.quantity}</td>
                    <td className="text-right">{it.received_qty || 0}</td>
                    <td className={`text-right ${pend > 0 ? '' : 'muted'}`}>{pend > 0 ? <strong>{pend}</strong> : '—'}</td>
                    <td className="text-right" style={{ color: it.short_qty > 0 ? 'var(--red)' : undefined }}>{it.short_qty > 0 ? it.short_qty : '—'}</td>
                    <td className="text-right">{fmt$(it.unit_cost)}</td><td className="text-right">{fmt$(it.quantity * it.unit_cost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {viewing.short_note && <div style={{ fontSize: 13, marginTop: 8, whiteSpace: 'pre-wrap' }}><strong style={{ color: 'var(--red)' }}>{t('Faltante:')}</strong> {viewing.short_note}</div>}
          {viewing.summary && viewing.summary.pending > 0 && ['parcial', 'enviada', 'borrador'].includes(viewing.status) && viewing.receipts.length > 0 && (
            shortForm === null
              ? <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setShortForm('')}>{t('Cerrar faltante (lo pendiente ya no llegará)')}</button>
              : <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input autoFocus placeholder={t('Motivo del faltante *')} value={shortForm} onChange={(e) => setShortForm(e.target.value)} />
                  <button className="btn btn-sm btn-primary" onClick={doCloseShort}>{t('Cerrar faltante')}</button>
                  <button className="btn btn-sm" onClick={() => setShortForm(null)}>{t('Cancelar')}</button>
                </div>
          )}
          {viewing.status === 'cerrada' && <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={doReopenShort}>{t('Reabrir faltante (sí va a llegar)')}</button>}
          {viewErr && <div className="error-banner" style={{ marginTop: 8 }}>{viewErr}</div>}

          {viewing.receipts && viewing.receipts.length > 0 && (
            <>
              <p style={{ marginTop: 14, marginBottom: 4 }}><strong>{t('Recepciones (entradas a inventario):')}</strong></p>
              <table>
                <thead><tr><th>{t('Recepción')}</th><th>{t('Fecha')}</th><th>{t('Qué llegó')}</th><th>{t('Cuenta por pagar')}</th></tr></thead>
                <tbody>
                  {viewing.receipts.map((r) => (
                    <tr key={r.id}>
                      <td className="mono">{r.number}</td>
                      <td className="muted">{r.receipt_date}{r.created_by_name ? ` · ${r.created_by_name}` : ''}</td>
                      <td style={{ fontSize: 13 }}>{r.items.map((i) => `${i.quantity} × ${i.description}`).join('; ')}{r.notes ? <div className="muted">{r.notes}</div> : null}</td>
                      <td style={{ fontSize: 13 }}>{r.bill ? <><Link to={`/cuentas-por-pagar?ver=${r.bill.id}`}>{r.bill.bill_number || `#${r.bill.id}`}</Link> · {fmt$(r.bill.amount)} <Pill value={r.bill.status} /></> : <span className="muted">{t('sin factura')}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {viewing.bills && viewing.bills.length > 0 && (
            <>
              <p style={{ marginTop: 14, marginBottom: 4 }}><strong>{t('Cuentas por pagar de esta orden:')}</strong></p>
              <table>
                <thead><tr><th>{t('Factura')}</th><th>{t('Vence')}</th><th className="text-right">{t('Monto')}</th><th className="text-right">{t('Pagado')}</th><th className="text-right">{t('Saldo')}</th><th>{t('Estado')}</th></tr></thead>
                <tbody>
                  {viewing.bills.map((b) => (
                    <tr key={b.id}>
                      <td><Link to={`/cuentas-por-pagar?ver=${b.id}`}>{b.bill_number || `#${b.id}`}</Link></td>
                      <td className="muted">{b.due_date || '—'}</td>
                      <td className="text-right">{fmt$(b.amount)}</td><td className="text-right muted">{fmt$(b.paid)}</td><td className="text-right"><strong>{fmt$(b.balance)}</strong></td>
                      <td><Pill value={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {viewing.attachments && viewing.attachments.length > 0 && (
            <>
              <p style={{ marginTop: 14, marginBottom: 4 }}><strong>{t('Archivos adjuntos:')}</strong></p>
              <div className="file-list">
                {viewing.attachments.map((a) => (
                  <div className="file-list-item" key={a.id}>
                    <a href={a.file_url} target="_blank" rel="noreferrer">{a.original_name || a.file_url.split('/').pop()}</a>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
