import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import LineItemsEditor from '../components/LineItemsEditor.jsx';
import { useI18n } from '../i18n.jsx';

export default function SalesOrdersList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() { api.get('/sales-orders').then(setList).catch(console.error); }
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers);
    api.get('/products').then(setProducts);
  }, []);

  function openNew() {
    setEditing(null);
    setCustomerId(''); setItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]); setError(''); setModalOpen(true);
  }

  async function openEdit(id) {
    const so = await api.get(`/sales-orders/${id}`);
    setEditing(so);
    setCustomerId(String(so.customer_id));
    setItems(so.items.length > 0
      ? so.items.map((i) => ({ productId: i.product_id || '', description: i.description, quantity: i.quantity, unitPrice: i.unit_price }))
      : [{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
    setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    const payload = {
      customerId,
      items: items.filter((i) => i.description).map((i) => ({ productId: i.productId || null, description: i.description, quantity: parseFloat(i.quantity) || 0, unitPrice: parseFloat(i.unitPrice) || 0 })),
    };
    try {
      if (editing) {
        const result = await api.put(`/sales-orders/${editing.id}`, payload);
        if (result && result.pending) {
          setModalOpen(false);
          setNotice(result.message || t('Los cambios se enviaron para autorización del administrador.'));
          load();
          return;
        }
      } else {
        await api.post('/sales-orders', payload);
      }
      setModalOpen(false); load();
    } catch (err) { setError(err.message); }
  }

  async function convertToInvoice(so) {
    if (!window.confirm(`${t('Generar factura a partir del pedido')} ${so.number}?`)) return;
    const invoice = await api.post('/invoices', { salesOrderId: so.id });
    navigate(`/facturas/${invoice.id}`);
  }

  async function updateStatus(id, status) {
    const result = await api.put(`/sales-orders/${id}`, { status });
    if (result && result.pending) {
      setNotice(result.message || t('Los cambios se enviaron para autorización del administrador.'));
    }
    load();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Órdenes de Pedido')}</h1><div className="sub">{t('Pedidos / cotizaciones de clientes, previos a la factura')}</div></div>
        <button className="btn btn-primary" onClick={openNew}>{t('+ Nuevo pedido')}</button>
      </div>
      <div className="content">
        {notice && <div className="error-banner" style={{ background: '#fef3c7', color: '#92400e' }}>{notice}</div>}
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay pedidos todavía.')}</div> : (
            <table>
              <thead><tr><th>{t('Número')}</th><th>{t('Cliente')}</th><th>{t('Estado')}</th><th>{t('Fecha')}</th><th></th></tr></thead>
              <tbody>
                {list.map((so) => (
                  <tr key={so.id}>
                    <td className="mono clickable" onClick={() => openEdit(so.id)}>{so.number}</td>
                    <td>{so.customer_name}</td>
                    <td>
                      <select value={so.status} onChange={(e) => updateStatus(so.id, e.target.value)} style={{ width: 140, display: 'inline-block' }}>
                        <option value="pendiente">{t('pendiente')}</option>
                        <option value="aprobado">{t('aprobado')}</option>
                        <option value="en_proceso">{t('en_proceso')}</option>
                        <option value="cancelado">{t('cancelado')}</option>
                      </select>
                    </td>
                    <td className="muted">{so.created_at}</td>
                    <td>
                      <button className="link-btn" onClick={() => openEdit(so.id)}>{t('Editar')}</button>{' '}
                      <Link className="link-btn" to={`/pedidos/${so.id}/documento`}>{t('Imprimir')}</Link>{' '}
                      {so.status !== 'facturado' && <button className="link-btn" onClick={() => convertToInvoice(so)}>{t('Facturar')}</button>}
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
        <Modal title={editing ? `${t('Editar pedido')} ${editing.number}` : t('Nuevo pedido')} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="field"><label>{t('Cliente *')}</label>
              <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">{t('— Seleccionar —')}</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <LineItemsEditor items={items} setItems={setItems} products={products} priceLabel="Precio unit." priceSourceField="selling_price" />
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
