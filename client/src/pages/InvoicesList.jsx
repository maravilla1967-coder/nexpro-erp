import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import LineItemsEditor from '../components/LineItemsEditor.jsx';

export default function InvoicesList() {
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  const [error, setError] = useState('');

  function load() { api.get('/invoices').then(setList).catch(console.error); }
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers);
    api.get('/products').then(setProducts);
  }, []);

  function openNew() {
    setCustomerId(''); setTaxRate(0); setItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]); setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      customerId, taxRate: parseFloat(taxRate) || 0,
      items: items.filter((i) => i.description).map((i) => ({ productId: i.productId || null, description: i.description, quantity: parseFloat(i.quantity) || 0, unitPrice: parseFloat(i.unitPrice) || 0 })),
    };
    try { await api.post('/invoices', payload); setModalOpen(false); load(); }
    catch (err) { setError(err.message); }
  }

  async function markPaid(id) { await api.put(`/invoices/${id}`, { status: 'pagada' }); load(); }

  return (
    <>
      <div className="topbar">
        <div><h1>Facturación</h1><div className="sub">Facturas a clientes</div></div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva factura</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? <div className="empty-state">No hay facturas todavía.</div> : (
            <table>
              <thead><tr><th>Número</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
              <tbody>
                {list.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono"><Link to={`/facturas/${inv.id}`}>{inv.number}</Link></td>
                    <td>{inv.customer_name}</td>
                    <td><strong>${Number(inv.total).toLocaleString()}</strong></td>
                    <td><Pill value={inv.status} /></td>
                    <td className="muted">{inv.issue_date}</td>
                    <td>
                      <Link to={`/facturas/${inv.id}`} className="link-btn">Ver / Imprimir</Link>{' '}
                      {inv.status === 'pendiente' && <button className="link-btn" onClick={() => markPaid(inv.id)}>Marcar pagada</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title="Nueva factura" onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field"><label>Cliente *</label>
                <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">— Seleccionar —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field"><label>Impuesto (%)</label><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
            </div>
            <LineItemsEditor items={items} setItems={setItems} products={products} priceLabel="Precio unit." priceSourceField="selling_price" />
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
