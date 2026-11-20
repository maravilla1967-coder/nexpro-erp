import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';

// Inventario vendido: lo que salió por factura (no anulada), agrupable por tipo (grupo) o por
// producto (modelo), o en detalle venta por venta. Útil para saber qué se ha vendido de un
// grupo/modelo sin tener que revisar factura por factura.
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROW_COLUMNS = [
  { label: 'Fecha', value: (r) => r.issue_date },
  { label: 'Factura', value: (r) => r.invoice_number },
  { label: 'Cliente', value: (r) => r.customer_name },
  { label: 'Producto', value: (r) => r.product_name },
  { label: 'SKU', value: (r) => r.sku, mono: true },
  { label: 'Tipo', value: (r) => r.product_type_name },
  { label: 'Cantidad', value: (r) => r.quantity, type: 'number' },
  { label: 'Precio unit.', value: (r) => r.unit_price, type: 'money', noTotal: true },
  { label: 'Total', value: (r) => r.total, type: 'money' },
];

export default function SoldProductsReport() {
  const { t } = useI18n();
  const [types, setTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [typeId, setTypeId] = useState('');
  const [productId, setProductId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState('tipo'); // tipo | producto | detalle
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/products/types').then(setTypes).catch(() => {});
    api.get('/products').then(setProducts).catch(() => {});
  }, []);

  useEffect(() => {
    const params = {};
    if (typeId) params.productTypeId = typeId;
    if (productId) params.productId = productId;
    if (from) params.from = from;
    if (to) params.to = to;
    if (q) params.q = q;
    api.get('/products/sold-report', params).then(setData).catch(() => setData({ rows: [], byProduct: [], byType: [], totals: { quantity: 0, total: 0, sales: 0 } }));
  }, [typeId, productId, from, to, q]);

  const productsForType = useMemo(() => (typeId ? products.filter((p) => String(p.product_type_id) === String(typeId)) : products), [products, typeId]);

  const ex = useListExport({ rows: data ? data.rows : [] });

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t('Inventario vendido')}</h1>
          <div className="sub">{t('Lo que se ha facturado, agrupado por tipo (grupo) o por producto (modelo)')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/inventario" className="btn">📦 {t('Inventario disponible')}</Link>
          <Link to="/productos" className="btn">🏷️ {t('Catálogo de productos')}</Link>
        </div>
      </div>
      <div className="content">
        <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
          {[
            [t('Ventas (líneas)'), data ? data.totals.sales.toLocaleString() : '—'],
            [t('Unidades vendidas'), data ? data.totals.quantity.toLocaleString() : '—'],
            [t('Total facturado'), data ? money(data.totals.total) : '—'],
          ].map(([label, val]) => (
            <div key={label} className="card" style={{ padding: '12px 14px' }}>
              <div className="muted" style={{ fontSize: 12 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{val}</div>
            </div>
          ))}
        </div>

        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <select style={{ width: 200 }} value={typeId} onChange={(e) => { setTypeId(e.target.value); setProductId(''); }}>
            <option value="">{t('Todos los tipos (grupo)')}</option>
            {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select style={{ width: 240 }} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{t('Todos los productos (modelo)')}</option>
            {productsForType.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title={t('Desde')} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title={t('Hasta')} />
          <input className="search-input" placeholder={t('Buscar producto, SKU o cliente…')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="tabs" style={{ marginBottom: 10 }}>
          <button type="button" className={view === 'tipo' ? 'tab active' : 'tab'} onClick={() => setView('tipo')}>{t('Por tipo (grupo)')}</button>
          <button type="button" className={view === 'producto' ? 'tab active' : 'tab'} onClick={() => setView('producto')}>{t('Por producto (modelo)')}</button>
          <button type="button" className={view === 'detalle' ? 'tab active' : 'tab'} onClick={() => setView('detalle')}>{t('Detalle de ventas')}</button>
        </div>

        <div className="card">
          {!data ? <div className="empty-state">{t('Cargando…')}</div> : view === 'tipo' ? (
            data.byType.length === 0 ? <div className="empty-state">{t('No hay ventas con ese filtro.')}</div> : (
              <table>
                <thead><tr><th>{t('Tipo (grupo)')}</th><th className="text-right">{t('Ventas')}</th><th className="text-right">{t('Unidades')}</th><th className="text-right">{t('Total facturado')}</th></tr></thead>
                <tbody>
                  {data.byType.map((r) => (
                    <tr key={r.product_type_id || 'sin-tipo'} className="clickable" onClick={() => { setTypeId(r.product_type_id || ''); setView('producto'); }}>
                      <td><strong>{r.product_type_name}</strong></td>
                      <td className="text-right">{r.sales.toLocaleString()}</td>
                      <td className="text-right">{r.quantity.toLocaleString()}</td>
                      <td className="text-right"><strong>{money(r.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : view === 'producto' ? (
            data.byProduct.length === 0 ? <div className="empty-state">{t('No hay ventas con ese filtro.')}</div> : (
              <table>
                <thead><tr><th>{t('Producto (modelo)')}</th><th>{t('SKU')}</th><th>{t('Tipo')}</th><th className="text-right">{t('Ventas')}</th><th className="text-right">{t('Unidades')}</th><th className="text-right">{t('Total facturado')}</th></tr></thead>
                <tbody>
                  {data.byProduct.map((r) => (
                    <tr key={r.product_id || r.product_name} className={r.product_id ? 'clickable' : ''} onClick={() => { if (r.product_id) { setProductId(r.product_id); setView('detalle'); } }}>
                      <td><strong>{r.product_name}</strong></td>
                      <td className="mono muted" style={{ fontSize: 12 }}>{r.sku || '—'}</td>
                      <td className="muted">{r.product_type_name || '—'}</td>
                      <td className="text-right">{r.sales.toLocaleString()}</td>
                      <td className="text-right">{r.quantity.toLocaleString()}</td>
                      <td className="text-right"><strong>{money(r.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            data.rows.length === 0 ? <div className="empty-state">{t('No hay ventas con ese filtro.')}</div> : (
              <>
                <ListExportBar ex={ex} title={t('Inventario vendido — detalle')} filename="inventario-vendido" columns={ROW_COLUMNS} />
                <table>
                  <thead>
                    <tr>
                      <th><SelectAllBox ex={ex} /></th>
                      <th>{t('Fecha')}</th><th>{t('Factura')}</th><th>{t('Cliente')}</th><th>{t('Producto')}</th>
                      <th className="text-right">{t('Cantidad')}</th><th className="text-right">{t('Precio unit.')}</th><th className="text-right">{t('Total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.visible.map((r) => (
                      <tr key={r.id}>
                        <td><RowBox ex={ex} row={r} /></td>
                        <td className="muted">{r.issue_date ? String(r.issue_date).slice(0, 10) : '—'}</td>
                        <td><Link to={`/facturas/${r.invoice_id}`}>{r.invoice_number}</Link></td>
                        <td>{r.customer_name}</td>
                        <td>
                          <strong>{r.product_name}</strong>
                          {r.sku ? <div className="muted mono" style={{ fontSize: 12 }}>{r.sku}</div> : null}
                        </td>
                        <td className="text-right">{Number(r.quantity).toLocaleString()}</td>
                        <td className="text-right">{money(r.unit_price)}</td>
                        <td className="text-right"><strong>{money(r.total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )
          )}
        </div>
      </div>
    </>
  );
}
