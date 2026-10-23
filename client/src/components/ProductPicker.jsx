import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n.jsx';

// Normaliza para buscar: minúsculas, sin acentos, sin espacios/guiones/comillas
// ("CLS 108S RW1" encuentra "CLS108SRW1" y viceversa).
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const squash = (s) => fold(s).replace(/[\s\-_./"″'′]+/g, '');

const MAX_RESULTS = 50;

// Buscador de productos: se escribe y la lista se va filtrando (nombre, SKU, Item # del fabricante,
// descripción). Flechas ↑/↓ para moverse, Enter para escoger, Esc para cerrar. Vacío = línea manual.
export default function ProductPicker({ products, value, onChange, priceField = 'selling_price', placeholder }) {
  const { t } = useI18n();
  const selected = useMemo(() => products.find((p) => String(p.id) === String(value)) || null, [products, value]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Índice de búsqueda (se arma una vez por lista de productos)
  const index = useMemo(() => products.map((p) => {
    const text = [p.name, p.sku, p.vendor_item_number, p.description, p.product_type_name, p.supplier_name].filter(Boolean).join(' ');
    return { p, words: fold(text), flat: squash(text) };
  }), [products]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return index.slice(0, MAX_RESULTS).map((x) => x.p);
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const qFlat = squash(q);
    const scored = [];
    for (const x of index) {
      const flatHit = qFlat.length >= 3 && x.flat.includes(qFlat);
      const allTerms = terms.every((w) => x.words.includes(w) || x.flat.includes(squash(w)));
      if (!flatHit && !allTerms) continue;
      // Mejor puntuación: coincide al inicio del nombre / SKU / Item #
      const name = squash(x.p.name), sku = squash(x.p.sku), item = squash(x.p.vendor_item_number);
      let score = 3;
      if (name.startsWith(qFlat) || item.startsWith(qFlat)) score = 0;
      else if (sku.includes(qFlat)) score = 1;
      else if (name.includes(qFlat) || item.includes(qFlat)) score = 2;
      scored.push([score, x.p]);
    }
    scored.sort((a, b) => a[0] - b[0] || String(a[1].name).localeCompare(String(b[1].name)));
    return scored.slice(0, MAX_RESULTS).map((s) => s[1]);
  }, [query, index]);

  // Posición del menú (en un portal para que el modal no lo recorte)
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current && inputRef.current.getBoundingClientRect();
      if (r) setRect({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 460), spaceBelow: window.innerHeight - r.bottom });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    const el = listRef.current && listRef.current.children[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function choose(p) {
    onChange(p ? String(p.id) : '');
    setQuery('');
    setOpen(false);
    inputRef.current && inputRef.current.blur();
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (open && results[active]) { e.preventDefault(); choose(results[active]); } }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  const money = (n) => (n === null || n === undefined ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const shown = open ? query : (selected ? selected.name : '');
  const maxH = rect ? Math.max(180, Math.min(360, rect.spaceBelow - 16)) : 360;

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={shown}
        placeholder={selected ? selected.name : (placeholder || t('Buscar producto (nombre, SKU, Item #)… o vacío = manual'))}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        style={{ paddingRight: selected ? 28 : undefined }}
      />
      {selected && !open && (
        <button type="button" className="link-btn" title={t('Quitar producto (línea manual)')} onMouseDown={(e) => { e.preventDefault(); choose(null); }}
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>✕</button>
      )}
      {selected && !open && selected.sku && <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{selected.sku}</div>}
      {open && rect && createPortal(
        <div ref={listRef} onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, maxHeight: maxH, overflowY: 'auto', zIndex: 10000,
            background: '#fff', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, boxShadow: '0 10px 30px rgba(15,23,42,.18)' }}>
          {results.length === 0 && <div className="muted" style={{ padding: '10px 12px', fontSize: 13 }}>{t('Sin resultados')}{query ? ` — "${query}"` : ''}</div>}
          {results.map((p, i) => (
            <div key={p.id} onClick={() => choose(p)} onMouseEnter={() => setActive(i)}
              style={{ padding: '7px 12px', cursor: 'pointer', background: i === active ? '#fff3ec' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <strong style={{ fontSize: 13 }}>{p.name}</strong>
                <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{money(p[priceField])}</span>
              </div>
              <div className="muted" style={{ fontSize: 11.5, display: 'flex', gap: 8, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <span className="mono">{p.sku || '—'}</span>
                {p.vendor_stocked ? <span>✓ {t('Configuración fija')}</span> : null}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description || p.product_type_name || ''}</span>
              </div>
            </div>
          ))}
          {results.length === MAX_RESULTS && <div className="muted" style={{ padding: '6px 12px', fontSize: 11 }}>{t('Mostrando los primeros 50 — escribe más para afinar')}</div>}
        </div>,
        document.body,
      )}
    </div>
  );
}
