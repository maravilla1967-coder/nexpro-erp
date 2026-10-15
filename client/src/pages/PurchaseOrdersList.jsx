import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import LineItemsEditor from '../components/LineItemsEditor.jsx';
import { useI18n } from '../i18n.jsx';

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function PurchaseOrdersList() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPo, setEditingPo] = useState(null); // null = nueva orden; si no, se está editando esta orden existente
  const [viewing, setViewing] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(todayStr());
  const [items, setItems] = useState([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
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
    setSupplierId(''); setOrderDate(todayStr());
    setItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
    setError(''); setModalOpen(true);
  }

  async function openEdit(po) {
    const full = await api.get(`/purchase-orders/${po.id}`);
    setEditingPo(full);
    setSupplierId(full.supplier_id);
    setOrderDate(full.order_date || todayStr());
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

  async function save(e) {
    e.preventDefault();
    const payload = {
      supplierId, orderDate,
      items: items.filter((i) => i.description).map((i) => ({ productId: i.productId || null, description: i.description, quantity: parseFloat(i.quantity) || 0, unitCost: parseFloat(i.unitPrice) || 0 })),
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

  async function markStatus(po, status) {
    await api.put(`/purchase-orders/${po.id}`, { status });
    load();
    if (viewing && viewing.id === po.id) openView(po.id);
  }
  async function openView(id) {
    const po = await api.get(`/purchase-orders/${id}`);
    setViewing(po);
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
            <table>
              <thead><tr><th>{t('Número')}</th><th>{t('Proveedor')}</th><th>{t('Estado')}</th><th>{t('Fecha')}</th><th></th></tr></thead>
              <tbody>
                {list.map((po) => (
                  <tr key={po.id}>
                    <td className="mono clickable" onClick={() => openView(po.id)}>{po.number}</td>
                    <td>{po.supplier_name}</td>
                    <td><Pill value={po.status} /></td>
                    <td className="muted">{po.order_date || po.created_at}</td>
                    <td style={{ display: 'flex', gap: 10 }}>
                      {po.status !== 'recibida' && <button className="link-btn" onClick={() => openEdit(po)}>{t('Editar')}</button>}
                      {po.status === 'borrador' && <button className="link-btn" onClick={() => markStatus(po, 'enviada')}>{t('Marcar enviada')}</button>}
                      {po.status !== 'recibida' && <button className="link-btn" onClick={() => markStatus(po, 'recibida')}>{t('Marcar recibida')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <LineItemsEditor items={items} setItems={setItems} products={products} priceLabel="Costo unit." priceSourceField="purchase_cost" />
            {editingPo && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t('Puedes ajustar cantidades y líneas mientras la orden no esté marcada como recibida.')}</div>}

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

      {viewing && (
        <Modal title={`${t('Orden de compra')} ${viewing.number}`} onClose={() => setViewing(null)} wide>
          <p><strong>{t('Proveedor:')}</strong> {viewing.supplier_id && suppliers.find((s) => s.id === viewing.supplier_id)?.name}</p>
          <p><strong>{t('Estado:')}</strong> <Pill value={viewing.status} /></p>
          <p><strong>{t('Fecha de la orden:')}</strong> {viewing.order_date || '—'}</p>
          <table>
            <thead><tr><th>{t('Descripción')}</th><th>{t('Cant.')}</th><th>{t('Costo unit.')}</th><th>{t('Subtotal')}</th></tr></thead>
            <tbody>
              {viewing.items.map((it) => (
                <tr key={it.id}><td>{it.description}</td><td>{it.quantity}</td><td>${it.unit_cost}</td><td>${(it.quantity * it.unit_cost).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
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
