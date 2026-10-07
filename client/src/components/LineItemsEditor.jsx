import React from 'react';
import { useI18n } from '../i18n.jsx';

// items: [{ productId, description, quantity, unitPrice }]
// priceLabel: etiqueta de la columna de precio ("Costo unit." o "Precio unit.")
export default function LineItemsEditor({ items, setItems, products, priceLabel = 'Precio unit.', priceSourceField = 'selling_price' }) {
  const { t } = useI18n();
  function update(idx, field, value) {
    const copy = [...items];
    copy[idx] = { ...copy[idx], [field]: value };
    setItems(copy);
  }
  function pickProduct(idx, productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    const copy = [...items];
    copy[idx] = {
      ...copy[idx],
      productId: productId || '',
      description: product ? product.name : copy[idx].description,
      unitPrice: product ? product[priceSourceField] : copy[idx].unitPrice,
    };
    setItems(copy);
  }
  function addRow() { setItems([...items, { productId: '', description: '', quantity: 1, unitPrice: 0 }]); }
  function removeRow(idx) { setItems(items.filter((_, i) => i !== idx)); }

  const total = items.reduce((sum, it) => sum + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);

  return (
    <div>
      <table className="line-items-table">
        <thead>
          <tr><th>{t('Producto')}</th><th>{t('Descripción')}</th><th style={{ width: 90 }}>{t('Cant.')}</th><th style={{ width: 120 }}>{t(priceLabel)}</th><th style={{ width: 110 }}>{t('Subtotal')}</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td>
                <select value={it.productId || ''} onChange={(e) => pickProduct(idx, e.target.value)}>
                  <option value="">— manual —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
              <td><input value={it.description} onChange={(e) => update(idx, 'description', e.target.value)} /></td>
              <td><input type="number" step="0.01" value={it.quantity} onChange={(e) => update(idx, 'quantity', e.target.value)} /></td>
              <td><input type="number" step="0.01" value={it.unitPrice} onChange={(e) => update(idx, 'unitPrice', e.target.value)} /></td>
              <td className="text-right">${((parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0)).toLocaleString()}</td>
              <td><button type="button" className="link-btn" onClick={() => removeRow(idx)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addRow}>+ {t('Agregar línea')}</button>
      <div className="text-right" style={{ marginTop: 10, fontWeight: 700 }}>{t('Total')}: ${total.toLocaleString()}</div>
    </div>
  );
}
