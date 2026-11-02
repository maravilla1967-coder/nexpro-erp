import React, { useMemo, useState } from 'react';
import { useI18n, pickLang } from '../i18n.jsx';
import { money } from './constants.js';

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const squash = (s) => fold(s).replace(/[\s\-_./"'()]+/g, '');

// Escoger lo que busca el cliente con clics, sin escribir: tipos de equipo (grúa, bucket lift,
// compresor…), servicios del catálogo, o productos por categoría. El buscador queda como atajo
// para ir directo a un producto concreto (nombre, SKU, Item # del fabricante).
// value: [{ kind, productId, serviceId, productTypeId, equipmentTypeId, description, quantity }]
export default function CatalogQuickPick({ catalog, value, onChange }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState('equipos');
  const [typeId, setTypeId] = useState(null);
  const [q, setQ] = useState('');
  const [free, setFree] = useState('');

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
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input placeholder={t('Otra cosa que no está en la lista…')} value={free} onChange={(e) => setFree(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (free.trim()) { onChange([...value, { kind: 'libre', description: free.trim(), quantity: 1 }]); setFree(''); } } }} />
        <button type="button" className="btn btn-sm" onClick={() => { if (free.trim()) { onChange([...value, { kind: 'libre', description: free.trim(), quantity: 1 }]); setFree(''); } }}>{t('+ Agregar')}</button>
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
