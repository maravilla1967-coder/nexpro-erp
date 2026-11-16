import React, { useEffect, useMemo, useState } from 'react';
import CustomerPicker from '../components/CustomerPicker.jsx';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import Pill from '../components/Pill.jsx';
import LineItemsEditor from '../components/LineItemsEditor.jsx';
import PaymentModal, { money, sendPayment } from '../components/PaymentModal.jsx';
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
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]);
  const [error, setError] = useState('');
  const [workOrders, setWorkOrders] = useState([]);
  const [woPickerOpen, setWoPickerOpen] = useState(false);
  const [woSearch, setWoSearch] = useState('');

  function load() { api.get('/invoices').then(setList).catch(console.error); }
  useEffect(() => {
    load();
    api.get('/customers').then(setCustomers);
    api.get('/suppliers').then(setSuppliers).catch(() => {});
    api.get('/products').then(setProducts);
    api.get('/services').then(setServices).catch(() => {});
    api.get('/work-orders').then(setWorkOrders).catch(() => {});
  }, []);

  // Trae a esta factura (a cualquier cliente o proveedor) las líneas de una orden de trabajo,
  // sin importar si esa orden ya tiene su propia factura en otro lado: no se toca la orden ni su
  // factura original, solo se copian sus servicios/partes como líneas nuevas aquí. Útil, por
  // ejemplo, para reclamarle a un proveedor el costo de una reparación de garantía sin perder el
  // historial de la orden ni de su factura al cliente.
  function addWorkOrder(wo) {
    const newItems = [];
    for (const s of wo.services || []) {
      const isFlat = s.pricing_type === 'servicio_completo';
      newItems.push({ productId: '', description: `${wo.number} — ${s.description}`,
        quantity: isFlat ? 1 : Number(s.hours || 0), unitPrice: isFlat ? Number(s.flat_price || 0) : Number(s.hourly_rate || 0) });
    }
    for (const part of wo.parts || []) {
      newItems.push({ productId: part.product_id || '', description: `${wo.number} — ${part.description}${part.serial ? ` (S/N ${part.serial})` : ''}`,
        quantity: Number(part.quantity || 1), unitPrice: Number(part.unit_cost || 0) });
    }
    if (newItems.length === 0) return;
    setItems((prev) => [...prev.filter((i) => i.description || i.productId), ...newItems]);
    setWoSearch(''); setWoPickerOpen(false);
  }

  // El selector de "Cliente" de esta factura también deja escoger un proveedor (para facturarle
  // a él en vez de al cliente, ej. un reclamo de garantía): se le muestra con la ficha que ya
  // existe en el CRM para ese proveedor (se crea sola la primera vez, ver /crm/from-supplier/:id).
  const billToOptions = useMemo(() => [
    ...customers,
    ...suppliers.map((s) => ({ id: `s:${s.id}`, name: `${s.name} (${t('proveedor')})`, tax_id: s.tax_id, phone: s.phone, email: s.email, city: s.city })),
  ], [customers, suppliers, t]);

  const woMatches = woSearch.trim().length === 0 ? [] : workOrders.filter((wo) => {
    const q = woSearch.trim().toLowerCase();
    return String(wo.number).toLowerCase().includes(q) || String(wo.vin || '').toLowerCase().includes(q) || String(wo.customer_name || '').toLowerCase().includes(q);
  }).slice(0, 8);

  function openNew() {
    setCustomerId(''); setTaxRate(0); setItems([{ productId: '', description: '', quantity: 1, unitPrice: 0 }]); setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      let billToCustomerId = customerId;
      if (String(customerId).startsWith('s:')) {
        const supplierId = String(customerId).slice(2);
        const mirror = await api.post(`/crm/from-supplier/${supplierId}`, {});
        billToCustomerId = mirror.id;
      }
      const payload = {
        customerId: billToCustomerId, taxRate: parseFloat(taxRate) || 0,
        items: items.filter((i) => i.description).map((i) => ({ productId: i.productId || null, description: i.description, quantity: parseFloat(i.quantity) || 0, unitPrice: parseFloat(i.unitPrice) || 0 })),
      };
      await api.post('/invoices', payload); setModalOpen(false); load();
    } catch (err) { setError(err.message); }
  }

  const [paying, setPaying] = useState(null);
  async function savePayment(payload, files) { await sendPayment('post', `/invoices/${paying.id}/payments`, payload, files); setPaying(null); load(); }

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
                    <td className="mono"><Link to={`/facturas/${inv.id}`}>{inv.number}</Link>{inv.delivery_number ? <div style={{ fontSize: 11 }}><Link className="muted" to={`/facturas/${inv.id}/entrega`} title={`${t('Boleta de entrega')} ${inv.delivery_number}`}>🚚 {inv.delivery_number}</Link></div> : null}</td>
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
                <CustomerPicker required customers={billToOptions} value={customerId} onChange={setCustomerId} />
              </div>
              <div className="field"><label>{t('Impuesto (%)')}</label><input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} /></div>
            </div>
            <LineItemsEditor items={items} setItems={setItems} products={products} services={services} priceLabel="Precio unit." priceSourceField="selling_price" />
            <div style={{ marginTop: 8 }}>
              {!woPickerOpen ? (
                <button type="button" className="btn btn-sm" onClick={() => setWoPickerOpen(true)}>+ {t('Agregar orden de trabajo')}</button>
              ) : (
                <div className="field" style={{ maxWidth: 420 }}>
                  <label>{t('Buscar orden de trabajo por número o VIN')}</label>
                  <input autoFocus value={woSearch} onChange={(e) => setWoSearch(e.target.value)} placeholder={t('Ej. NX-WO-20261015-01 o el VIN')} />
                  {woMatches.length > 0 && (
                    <div style={{ marginTop: 4, border: '1px solid var(--border, #ddd)', borderRadius: 6, overflow: 'hidden' }}>
                      {woMatches.map((wo) => (
                        <div key={wo.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border, #eee)' }} onClick={() => addWorkOrder(wo)}>
                          <span className="mono">{wo.number}</span>
                          <span className="muted" style={{ fontSize: 12 }}>{wo.vin || ''}{wo.invoice_number ? ` · ${t('ya facturada en')} ${wo.invoice_number}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="link-btn" style={{ marginTop: 4 }} onClick={() => { setWoPickerOpen(false); setWoSearch(''); }}>{t('Cerrar')}</button>
                </div>
              )}
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('Trae los servicios/partes de una orden de trabajo como líneas de esta factura, sin tocar la orden ni su factura original (sirve, por ejemplo, para reclamarle a un proveedor una reparación de garantía que ya se le facturó al cliente).')}</div>
            </div>
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
