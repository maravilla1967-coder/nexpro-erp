import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import LineItemsEditor from '../components/LineItemsEditor.jsx';
import PaymentModal, { money, uploadPaymentFiles } from '../components/PaymentModal.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
const invDate = (r) => r.issue_date;
const invNumber = (r) => r.number;
const INV_COLUMNS = [
  { label: 'Número', value: (r) => r.number, mono: true },
  { label: 'Fecha', value: (r) => (r.issue_date || '').slice(0, 10) },
  { label: 'Vence', value: (r) => (r.due_date || '').slice(0, 10) },
  { label: 'Cliente', value: (r) => r.customer_name },
  { label: 'Estado', value: (r) => r.status },
  { label: 'Subtotal', value: (r) => r.subtotal, type: 'money' },
  { label: 'Impuesto', value: (r) => r.tax_amount, type: 'money' },
  { label: 'Total', value: (r) => r.total, type: 'money' },
  { label: 'Pagado', value: (r) => r.paid, type: 'money' },
  { label: 'Saldo', value: (r) => r.balance, type: 'money' },
];

export default function InvoicesList() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const ex = useListExport({ rows: list, getDate: invDate, getNumber: invNumber });
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

  const [paying, setPaying] = useState(null);
  async function savePayment(payload, files) { const r = await api.post(`/invoices/${paying.id}/payments`, payload); await uploadPaymentFiles(`/invoices/${paying.id}`, r.newPaymentId, files); setPaying(null); load(); }

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Facturación')}</h1><div className="sub">{t('Facturas a clientes')}</div></div>
        <button className="btn btn-primary" onClick={openNew}>{t('+ Nueva factura')}</button>
      </div>
      <div className="content">
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay facturas todavía.')}</div> : (
            <><ListExportBar ex={ex} title={t('Facturas')} filename="facturas" columns={INV_COLUMNS} />
            <table>
              <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Número')}</th><th>{t('Cliente')}</th><th>{t('Total')}</th><th>{t('Saldo')}</th><th>{t('Estado')}</th><th>{t('Fecha')}</th><th></th></tr></thead>
              <tbody>
                {ex.visible.map((inv) => (
                  <tr key={inv.id}>
                    <td><RowBox ex={ex} row={inv} /></td>
                    <td className="mono"><Link to={`/facturas/${inv.id}`}>{inv.number}</Link></td>
                    <td>{inv.customer_name}</td>
                    <td><strong>${Number(inv.total).toLocaleString()}</strong></td>
                    <td className={inv.balance > 0.004 ? '' : 'muted'}>{money(inv.balance)}</td>
                    <td><Pill value={inv.status} /></td>
                    <td className="muted">{inv.issue_date}</td>
                    <td>
                      <Link to={`/facturas/${inv.id}`} className="link-btn">{t('Ver / Imprimir')}</Link>{' '}
                      {inv.balance > 0.004 && !['cancelado', 'anulada'].includes(inv.status) && <button className="link-btn" onClick={() => setPaying(inv)}>{t('Registrar pago')}</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></>
          )}
        </div>
      </div>

      {paying && <PaymentModal showSurcharge title={`${t('Registrar pago')} · ${paying.number}`} balance={paying.balance} onSave={savePayment} onClose={() => setPaying(null)} />}

      {modalOpen && (
        <Modal title={t('Nueva factura')} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field"><label>{t('Cliente *')}</label>
                <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t('— Seleccionar —')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field"><label>{t('Impuesto (%)')}</label><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
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
