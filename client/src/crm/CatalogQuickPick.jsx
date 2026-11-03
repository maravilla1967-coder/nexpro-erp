import React, { useMemo, useState } from 'react';
import { useI18n, pickLang } from '../i18n.jsx';
import { api } from '../api.js';
import { money } from './constants.js';

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const squash = (s) => fold(s).replace(/[\s\-_./"'()]+/g, '');

// Escoger lo que busca el cliente con clics, sin escribir: tipos de equipo (grúa, bucket lift,
// compresor…), servicios del catálogo, o productos por categoría. El buscador queda como atajo
// para ir directo a un producto concreto (nombre, SKU, Item # del fabricante).
// value: [{ kind, productId, serviceId, productTypeId, equipmentTypeId, description, quantity }]
export default function CatalogQuickPick({ catalog, value, onChange, onCatalogChange }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState('equipos');
  const [typeId, setTypeId] = useState(null);
  const [q, setQ] = useState('');
  const [free, setFree] = useState('');
  const [saveAs, setSaveAs] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const keyOf = (i) => `${i.kind}:${i.productId || i.serviceId || i.equipmentTypeId || i.productTypeId || i.description}`;
  const chosen = new Set(value.map(keyOf));
  const toggle = (item) => {
    const k = keyOf(item);
    if (chosen.has(k)) onChange(value.filter((i) => keyOf(i) !== k));
    else onChange([...value, { quantity: 1, ...item }]);
  };

  const products = catalog ? catalog.products : [];
  const searchResults = useMemo(() => {
    const s = q.trim();
    if (!s) return [];
    const terms = fold(s).split(/\s+/).filter(Boolean); const flat = squash(s);
    return products.filter((p) => {
      const txt = fold([p.name, p.sku, p.vendor_item_number, p.description].filter(Boolean).join(' '));
      return terms.every((w) => txt.includes(w)) || (flat.length >= 3 && squash(txt).includes(flat));
    }).slice(0, 40);
  }, [q, products]);
  const typeProducts = useMemo(() => (typeId ? products.filter((p) => p.product_type_id === typeId) : []), [typeId, products]);

  async function addFree() {
    const name = free.trim();
    if (!name) return;
    setAddError('');
    if (!saveAs) { onChange([...value, { kind: 'libre', description: name, quantity: 1 }]); setFree(''); return; }
    setAdding(true);
    try {
      const item = await api.post('/crm/catalog-item', { kind: saveAs, name, productTypeId: saveAs === 'producto' ? typeId : undefined });
      const { existed, ...pick } = item;
      if (!chosen.has(keyOf(pick))) onChange([...value, { quantity: 1, ...pick }]);
      setFree(''); setSaveAs('');
      onCatalogChange && onCatalogChange();
      setTab(pick.kind === 'equipo' ? 'equipos' : pick.kind === 'servicio' ? 'servicios' : tab);
    } catch (e) { setAddError(e.message); } finally { setAdding(false); }
  }

  if (!catalog) return <div className="muted">{t('Cargando…')}</div>;

  const Chip = ({ item, label, hint }) => {
    const on = chosen.has(keyOf(item));
    return (
      <button type="button" className={`qp-chip ${on ? 'on' : ''}`} onClick={() => toggle(item)} title={hint || ''}>
        {on ? '✓ ' : '+ '}{label}
      </button>
    );
  };
  const ProductRow = ({ p }) => {
    const item = { kind: 'producto', productId: p.id, description: p.name };
    const on = chosen.has(keyOf(item));
    return (
      <div className={`qp-row ${on ? 'on' : ''}`} onClick={() => toggle(item)}>
        <span className="qp-check">{on ? '✓' : '+'}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <strong>{p.name}</strong>
          <span className="muted" style={{ fontSize: 11.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[p.sku, p.description].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="muted" style={{ fontSize: 12 }}>{p.selling_price ? money(p.selling_price) : ''}</span>
      </div>
    );
  };

  return (
    <div className="qp">
      <div className="qp-tabs">
        {[['equipos', t('Equipos')], ['servicios', t('Servicios')], ['productos', t('Productos')], ['buscar', t('🔎 Buscar')]].map(([k, l]) => (
          <button key={k} type="button" className={`qp-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'equipos' && (
        <div className="qp-chips">
          {catalog.equipmentTypes.map((e) => <Chip key={e.id} item={{ kind: 'equipo', equipmentTypeId: e.id, description: e.name }} label={e.name} />)}
        </div>
      )}
      {tab === 'servicios' && (
        <div className="qp-chips">
          {catalog.services.map((s) => {
            const name = pickLang(s.name, s.name_en, lang);
            const price = s.pricing_type === 'hora' ? `${money(s.hourly_rate)}/h` : money(s.flat_price);
            return <Chip key={s.id} item={{ kind: 'servicio', serviceId: s.id, description: s.name }} label={name} hint={`${s.description || ''} ${price}`} />;
          })}
        </div>
      )}
      {tab === 'productos' && (
        <>
          <div className="qp-chips">
            {catalog.productTypes.filter((pt) => pt.count > 0).map((pt) => (
              <button key={pt.id} type="button" className={`qp-chip cat ${typeId === pt.id ? 'on' : ''}`} onClick={() => setTypeId(typeId === pt.id ? null : pt.id)}>
                {pt.name} <span className="muted">({pt.count})</span>
              </button>
            ))}
          </div>
          {typeId && (
            <>
              <div style={{ margin: '6px 0' }}>
                <Chip item={{ kind: 'categoria', productTypeId: typeId, description: (catalog.productTypes.find((x) => x.id === typeId) || {}).name }}
                  label={`${t('Toda la categoría')}: ${(catalog.productTypes.find((x) => x.id === typeId) || {}).name} (${t('aún no sabe el modelo')})`} />
              </div>
              <div className="qp-list">{typeProducts.map((p) => <ProductRow key={p.id} p={p} />)}</div>
            </>
          )}
        </>
      )}
      {tab === 'buscar' && (
        <>
          <input autoFocus placeholder={t('Nombre, SKU o Item # del fabricante…')} value={q} onChange={(e) => setQ(e.target.value)} />
          {q.trim() && (
            <div className="qp-list" style={{ marginTop: 6 }}>
              {searchResults.length === 0 && <div className="muted" style={{ padding: 8 }}>{t('Sin resultados')}</div>}
              {searchResults.map((p) => <ProductRow key={p.id} p={p} />)}
            </div>
          )}
        </>
      )}
      <div className="qp-add">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input style={{ flex: '1 1 220px' }} placeholder={t('¿No está en la lista? Escríbelo aquí…')} value={free} onChange={(e) => setFree(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFree(); } }} />
          <select style={{ flex: '0 1 230px' }} value={saveAs} onChange={(e) => setSaveAs(e.target.value)} title={t('Si lo guardas en la lista, la próxima vez aparece para escogerlo con un clic')}>
            <option value="">{t('Solo para esta solicitud')}</option>
            <option value="equipo">{t('Agregar a la lista de Equipos')}</option>
            <option value="servicio">{t('Agregar a la lista de Servicios')}</option>
            <option value="producto">{typeId ? `${t('Agregar a Productos')} → ${(catalog.productTypes.find((x) => x.id === typeId) || {}).name}` : t('Agregar a Productos')}</option>
          </select>
          <button type="button" className="btn btn-sm btn-primary" disabled={adding || !free.trim()} onClick={addFree}>{adding ? t('Guardando…') : t('+ Agregar')}</button>
        </div>
        {saveAs === 'producto' && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{t('Se crea en el inventario con costo y precio en $0: complétalo después en Catálogo de productos.')}{!typeId && ` ${t('Tip: escoge primero la categoría en la pestaña Productos.')}`}</div>}
        {saveAs === 'servicio' && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{t('Se crea con precio $0: ponle la tarifa después en Catálogo de Servicios.')}</div>}
        {addError && <div className="text-danger" style={{ fontSize: 12, marginTop: 4 }}>{addError}</div>}
      </div>

      {value.length > 0 && (
        <div className="qp-selected">
          <div className="form-section" style={{ marginTop: 10 }}>{t('Lo que pide el cliente')} ({value.length})</div>
          {value.map((i, idx) => (
            <div key={idx} className="qp-sel-row">
              <span className="qp-kind">{t({ producto: 'Producto', servicio: 'Servicio', categoria: 'Categoría', equipo: 'Equipo', libre: 'Otro' }[i.kind] || i.kind)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{i.description}</span>
              <input type="number" min="0" step="any" value={i.quantity} title={t('Cantidad')} style={{ width: 70 }}
                onChange={(e) => onChange(value.map((x, j) => (j === idx ? { ...x, quantity: e.target.value } : x)))} />
              <button type="button" className="link-btn" style={{ color: 'var(--red)' }} onClick={() => onChange(value.filter((_, j) => j !== idx))}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
