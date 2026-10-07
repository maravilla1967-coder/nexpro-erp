import React, { useEffect, useState } from 'react';
import { api, toFormData } from '../api.js';
import Modal from '../components/Modal.jsx';

const EMPTY = {
  name: '', sku: '', description: '', productTypeId: '', purchaseCost: '', freightCost: '',
  marginPercent: '30', sellingPrice: '', stockQty: '0', unit: 'unidad', supplierId: '', photoUrl: '',
};

function computePrice(cost, freight, margin) {
  const base = (parseFloat(cost) || 0) + (parseFloat(freight) || 0);
  const m = parseFloat(margin);
  if (!m || m >= 100) return base;
  return Math.round((base / (1 - m / 100)) * 100) / 100;
}

export default function ProductsList() {
  const [list, setList] = useState([]);
  const [types, setTypes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [q, setQ] = useState('');
  const [typeId, setTypeId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [newType, setNewType] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [photoFile, setPhotoFile] = useState(null);
  const [error, setError] = useState('');
  const [overridePrice, setOverridePrice] = useState(false);

  function loadAll() {
    api.get('/products', { q, typeId }).then(setList).catch(console.error);
  }
  function loadLookups() {
    api.get('/products/types').then(setTypes).catch(console.error);
    api.get('/suppliers').then(setSuppliers).catch(console.error);
  }
  useEffect(() => { loadLookups(); }, []);
  useEffect(() => { loadAll(); }, [q, typeId]);

  function openNew() {
    setEditing(null); setForm(EMPTY); setPhotoFile(null); setOverridePrice(false); setError(''); setModalOpen(true);
  }
  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku || '', description: p.description || '', productTypeId: p.product_type_id || '',
      purchaseCost: p.purchase_cost, freightCost: p.freight_cost, marginPercent: p.margin_percent,
      sellingPrice: p.selling_price, stockQty: p.stock_qty, unit: p.unit, supplierId: p.supplier_id || '', photoUrl: p.photo_url || '',
    });
    setPhotoFile(null); setOverridePrice(false); setError(''); setModalOpen(true);
  }

  const computedPrice = computePrice(form.purchaseCost, form.freightCost, form.marginPercent);

  async function save(e) {
    e.preventDefault();
    const payload = { ...form };
    if (!overridePrice) payload.sellingPrice = computedPrice;
    const fd = toFormData(payload);
    if (photoFile) fd.append('photo', photoFile);
    try {
      if (editing) await api.putForm(`/products/${editing.id}`, fd);
      else await api.postForm('/products', fd);
      setModalOpen(false);
      loadAll();
    } catch (err) { setError(err.message); }
  }

  async function remove(id) {
    if (!window.confirm('¿Eliminar este producto?')) return;
    await api.del(`/products/${id}`);
    loadAll();
  }

  async function saveType(e) {
    e.preventDefault();
    if (!newType.trim()) return;
    await api.post('/products/types', { name: newType.trim() });
    setNewType('');
    loadLookups();
  }
  async function deleteType(id) {
    if (!window.confirm('¿Eliminar este tipo de producto?')) return;
    await api.del(`/products/types/${id}`);
    loadLookups();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Inventario</h1>
          <div className="sub">Productos, costos y precios de venta</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setTypeModalOpen(true)}>Tipos de producto</button>
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo producto</button>
        </div>
      </div>
      <div className="content">
        <div className="toolbar">
          <input className="search-input" placeholder="Buscar por nombre o SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 220 }} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Todos los tipos</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="card">
          {list.length === 0 ? (
            <div className="empty-state">No hay productos todavía. Crea el primero con "+ Nuevo producto".</div>
          ) : (
            <table>
              <thead>
                <tr><th></th><th>Nombre</th><th>SKU</th><th>Tipo</th><th>Costo+Flete</th><th>Margen</th><th>Precio venta</th><th>Stock</th><th></th></tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>{p.photo_url ? <img className="thumb" src={p.photo_url} /> : <div className="thumb" />}</td>
                    <td onClick={() => openEdit(p)} className="clickable"><strong>{p.name}</strong></td>
                    <td className="mono muted">{p.sku || '—'}</td>
                    <td className="muted">{p.product_type_name || '—'}</td>
                    <td>${(p.purchase_cost + p.freight_cost).toLocaleString()}</td>
                    <td>{p.margin_percent}%</td>
                    <td><strong>${Number(p.selling_price).toLocaleString()}</strong></td>
                    <td className={p.stock_qty <= 0 ? 'muted' : ''}>{p.stock_qty} {p.unit}</td>
                    <td>
                      <button className="link-btn" onClick={() => openEdit(p)}>Editar</button>{' '}
                      <button className="link-btn" style={{ color: 'var(--red)' }} onClick={() => remove(p.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editing ? 'Editar producto' : 'Nuevo producto'} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div>
                <div className="field"><label>Nombre *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field"><label>SKU</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div className="field"><label>Tipo de producto</label>
                  <select value={form.productTypeId} onChange={(e) => setForm({ ...form, productTypeId: e.target.value })}>
                    <option value="">— Sin tipo —</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>Proveedor</label>
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                    <option value="">— Sin proveedor —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>Foto del artículo</label>
                  <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
                  {form.photoUrl && !photoFile && <img className="thumb-lg" src={form.photoUrl} style={{ marginTop: 8 }} />}
                </div>
                <div className="field"><label>Descripción</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <div>
                <div className="grid grid-2">
                  <div className="field"><label>Precio de compra ($)</label><input type="number" step="0.01" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} /></div>
                  <div className="field"><label>Flete ($)</label><input type="number" step="0.01" value={form.freightCost} onChange={(e) => setForm({ ...form, freightCost: e.target.value })} /></div>
                </div>
                <div className="field">
                  <label>Margen de ganancia (%)</label>
                  <input type="number" step="1" value={form.marginPercent} onChange={(e) => setForm({ ...form, marginPercent: e.target.value })} />
                  <div className="hint">Precio de venta = (Costo + Flete) / (1 − margen). Con 30%, equivale a Costo/.70.</div>
                </div>
                <div className="field">
                  <label>
                    <input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={overridePrice} onChange={(e) => setOverridePrice(e.target.checked)} />
                    Fijar precio de venta manualmente
                  </label>
                  <input
                    type="number" step="0.01" disabled={!overridePrice}
                    value={overridePrice ? form.sellingPrice : computedPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                    style={{ marginTop: 6, fontWeight: 700 }}
                  />
                </div>
                <div className="grid grid-2">
                  <div className="field"><label>Cantidad en stock</label><input type="number" step="0.01" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} /></div>
                  <div className="field"><label>Unidad</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Guardar</button>
            </div>
          </form>
        </Modal>
      )}

      {typeModalOpen && (
        <Modal title="Tipos de producto" onClose={() => setTypeModalOpen(false)}>
          <form onSubmit={saveType} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input placeholder="Nombre del tipo" value={newType} onChange={(e) => setNewType(e.target.value)} />
            <button className="btn btn-primary" type="submit">Agregar</button>
          </form>
          <table>
            <tbody>
              {types.map((t) => (
                <tr key={t.id}><td>{t.name}</td><td style={{ textAlign: 'right' }}><button className="link-btn" onClick={() => deleteType(t.id)}>Eliminar</button></td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
