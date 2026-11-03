import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, toFormData } from '../api.js';
import { useI18n } from '../i18n.jsx';
import Modal from './Modal.jsx';
import ProductTypeSelect from './ProductTypeSelect.jsx';
import SearchPicker from './SearchPicker.jsx';

const priceFrom = (cost, freight, margin) => {
  const base = (parseFloat(cost) || 0) + (parseFloat(freight) || 0);
  const m = parseFloat(margin);
  if (!m || m >= 100) return Math.round(base * 100) / 100;
  return Math.round((base / (1 - m / 100)) * 100) / 100;
};

// Crear un producto del catálogo sin salir del documento que se está haciendo
// (ej. una bomba o un PTO que no estaba en el inventario al hacer la orden de trabajo).
// Se abre en un portal para no quedar anidado dentro del <form> del documento.
export default function QuickProductModal({ initialName = '', defaultSupplierId = '', onCreated, onClose }) {
  const { t } = useI18n();
  const [types, setTypes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [f, setF] = useState({ name: initialName, sku: '', productTypeId: '', supplierId: defaultSupplierId ? String(defaultSupplierId) : '',
    purchaseCost: '', freightCost: '', marginPercent: '30', sellingPrice: '', unit: 'unidad', trackSerials: false, description: '' });
  const [manualPrice, setManualPrice] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/products/types').then(setTypes).catch(() => {});
    api.get('/suppliers').then(setSuppliers).catch(() => {});
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const computed = priceFrom(f.purchaseCost, f.freightCost, f.marginPercent);

  async function save(e) {
    e.preventDefault(); e.stopPropagation();
    if (!f.name.trim()) { setError(t('El nombre es obligatorio')); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...f, name: f.name.trim(), stockQty: '0', sellingPrice: manualPrice ? f.sellingPrice : String(computed) };
      const created = await api.postForm('/products', toFormData(payload));
      const type = types.find((x) => String(x.id) === String(created.product_type_id));
      onCreated({ ...created, product_type_name: type ? type.name : null });
    } catch (err) { setError(err.message); setSaving(false); }
  }

  return createPortal(
    <div style={{ position: 'relative', zIndex: 60 }}>
      <Modal title={t('Nuevo producto')} onClose={onClose} wide>
        <form onSubmit={save} noValidate>
          {error && <div className="error-banner">{error}</div>}
          <div className="grid grid-2">
            <div className="field"><label>{t('Nombre *')}</label><input autoFocus value={f.name} onChange={set('name')} /></div>
            <div className="field"><label>{t('SKU')}</label><input value={f.sku} onChange={set('sku')} /></div>
            <div className="field"><label>{t('Tipo de producto')}</label>
              <ProductTypeSelect types={types} setTypes={setTypes} value={f.productTypeId} onChange={(v) => setF((x) => ({ ...x, productTypeId: v }))} />
            </div>
            <div className="field"><label>{t('Proveedor')}</label>
              <SearchPicker options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))} value={f.supplierId}
                onChange={(v) => setF((x) => ({ ...x, supplierId: v }))} emptyLabel={t('— Sin proveedor —')} placeholder={t('Buscar proveedor…')} />
            </div>
            <div className="field"><label>{t('Precio de compra ($)')}</label><input type="number" step="0.01" value={f.purchaseCost} onChange={set('purchaseCost')} /></div>
            <div className="field"><label>{t('Flete ($)')}</label><input type="number" step="0.01" value={f.freightCost} onChange={set('freightCost')} /></div>
            <div className="field"><label>{t('Margen de ganancia (%)')}</label><input type="number" step="0.1" value={f.marginPercent} onChange={set('marginPercent')} /></div>
            <div className="field"><label>{t('Precio de venta')}</label>
              {manualPrice
                ? <input type="number" step="0.01" value={f.sellingPrice} onChange={set('sellingPrice')} />
                : <input value={`$${computed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} readOnly style={{ fontWeight: 700 }} />}
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, fontSize: 12, marginTop: 4 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={manualPrice} onChange={(e) => { setManualPrice(e.target.checked); if (e.target.checked && !f.sellingPrice) setF((x) => ({ ...x, sellingPrice: String(computed) })); }} /> {t('Poner precio de venta manual')}
              </label>
            </div>
            <div className="field"><label>{t('Unidad')}</label><input value={f.unit} onChange={set('unit')} /></div>
            <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                <input type="checkbox" style={{ width: "auto" }} checked={f.trackSerials} onChange={set('trackSerials')} /> {t('Controla números de serie')}
              </label>
            </div>
          </div>
          <div className="field"><label>{t('Descripción')}</label><textarea rows={2} value={f.description} onChange={set('description')} /></div>
          <div className="muted" style={{ fontSize: 12 }}>{t('Se crea con existencia 0. Las existencias entran con la recepción de compras o desde Inventario.')}</div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('Guardando…') : t('Crear y agregar a la orden')}</button>
          </div>
        </form>
      </Modal>
    </div>,
    document.body,
  );
}
