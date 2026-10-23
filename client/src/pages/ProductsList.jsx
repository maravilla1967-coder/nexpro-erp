import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, toFormData } from '../api.js';
import Modal from '../components/Modal.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
const PRODUCT_COLUMNS = [
  { label: 'Nombre', value: (r) => r.name },
  { label: 'SKU', value: (r) => r.sku, mono: true },
  { label: 'Item # fabricante', value: (r) => r.vendor_item_number, mono: true },
  { label: 'Descripción', value: (r) => r.description },
  { label: 'CA chasis (in)', value: (r) => r.chassis_ca, type: 'number', noTotal: true },
  { label: 'GVWR (lb)', value: (r) => r.gvwr, type: 'number', noTotal: true },
  { label: 'Peso carrocería (lb)', value: (r) => r.body_weight, type: 'number', noTotal: true },
  { label: 'Costo instalación', value: (r) => r.installation_cost, type: 'money', noTotal: true },
  { label: 'Tipo', value: (r) => r.product_type_name },
  { label: 'Proveedor', value: (r) => r.supplier_name },
  { label: 'Costo', value: (r) => r.purchase_cost, type: 'money', noTotal: true },
  { label: 'Flete', value: (r) => r.freight_cost, type: 'money', noTotal: true },
  { label: 'Margen %', value: (r) => r.margin_percent, type: 'number' },
  { label: 'Precio venta', value: (r) => r.selling_price, type: 'money', noTotal: true },
  { label: 'Stock', value: (r) => r.stock_qty, type: 'number' },
  { label: 'Unidad', value: (r) => r.unit },
  { label: 'Valor inventario', value: (r) => ((Number(r.purchase_cost) || 0) + (Number(r.freight_cost) || 0)) * (Number(r.stock_qty) || 0), type: 'money' },
];

const EMPTY = {
  name: '', sku: '', description: '', productTypeId: '', purchaseCost: '', freightCost: '',
  marginPercent: '30', sellingPrice: '', stockQty: '0', unit: 'unidad', supplierId: '', photoUrl: '', trackSerials: false, serials: '',
  vendorItemNumber: '', chassisCa: '', gvwr: '', bodyWeight: '', installationCost: '', vendorStocked: false,
};

// CSV sencillo (soporta comillas). Primera fila = encabezados con los nombres de campo del import.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}
const money = (n) => (n === null || n === undefined ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const inch = (n) => (n === null || n === undefined || n === '' ? '—' : `${Number(n)}"`);
const lbs = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString('en-US'));

function computePrice(cost, freight, margin) {
  const base = (parseFloat(cost) || 0) + (parseFloat(freight) || 0);
  const m = parseFloat(margin);
  if (!m || m >= 100) return base;
  return Math.round((base / (1 - m / 100)) * 100) / 100;
}

export default function ProductsList() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const ex = useListExport({ rows: list });
  // Columnas de carrocería / instalación: solo se muestran si algún producto visible tiene esos datos.
  const showBody = ex.visible.some((p) => p.chassis_ca || p.gvwr || p.body_weight);
  const showInst = ex.visible.some((p) => p.installation_cost);
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
  const [bodyOpen, setBodyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [imp, setImp] = useState({ rows: [], fileName: '', supplierName: 'Reading Truck', productTypeName: 'Reading Bodies', marginPercent: '30', preview: null, done: null, error: '', busy: false });

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
    setEditing(null); setForm(EMPTY); setBodyOpen(false); setPhotoFile(null); setOverridePrice(false); setError(''); setModalOpen(true);
  }
  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku || '', description: p.description || '', productTypeId: p.product_type_id || '',
      purchaseCost: p.purchase_cost, freightCost: p.freight_cost, marginPercent: p.margin_percent,
      sellingPrice: p.selling_price, stockQty: p.stock_qty, unit: p.unit, supplierId: p.supplier_id || '', photoUrl: p.photo_url || '', trackSerials: !!p.track_serials, serials: '',
      vendorItemNumber: p.vendor_item_number || '', chassisCa: p.chassis_ca ?? '', gvwr: p.gvwr ?? '', bodyWeight: p.body_weight ?? '',
      installationCost: p.installation_cost || '', vendorStocked: !!p.vendor_stocked,
    });
    setBodyOpen(!!(p.chassis_ca || p.gvwr || p.body_weight || p.vendor_stocked));
    setPhotoFile(null); setOverridePrice(false); setError(''); setModalOpen(true);
  }

  const computedPrice = computePrice(form.purchaseCost, form.freightCost, form.marginPercent);

  const serialList = [...new Set(String(form.serials || '').split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean))];
  async function save(e) {
    e.preventDefault();
    const payload = { ...form, serials: form.trackSerials ? serialList.join('\n') : '' };
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
    if (!window.confirm(t('¿Eliminar este producto?'))) return;
    await api.del(`/products/${id}`);
    loadAll();
  }

  function openImport() {
    setImp((s) => ({ ...s, rows: [], fileName: '', preview: null, done: null, error: '' }));
    setImportOpen(true);
  }
  async function readImportFile(file) {
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    setImp((s) => ({ ...s, rows, fileName: file.name, preview: null, done: null, error: rows.length ? '' : t('El archivo no tiene filas') }));
  }
  async function runImport(dryRun) {
    setImp((s) => ({ ...s, busy: true, error: '' }));
    try {
      const r = await api.post('/products/import', {
        rows: imp.rows, supplierName: imp.supplierName, productTypeName: imp.productTypeName, marginPercent: imp.marginPercent, dryRun,
      });
      setImp((s) => ({ ...s, busy: false, preview: r, done: r.dryRun ? null : r }));
      if (!r.dryRun) loadAll();
      if (!r.dryRun) loadLookups();
    } catch (err) { setImp((s) => ({ ...s, busy: false, error: err.message })); }
  }

  async function saveType(e) {
    e.preventDefault();
    if (!newType.trim()) return;
    await api.post('/products/types', { name: newType.trim() });
    setNewType('');
    loadLookups();
  }
  async function deleteType(id) {
    if (!window.confirm(t('¿Eliminar este tipo de producto?'))) return;
    await api.del(`/products/types/${id}`);
    loadLookups();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t('Inventario')}</h1>
          <div className="sub">{t('Productos, costos y precios de venta')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setTypeModalOpen(true)}>{t('Tipos de producto')}</button>
          <button className="btn" onClick={openImport}>{t('Importar lista de precios')}</button>
          <button className="btn btn-primary" onClick={openNew}>{t('+ Nuevo producto')}</button>
        </div>
      </div>
      <div className="content">
        <div className="toolbar">
          <input className="search-input" placeholder={t('Buscar por nombre o SKU…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 220 }} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{t('Todos los tipos')}</option>
            {types.map((t2) => <option key={t2.id} value={t2.id}>{t2.name}</option>)}
          </select>
        </div>
        <div className="card">
          {list.length === 0 ? (
            <div className="empty-state">{t('No hay productos todavía. Crea el primero con "+ Nuevo producto".')}</div>
          ) : (
            <><ListExportBar ex={ex} title={t('Inventario')} filename="inventario" columns={PRODUCT_COLUMNS} />
            <table>
              <thead>
                <tr><th><SelectAllBox ex={ex} /></th><th></th><th>{t('Nombre')}</th><th>{t('SKU')}</th><th>{t('Tipo')}</th>{showBody && <th>{t('CA / GVWR / Peso')}</th>}<th>{t('Costo+Flete')}</th>{showInst && <th>{t('Instalación')}</th>}<th>{t('Margen')}</th><th>{t('Precio venta')}</th><th>{t('Stock')}</th><th></th></tr>
              </thead>
              <tbody>
                {ex.visible.map((p) => (
                  <tr key={p.id}>
                    <td><RowBox ex={ex} row={p} /></td>
                    <td>{p.photo_url ? <img className="thumb" src={p.photo_url} /> : <div className="thumb" />}</td>
                    <td onClick={() => openEdit(p)} className="clickable"><strong>{p.name}</strong>{p.description ? <div className="muted" style={{ fontSize: 12 }}>{p.description}</div> : null}{p.vendor_stocked ? <div className="muted" style={{ fontSize: 12 }}>✓ {t('Configuración fija')}</div> : null}</td>
                    <td className="mono muted">{p.sku || '—'}</td>
                    <td className="muted">{p.product_type_name || '—'}</td>
                    {showBody && <td className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{p.chassis_ca || p.gvwr || p.body_weight ? <>CA {inch(p.chassis_ca)}<br />GVWR {lbs(p.gvwr)}<br />{t('Peso')} {lbs(p.body_weight)} lb</> : '—'}</td>}
                    <td>${(p.purchase_cost + p.freight_cost).toLocaleString()}</td>
                    {showInst && <td className="muted">{p.installation_cost ? '$' + Number(p.installation_cost).toLocaleString() : '—'}</td>}
                    <td>{p.margin_percent}%</td>
                    <td><strong>${Number(p.selling_price).toLocaleString()}</strong></td>
                    <td className={p.stock_qty <= 0 ? 'muted' : ''}>{p.stock_qty} {p.unit}{p.track_serials ? <div><Link className="muted" style={{ fontSize: 12 }} to={`/seriales?producto=${p.id}`}>🔢 {p.serials_available} {t('seriales disp.')}</Link></div> : null}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-row-action edit" onClick={() => openEdit(p)}>{t('Editar')}</button>
                        <button className="btn-row-action delete" onClick={() => remove(p.id)}>{t('Eliminar')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editing ? t('Editar producto') : t('Nuevo producto')} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div>
                <div className="field"><label>{t('Nombre *')}</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field"><label>{t('SKU')}</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
                <div className="field"><label>{t('Tipo de producto')}</label>
                  <select value={form.productTypeId} onChange={(e) => setForm({ ...form, productTypeId: e.target.value })}>
                    <option value="">{t('— Sin tipo —')}</option>
                    {types.map((t2) => <option key={t2.id} value={t2.id}>{t2.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>{t('Proveedor')}</label>
                  <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                    <option value="">{t('— Sin proveedor —')}</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="field"><label>{t('Foto del artículo')}</label>
                  <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files[0])} />
                  {form.photoUrl && !photoFile && <img className="thumb-lg" src={form.photoUrl} style={{ marginTop: 8 }} />}
                </div>
                <div className="field"><label>{t('Descripción')}</label><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                  <div className="field"><label>{t('Item # del fabricante')}</label><input className="mono" value={form.vendorItemNumber} onChange={(e) => setForm({ ...form, vendorItemNumber: e.target.value })} /></div>
                  <div className="field"><label>{t('Costo de instalación ($)')}</label><input type="number" step="0.01" value={form.installationCost} onChange={(e) => setForm({ ...form, installationCost: e.target.value })} /></div>
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: '#f8fafc' }}>
                  <button type="button" onClick={() => setBodyOpen(!bodyOpen)}
                    style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 10px', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'inherit' }}>
                    {bodyOpen ? '▾' : '▸'} {t('Datos de carrocería (CA, GVWR, peso)')}
                  </button>
                  {bodyOpen && (
                    <div style={{ padding: '0 10px 8px' }}>
                      <div className="grid grid-2">
                        <div className="field"><label>{t('CA del chasis (pulgadas)')}</label><input type="number" step="0.1" value={form.chassisCa} onChange={(e) => setForm({ ...form, chassisCa: e.target.value })} /></div>
                        <div className="field"><label>{t('GVWR del chasis (lb)')}</label><input type="number" step="1" value={form.gvwr} onChange={(e) => setForm({ ...form, gvwr: e.target.value })} /></div>
                        <div className="field"><label>{t('Peso de la carrocería (lb)')}</label><input type="number" step="1" value={form.bodyWeight} onChange={(e) => setForm({ ...form, bodyWeight: e.target.value })} /></div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <input type="checkbox" style={{ width: 'auto' }} checked={!!form.vendorStocked} onChange={(e) => setForm({ ...form, vendorStocked: e.target.checked })} />
                        {t('Configuración fija (Fixed Configuration) — se ordena tal cual')}
                      </label>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <div className="grid grid-2">
                  <div className="field"><label>{t('Precio de compra ($)')}</label><input type="number" step="0.01" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} /></div>
                  <div className="field"><label>{t('Flete ($)')}</label><input type="number" step="0.01" value={form.freightCost} onChange={(e) => setForm({ ...form, freightCost: e.target.value })} /></div>
                </div>
                <div className="field">
                  <label>{t('Margen de ganancia (%)')}</label>
                  <input type="number" step="1" value={form.marginPercent} onChange={(e) => setForm({ ...form, marginPercent: e.target.value })} />
                  <div className="hint">{t('Precio de venta = (Costo + Flete) / (1 − margen). Con 30%, equivale a Costo/.70.')}</div>
                </div>
                <div className="field">
                  <label>
                    <input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={overridePrice} onChange={(e) => setOverridePrice(e.target.checked)} />
                    {t('Fijar precio de venta manualmente')}
                  </label>
                  <input
                    type="number" step="0.01" disabled={!overridePrice}
                    value={overridePrice ? form.sellingPrice : computedPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                    style={{ marginTop: 6, fontWeight: 700 }}
                  />
                </div>
                <div className="grid grid-2">
                  <div className="field"><label>{t('Cantidad en stock')}</label><input type="number" step="0.01" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} /></div>
                  <div className="field"><label>{t('Unidad')}</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 6 }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={!!form.trackSerials} onChange={(e) => setForm({ ...form, trackSerials: e.target.checked })} />
                  {t('Maneja números de serie (cada unidad con su serial: grúas, compresores, buckets…)')}
                </label>
                {form.trackSerials && (
                  <div className="field" style={{ marginTop: 8, background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                    <label>{editing ? t('Agregar números de serie') : t('Números de serie de las unidades que ya tienes')} <span className="muted" style={{ fontWeight: 400 }}>({serialList.length})</span></label>
                    {editing && editing.serials_available > 0 && <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t('Ya registrados y disponibles:')} {editing.serials_available} · <Link to={`/seriales?producto=${editing.id}`}>{t('ver seriales')}</Link></div>}
                    <textarea rows={4} className="mono" placeholder={t('Un serial por línea (sirve un lector de código de barras)')} value={form.serials} onChange={(e) => setForm({ ...form, serials: e.target.value })} />
                    <div className="hint">{t('Opcional. Los que lleguen en una orden de compra se piden al recibirla. El stock nunca queda por debajo de las unidades con serial disponibles.')}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}

      {importOpen && (
        <Modal title={t('Importar lista de precios')} onClose={() => setImportOpen(false)} wide>
          {imp.error && <div className="error-banner">{imp.error}</div>}
          <div className="hint" style={{ marginBottom: 10, fontSize: 13 }}>{t('Archivo CSV con columnas: sku, name, vendorItemNumber, description, chassisCa, gvwr, bodyWeight, purchaseCost, installationCost, vendorStocked, trackSerials. Se empata por SKU: si ya existe se actualiza, si no se crea. Primero se muestra una vista previa; nada se guarda hasta que confirmes.')}</div>
          <div className="grid grid-2">
            <div className="field"><label>{t('Archivo CSV')}</label><input type="file" accept=".csv,text/csv" onChange={(e) => readImportFile(e.target.files[0])} /></div>
            <div className="field"><label>{t('Margen de ganancia (%)')}</label><input type="number" value={imp.marginPercent} onChange={(e) => setImp({ ...imp, marginPercent: e.target.value, preview: null })} /></div>
            <div className="field"><label>{t('Proveedor')}</label><input value={imp.supplierName} onChange={(e) => setImp({ ...imp, supplierName: e.target.value, preview: null })} /></div>
            <div className="field"><label>{t('Tipo de producto')}</label><input value={imp.productTypeName} onChange={(e) => setImp({ ...imp, productTypeName: e.target.value, preview: null })} /></div>
          </div>
          {imp.rows.length > 0 && !imp.preview && (
            <button className="btn btn-primary" disabled={imp.busy} onClick={() => runImport(true)}>{t('Ver vista previa')} ({imp.rows.length})</button>
          )}
          {imp.preview && (
            <>
              <div style={{ margin: '10px 0', fontSize: 13 }}>
                {imp.done ? <strong>✅ {t('Importado')}: </strong> : <strong>{t('Vista previa')}: </strong>}
                {imp.preview.summary.crear} {t('nuevos')} · {imp.preview.summary.actualizar} {t('a actualizar')} · {imp.preview.summary.error} {t('con error')}
                {imp.preview.summary.renamed ? <> · {imp.preview.summary.renamed} {t('con SKU nuevo')}</> : null}
                {' · '}{t('Proveedor')}: {imp.preview.summary.supplier || '—'} · {t('Tipo')}: {(imp.preview.summary.productTypes && imp.preview.summary.productTypes.length ? imp.preview.summary.productTypes.join(', ') : imp.preview.summary.productType) || '—'} · {t('Margen')} {imp.preview.summary.marginPercent}%
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr><th>#</th><th>{t('Acción')}</th><th>{t('Nombre')}</th><th>{t('SKU')}</th><th>{t('Descripción')}</th><th>CA</th><th>GVWR</th><th>{t('Peso')}</th><th>{t('Costo')}</th><th>{t('Precio venta')}</th><th>{t('Instalación')}</th><th>{t('Fija')}</th><th>{t('Seriales')}</th></tr></thead>
                  <tbody>
                    {imp.preview.results.map((r) => (
                      <tr key={r.row}>
                        <td className="muted">{r.row}</td>
                        <td>{r.action === 'error' ? <span style={{ color: '#b91c1c' }}>{r.errors.join(', ')}</span> : r.action === 'crear' ? t('Crear') : <>{t('Actualizar')}{r.previousCost !== null && r.previousCost !== r.purchaseCost ? <div className="muted" style={{ fontSize: 11 }}>{money(r.previousCost)} → {money(r.purchaseCost)}</div> : null}</>}</td>
                        <td><strong>{r.name}</strong></td>
                        <td className="mono muted">{r.sku}{r.renamedFrom ? <div style={{ fontSize: 11 }}>{t('antes')}: {r.renamedFrom}</div> : null}</td>
                        <td style={{ fontSize: 12 }}>{r.description}</td>
                        <td>{inch(r.chassisCa)}</td>
                        <td>{lbs(r.gvwr)}</td>
                        <td>{lbs(r.bodyWeight)}</td>
                        <td>{money(r.purchaseCost)}</td>
                        <td><strong>{money(r.sellingPrice)}</strong></td>
                        <td>{money(r.installationCost)}</td>
                        <td>{r.vendorStocked ? '✓' : '—'}</td>
                        <td>{r.trackSerials ? t('Sí') : t('No')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="modal-footer">
            <button type="button" className="btn" onClick={() => setImportOpen(false)}>{imp.done ? t('Cerrar') : t('Cancelar')}</button>
            {imp.preview && !imp.done && imp.preview.summary.error === 0 && (
              <button className="btn btn-primary" disabled={imp.busy} onClick={() => runImport(false)}>{t('Confirmar e importar')} ({imp.preview.results.length})</button>
            )}
          </div>
        </Modal>
      )}

      {typeModalOpen && (
        <Modal title={t('Tipos de producto')} onClose={() => setTypeModalOpen(false)}>
          <form onSubmit={saveType} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input placeholder={t('Nombre del tipo')} value={newType} onChange={(e) => setNewType(e.target.value)} />
            <button className="btn btn-primary" type="submit">{t('Agregar')}</button>
          </form>
          <table>
            <tbody>
              {types.map((t2) => (
                <tr key={t2.id}><td>{t2.name}</td><td style={{ textAlign: 'right' }}><button className="btn-row-action delete" onClick={() => deleteType(t2.id)}>{t('Eliminar')}</button></td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}
