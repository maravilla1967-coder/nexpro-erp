import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import ProductPicker from './ProductPicker.jsx';

export const EMPTY_PART = { productId: '', description: '', action: 'reemplazada', quantity: 1, unitCost: 0, serial: '', productSerialId: null, notes: '' };

export const PART_ACTIONS = [
  ['reemplazada', 'Reemplazada'],
  ['reparada', 'Reparada'],
  ['instalada', 'Instalada'],
  ['proveedor', 'Suministrada e instalada por proveedor'],
  ['garantia', 'Garantía'],
  ['cliente', 'Suministrada por el cliente'],
];

export function partsTotal(parts) {
  return parts.reduce((sum, p) => sum + (parseFloat(p.quantity) || 0) * (parseFloat(p.unitCost) || 0), 0);
}

// Convierte una parte guardada (snake_case del API) a la forma del editor.
export function partFromApi(p) {
  return { productId: p.product_id || '', description: p.description, action: p.action, quantity: p.quantity,
    unitCost: p.unit_cost ?? 0, serial: p.serial || '', productSerialId: p.product_serial_id || null, notes: p.notes || '' };
}

export function partToApi(p) {
  return { productId: p.productId || null, description: p.description, action: p.action,
    quantity: parseFloat(p.quantity) || 1, unitCost: parseFloat(p.unitCost) || 0,
    serial: (p.serial || '').trim() || null, productSerialId: p.productSerialId || null, notes: p.notes || null };
}

// Partes / productos de una orden de trabajo.
// - Se pueden escoger del catálogo (llena descripción y precio de venta) o escribir a mano
//   (ej. la bomba o el PTO que instala un proveedor y que no pasa por inventario).
// - Cada línea lleva número de serie. Si el producto controla seriales, se sugieren los
//   disponibles en inventario; al guardar, esa unidad queda "instalada" en el vehículo.
// defaultAction: acción con la que nacen las líneas nuevas (ej. 'proveedor' si la orden es de un proveedor).
export default function WorkOrderPartsEditor({ parts, setParts, products, defaultAction = 'reemplazada' }) {
  const { t } = useI18n();
  const [serialsByProduct, setSerialsByProduct] = useState({});

  // Carga los seriales disponibles de los productos que tienen control de seriales.
  const trackedIds = [...new Set(parts.map((p) => p.productId).filter((id) => {
    const prod = products.find((x) => String(x.id) === String(id));
    return prod && prod.track_serials;
  }).map(String))];
  const missing = trackedIds.filter((id) => !(id in serialsByProduct));
  useEffect(() => {
    if (missing.length === 0) return;
    api.get('/serials', { status: 'disponible', productIds: missing.join(',') }).then((rows) => {
      setSerialsByProduct((prev) => {
        const next = { ...prev };
        missing.forEach((id) => { next[id] = rows.filter((r) => String(r.product_id) === id); });
        return next;
      });
    }).catch(() => {});
  }, [missing.join(',')]);

  function update(idx, field, value) {
    const copy = [...parts];
    copy[idx] = { ...copy[idx], [field]: value };
    setParts(copy);
  }
  function updateSerial(idx, value) {
    const row = parts[idx];
    const options = serialsByProduct[String(row.productId)] || [];
    const match = options.find((o) => o.serial === value.trim());
    const copy = [...parts];
    // Si sigue siendo el mismo serial ya ligado, se conserva el vínculo; si coincide con uno
    // disponible del inventario, se liga a ese; si no, queda como serial escrito a mano.
    const keep = row.productSerialId && value.trim() === (row._linkedSerial ?? row.serial);
    copy[idx] = { ...row, serial: value,
      productSerialId: match ? match.id : (keep ? row.productSerialId : null),
      _linkedSerial: row._linkedSerial ?? (row.productSerialId ? row.serial : undefined) };
    setParts(copy);
  }
  function pickProduct(idx, productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    const copy = [...parts];
    copy[idx] = {
      ...copy[idx],
      productId: productId || '',
      serial: '', productSerialId: null,
      description: product
        ? (product.description && product.description !== product.name ? `${product.name} — ${product.description}` : product.name)
        : copy[idx].description,
      unitCost: product ? Number(product.selling_price) || 0 : copy[idx].unitCost,
    };
    setParts(copy);
  }
  function addRow() { setParts([...parts, { ...EMPTY_PART, action: defaultAction }]); }
  function removeRow(idx) { setParts(parts.filter((_, i) => i !== idx)); }

  return (
    <>
      <table className="line-items-table" style={{ marginTop: 6 }}>
        <thead>
          <tr>
            <th style={{ width: 210 }}>{t('Producto')}</th><th>{t('Descripción')}</th>
            <th style={{ width: 150 }}>{t('Número de serie')}</th>
            <th style={{ width: 140 }}>{t('Acción')}</th><th style={{ width: 64 }}>{t('Cant.')}</th>
            <th style={{ width: 100 }}>{t('Precio unit.')}</th><th style={{ width: 85 }}>{t('Total')}</th>
            <th style={{ width: 150 }}>{t('Nota (opcional)')}</th><th></th>
          </tr>
        </thead>
        <tbody>
          {parts.map((p, idx) => {
            const prod = products.find((x) => String(x.id) === String(p.productId));
            const options = (prod && prod.track_serials && serialsByProduct[String(p.productId)]) || [];
            const listId = `wo-serials-${idx}`;
            return (
              <tr key={idx}>
                <td><ProductPicker products={products} value={p.productId || ''} onChange={(id) => pickProduct(idx, id)} /></td>
                <td><input value={p.description} onChange={(e) => update(idx, 'description', e.target.value)} /></td>
                <td>
                  <input className="mono" list={options.length ? listId : undefined} value={p.serial || ''}
                    placeholder={options.length ? t('Escoger o escribir S/N') : t('S/N (opcional)')}
                    onChange={(e) => updateSerial(idx, e.target.value)} />
                  {options.length > 0 && (
                    <datalist id={listId}>{options.map((o) => <option key={o.id} value={o.serial} />)}</datalist>
                  )}
                  {p.productSerialId ? <div className="muted" style={{ fontSize: 11 }}>✓ {t('Del inventario')}</div>
                    : (prod && prod.track_serials && options.length > 0 && <div className="muted" style={{ fontSize: 11 }}>{options.length} {t('disponibles')}</div>)}
                </td>
                <td>
                  <select value={p.action} onChange={(e) => update(idx, 'action', e.target.value)}>
                    {PART_ACTIONS.map(([v, label]) => <option key={v} value={v}>{t(label)}</option>)}
                  </select>
                </td>
                <td><input type="number" step="1" value={p.quantity} onChange={(e) => update(idx, 'quantity', e.target.value)} /></td>
                <td><input type="number" step="0.01" value={p.unitCost} onChange={(e) => update(idx, 'unitCost', e.target.value)} /></td>
                <td className="text-right">${((parseFloat(p.quantity) || 0) * (parseFloat(p.unitCost) || 0)).toLocaleString()}</td>
                <td><input placeholder={t('Nota sobre la parte (ej. garantía, quién la suministró, etc.)')} value={p.notes || ''} onChange={(e) => update(idx, 'notes', e.target.value)} /></td>
                <td><button type="button" className="link-btn" onClick={() => removeRow(idx)}>✕</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm" style={{ marginTop: 8 }} onClick={addRow}>{t('+ Agregar parte o producto')}</button>
    </>
  );
}
