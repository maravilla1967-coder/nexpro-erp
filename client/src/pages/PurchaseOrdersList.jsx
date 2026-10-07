import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import LineItemsEditor from '../components/LineItemsEditor.jsx';

export default function PurchaseOrdersList() {
  const [list, setList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  const [error, setError] = useState('');

  function load() { api.get('/purchase-orders').then(setList).catch(console.error); }
  useEffect(() => {
    load();
    api.get('/suppliers').then(setSuppliers);
    api.get('/products').then(setProducts);
  }, []);

  function openNew() {
    setSupplierId(''); setItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]); setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      supplierId,
      items: items.filter((i) => i.description).map((i) => ({ productId: i.productId || null, description: i.description, quantity: parseFloat(i.quantity) || 0, unitCost: parseFloat(i.unitPrice) || 0 })),
    };
    try { await api.post('/purchase-orders', payload); setModalOpen(false); load(); }
    catch (err) { setError(err.message); }
  }

  async function markReceived(po) {
    await api.put(`/purchase-orders/${po.id}`, { status: 'recibida' });
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
        <div><h1>Órdenes de Compra</h1><div className="sub">Compras a proveedores</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva orden de compra</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? <div className="empty-state">No hay órdenes de compra todavía.</div> : (
            <table>
              <thead><tr><th>Número</th><th>Proveedor</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {list.map((po) => (
                  <tr key={po.id}>
                    <td className="mono clickable" onClick={() => openView(po.id)}>{po.number}</td>
                    <td>{po.supplier_name}</td>
                    <td><Pill value={po.status} /></td>
                    <td className="muted">{po.created_at}</td>
                    <td>
                      {po.status !== 'recibida' && <button className="link-btn" onClick={() => markReceived(po)}>Marcar recibida</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title="Nueva orden de compra" onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>Proveedor *</label>
              <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <LineItemsEditor items={items} setItems={setItems} products={products} priceLabel="Costo unit." priceSourceField="purchase_cost" />
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Orden de compra ${viewing.number}`} onClose={() => setViewing(null)} wide>
          <p><strong>Proveedor:</strong> {viewing.supplier_id && suppliers.find((s) => s.id === viewing.supplier_id)?.name}</p>
          <p><strong>Estado:</strong> <Pill value={viewing.status} /></p>
          <table>
            <thead><tr><th>Descripción</th><th>Cant.</th><th>Costo unit.</th><th>Subtotal</th></tr></thead>
            <tbody>
              {viewing.items.map((it) => (
                <tr key={it.id}><td>{it.description}</td><td>{it.quantity}</td><td>${it.unit_cost}</td><td>${(it.quantity * it.unit_cost).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
