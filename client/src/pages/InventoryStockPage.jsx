import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';

// Inventario disponible: solo lo que hay físicamente en bodega (existencia distinta de cero).
// El catálogo completo de productos que se pueden vender está en /productos.
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const squash = (s) => fold(s).replace(/[\s\-_.\/"″]+/g, '');
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const unitCost = (p) => (Number(p.purchase_cost) || 0) + (Number(p.freight_cost) || 0);

const COLUMNS = [
  { label: 'Producto', value: (r) => r.name },
  { label: 'Descripción', value: (r) => r.description },
  { label: 'SKU', value: (r) => r.sku, mono: true },
  { label: 'Tipo', value: (r) => r.product_type_name },
  { label: 'Proveedor', value: (r) => r.supplier_name },
  { label: 'Existencia', value: (r) => r.stock_qty, type: 'number' },
  { label: 'Seriales disponibles', value: (r) => (r.track_serials ? r.serials_list : ''), mono: true },
  { label: 'Costo unit.', value: (r) => unitCost(r), type: 'money', noTotal: true },
  { label: 'Valor al costo', value: (r) => unitCost(r) * (Number(r.stock_qty) || 0), type: 'money' },
  { label: 'Precio venta', value: (r) => r.selling_price, type: 'money', noTotal: true },
  { label: 'Valor a precio de venta', value: (r) => (Number(r.selling_price) || 0) * (Number(r.stock_qty) || 0), type: 'money' },
];

export default function InventoryStockPage() {
  const { t } = useI18n();
  const [all, setAll] = useState(null);
  const [types, setTypes] = useState([]);
  const [q, setQ] = useState('');
  const [typeId, setTypeId] = useState('');
  const [sort, setSort] = useState('name');

  const [expandedId, setExpandedId] = useState(null);
  const [serialsByProduct, setSerialsByProduct] = useState({});
  const [serialsAll, setSerialsAll] = useState({});

  function toggleSerials(p) {
    if (expandedId === p.id) { setExpandedId(null); return; }
    setExpandedId(p.id);
    if (!serialsByProduct[p.id]) {
      api.get('/serials', { productId: p.id, status: 'disponible' })
        .then((list) => setSerialsByProduct((c) => ({ ...c, [p.id]: list })))
        .catch(() => setSerialsByProduct((c) => ({ ...c, [p.id]: [] })));
    }
  }

  useEffect(() => {
    api.get('/products').then(setAll).catch(() => setAll([]));
    api.get('/products/types').then(setTypes).catch(() => {});
  }, []);

  useEffect(() => {
    if (!all || !all.length) return;
    const ids = all.filter((p) => p.track_serials).map((p) => p.id);
    if (!ids.length) { setSerialsAll({}); return; }
    api.get('/serials', { status: 'disponible', productIds: ids.join(',') })
      .then((list) => {
        const map = {};
        (list || []).forEach((s) => { (map[s.product_id] = map[s.product_id] || []).push(s.serial); });
        setSerialsAll(map);
      })
      .catch(() => {});
  }, [all]);

  const inStock = useMemo(
    () => (all || [])
      .filter((p) => Math.abs(Number(p.stock_qty) || 0) > 0.0001)
      .map((p) => ({ ...p, serials_list: (serialsAll[p.id] || []).join(', ') })),
    [all, serialsAll]
  );

  const rows = useMemo(() => {
    let r = inStock;
    if (typeId) r = r.filter((p) => String(p.product_type_id) === String(typeId));
    const s = q.trim();
    if (s) {
      const terms = fold(s).split(/\s+/);
      const flat = squash(s);
      r = r.filter((p) => {
        const text = [p.name, p.sku, p.vendor_item_number, p.description, p.product_type_name, p.supplier_name].filter(Boolean).join(' ');
        return (flat.length >= 3 && squash(text).includes(flat)) || terms.every((w) => fold(text).includes(w));
      });
    }
    const by = {
      name: (a, b) => String(a.name).localeCompare(String(b.name)),
      qty: (a, b) => Number(b.stock_qty) - Number(a.stock_qty),
      value: (a, b) => unitCost(b) * b.stock_qty - unitCost(a) * a.stock_qty,
      type: (a, b) => String(a.product_type_name || '').localeCompare(String(b.product_type_name || '')) || String(a.name).localeCompare(String(b.name)),
    }[sort];
    return [...r].sort(by);
  }, [inStock, typeId, q, sort]);

  const ex = useListExport({ rows });
  const totals = useMemo(() => {
    const v = ex.visible;
    return {
      items: v.length,
      units: v.reduce((s, p) => s + (Number(p.stock_qty) || 0), 0),
      cost: v.reduce((s, p) => s + unitCost(p) * (Number(p.stock_qty) || 0), 0),
      retail: v.reduce((s, p) => s + (Number(p.selling_price) || 0) * (Number(p.stock_qty) || 0), 0),
      negative: v.filter((p) => Number(p.stock_qty) < 0).length,
    };
  }, [ex.visible]);
  const typesInStock = useMemo(() => {
    const ids = new Set(inStock.map((p) => String(p.product_type_id)));
    return types.filter((x) => ids.has(String(x.id)));
  }, [types, inStock]);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t('Inventario')}</h1>
          <div className="sub">{t('Lo que hay disponible en bodega — solo artículos con existencia')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/inventario/vendido" className="btn">📤 {t('Inventario vendido')}</Link>
          <Link to="/productos" className="btn">🏷️ {t('Catálogo de productos')}</Link>
          <Link to="/compras" className="btn">🛒 {t('Órdenes de Compra')}</Link>
        </div>
      </div>
      <div className="content">
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          {[
            [t('Artículos con existencia'), totals.items.toLocaleString()],
            [t('Unidades en bodega'), totals.units.toLocaleString()],
            [t('Valor al costo'), money(totals.cost)],
            [t('Valor a precio de venta'), money(totals.retail)],
          ].map(([label, val]) => (
            <div key={label} className="card" style={{ padding: '12px 14px' }}>
              <div className="muted" style={{ fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{val}</div>
            </div>
          ))}
        </div>

        <div className="toolbar">
          <input className="search-input" placeholder={t('Buscar en el inventario (nombre, SKU, Item #, descripción)…')} value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ width: 200 }} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">{t('Todos los tipos')}</option>
            {typesInStock.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select style={{ width: 190 }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">{t('Ordenar: nombre')}</option>
            <option value="type">{t('Ordenar: tipo')}</option>
            <option value="qty">{t('Ordenar: más existencia')}</option>
            <option value="value">{t('Ordenar: mayor valor')}</option>
          </select>
        </div>

        {totals.negative > 0 && (
          <div className="error-banner" style={{ marginBottom: 10 }}>
            ⚠️ {totals.negative} {t('artículo(s) con existencia negativa: se vendió más de lo que entró. Revisa las recepciones de esas compras.')}
          </div>
        )}

        <div className="card">
          {all === null ? <div className="empty-state">{t('Cargando…')}</div> : rows.length === 0 ? (
            <div className="empty-state">{q || typeId ? t('Nada en existencia con ese filtro.') : t('No hay nada en existencia. Lo que se recibe en las órdenes de compra aparece aquí.')}</div>
          ) : (
            <>
              <ListExportBar ex={ex} title={t('Inventario disponible')} filename="inventario-disponible" columns={COLUMNS} />
              <table>
                <thead>
                  <tr>
                    <th><SelectAllBox ex={ex} /></th>
                    <th>{t('Producto')}</th><th>{t('SKU')}</th><th>{t('Tipo')}</th>
                    <th className="text-right">{t('Existencia')}</th>
                    <th className="text-right">{t('Costo unit.')}</th><th className="text-right">{t('Valor al costo')}</th>
                    <th className="text-right">{t('Precio venta')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ex.visible.map((p) => (
                    <React.Fragment key={p.id}>
                    <tr style={Number(p.stock_qty) < 0 ? { background: '#fef2f2' } : null}>
                      <td><RowBox ex={ex} row={p} /></td>
                      <td>
                        <Link to={`/productos?q=${encodeURIComponent(p.sku || p.name)}`}><strong>{p.name}</strong></Link>
                        {p.description && p.description !== p.name ? <div className="muted" style={{ fontSize: 12 }}>{p.description.length > 110 ? p.description.slice(0, 110) + '…' : p.description}</div> : null}
                      </td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{p.sku || '—'}</td>
                      <td className="muted">{p.product_type_name || '—'}</td>
                      <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        <strong style={{ fontSize: 15, color: Number(p.stock_qty) < 0 ? '#b91c1c' : undefined }}>{Number(p.stock_qty).toLocaleString()}</strong> <span className="muted">{p.unit && p.unit !== 'unidad' ? p.unit : ''}</span>
                        {p.track_serials ? (
                          <div>
                            <button type="button" className="link-btn" style={{ fontSize: 12 }} onClick={() => toggleSerials(p)}>
                              🔢 {p.serials_available} {t('seriales disp.')} {expandedId === p.id ? '▲' : '▼'}
                            </button>
                          </div>
                        ) : null}
                      </td>
                      <td className="text-right">{money(unitCost(p))}</td>
                      <td className="text-right"><strong>{money(unitCost(p) * Number(p.stock_qty))}</strong></td>
                      <td className="text-right">{money(p.selling_price)}</td>
                    </tr>
                    {expandedId === p.id && (
                      <tr>
                        <td colSpan={8} style={{ background: '#f8fafc', padding: '10px 14px' }}>
                          {!serialsByProduct[p.id] ? (
                            <span className="muted">{t('Cargando seriales…')}</span>
                          ) : serialsByProduct[p.id].length === 0 ? (
                            <span className="muted">{t('No hay seriales disponibles registrados para este producto.')}</span>
                          ) : (
                            <>
                              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                                {t('Seriales disponibles para contar')} ({serialsByProduct[p.id].length}){Number(p.stock_qty) !== serialsByProduct[p.id].length ? (
                                  <strong style={{ color: '#b91c1c', marginLeft: 8 }}>⚠️ {t('no coincide con la existencia')} ({Number(p.stock_qty)})</strong>
                                ) : null}
                                {' · '}<Link to={`/seriales?producto=${p.id}`}>{t('ver historial completo')}</Link>
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {serialsByProduct[p.id].map((s) => (
                                  <span key={s.id} className="mono" style={{ background: '#fff', border: '1px solid var(--border, #e2e8f0)', borderRadius: 4, padding: '2px 8px', fontSize: 13 }}>{s.serial}</span>
                                ))}
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </>
  );
}
