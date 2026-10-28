import React from 'react';
import { useI18n } from '../i18n.jsx';
import ProductPicker from './ProductPicker.jsx';

export const EMPTY_PART = { productId: '', description: '', action: 'reemplazada', quantity: 1, unitCost: 0, notes: '' };

export function partsTotal(parts) {
  return parts.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0) * (parseFloat(p.unitCost) || 0), 0);
}

// Partes / productos de una orden de trabajo. Cada línea se puede escoger del catálogo de
// productos (inventario): al escogerlo llena la descripción y el precio de venta, y la línea
// queda ligada al producto (product_id) para que pase así a la factura. Vacío = parte manual.
export default function WorkOrderPartsEditor({ parts, setParts, products }) {
  const { t } = useI18n();

  function update(idx, field, value) {
    const copy = [...parts];
    copy[idx] = { ...copy[idx], [field]: value };
    setParts(copy);
  }
  function pickProduct(idx, productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    const copy = [...parts];
    copy[idx] = {
      ...copy[idx],
      productId: productId || '',
      description: product
        ? (product.description && product.description !== product.name ? `${product.name} — ${product.description}` : product.name)
        : copy[idx].description,
      unitCost: product ? Number(product.selling_price) || 0 : copy[idx].unitCost,
    };
    setParts(copy);
  }
  function addRow() { setParts([...parts, { ...EMPTY_PART }]); }
  function removeRow(idx) { setParts(parts.filter((_, i) => i !== idx)); }

  return (
    <>
      <table className="line-items-table" style={{ marginTop: 6 }}>
        <thead>
          <tr>
            <th style={{ width: 230 }}>{t('Producto')}</th><th>{t('Descripción')}</th>
            <th style={{ width: 140 }}>{t('Acción')}</th><th style={{ width: 70 }}>{t('Cant.')}</th>
            <th style={{ width: 105 }}>{t('Precio unit.')}</th><th style={{ width: 90 }}>{t('Total')}</th>
            <th style={{ width: 170 }}>{t('Nota (opcional)')}</th><th></th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p, idx) => (
            <tr key={idx}>
              <td><ProductPicker products={products} value={p.productId || ''} onChange={(id) => pickProduct(idx, id)} /></td>
              <td><input value={p.description} onChange={(e) => update(idx, 'description', e.target.value)} /></td>
              <td>
                <select value={p.action} onChange={(e) => update(idx, 'action', e.target.value)}>
                  <option value="reemplazada">{t('Reemplazada')}</option>
                  <option value="reparada">{t('Reparada')}</option>
                  <option value="garantia">{t('Garantía')}</option>
                  <option value="cliente">{t('Suministrada por el cliente')}</option>
                </select>
              </td>
              <td><input type="number" step="1" value={p.quantity} onChange={(e) => update(idx, 'quantity', e.target.value)} /></td>
              <td><input type="number" step="0.01" value={p.unitCost} onChange={(e) => update(idx, 'unitCost', e.target.value)} /></td>
              <td className="text-right">${((parseFloat(p.quantity) || 0) * (parseFloat(p.unitCost) || 0)).toLocaleString()}</td>
              <td><input placeholder={t('Nota sobre la parte (ej. garantía, quién la suministró, etc.)')} value={p.notes || ''} onChange={(e) => update(idx, 'notes', e.target.value)} /></td>
              <td><button type="button" className="link-btn" onClick={() => removeRow(idx)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addRow}>{t('+ Agregar parte o producto')}</button>
    </>
  );
}
