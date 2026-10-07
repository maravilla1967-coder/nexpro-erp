import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import LineItemsEditor from '../components/LineItemsEditor.jsx';

export default function SalesOrdersList() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  const [error, setError] = useState('');

  function load() { api.get('/sales-orders').then(setList).catch(console.error); }
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers);
    api.get('/products').then(setProducts);
  }, []);

  function openNew() {
    setCustomerId(''); setItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]); setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      customerId,
      items: items.filter((i) => i.description).map((i) => ({ productId: i.productId || null, description: i.description, quantity: parseFloat(i.quantity) || 0, unitPrice: parseFloat(i.unitPrice) || 0 })),
    };
    try { await api.post('/sales-orders', payload); setModalOpen(false); load(); }
    catch (err) { setError(err.message); }
  }

  async function openView(id) {
    const so = await api.get(`/sales-orders/${id}`);
    setViewing(so);
  }

  async function convertToInvoice(so) {
    if (!window.confirm(`¿Generar factura a partir del pedido ${so.number}?`)) return;
    const invoice = await api.post('/invoices', { salesOrderId: so.id });
    navigate(`/facturas/${invoice.id}`);
  }

  async function updateStatus(id, status) {
    await api.put(`/sales-orders/${id}`, { status });
    load();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Órdenes de Pedido</h1><div className="sub">Pedidos de clientes, previos a la factura</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo pedido</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? <div className="empty-state">No hay pedidos todavía.</div> : (
            <table>
              <thead><tr><th>Número</th><th>Cliente</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {list.map((so) => (
                  <tr key={so.id}>
                    <td className="mono clickable" onClick={() => openView(so.id)}>{so.number}</td>
                    <td>{so.customer_name}</td>
                    <td>
                      <select value={so.status} onChange={(e) => updateStatus(so.id, e.target.value)} style={{ width: 140, display: 'inline-block' }}>
                        <option value="pendiente">pendiente</option>
                        <option value="aprobado">aprobado</option>
                        <option value="en_proceso">en_proceso</option>
                        <option value="cancelado">cancelado</option>
                      </select>
                    </td>
                    <td className="muted">{so.created_at}</td>
                    <td>
                      {so.status !== 'facturado' && <button className="link-btn" onClick={() => convertToInvoice(so)}>Facturar</button>}
                      {so.status === 'facturado' && <Pill value="facturado" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title="Nuevo pedido" onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>Cliente *</label>
              <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <LineItemsEditor items={items} setItems={setItems} products={products} priceLabel="Precio unit." priceSourceField="selling_price" />
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Pedido ${viewing.number}`} onClose={() => setViewing(null)} wide>
          <p><strong>Estado:</strong> <Pill value={viewing.status} /></p>
          <table>
            <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
            <tbody>
              {viewing.items.map((it) => (
                <tr key={it.id}><td>{it.description}</td><td>{it.quantity}</td><td>${it.unit_price}</td><td>${(it.quantity * it.unit_price).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
