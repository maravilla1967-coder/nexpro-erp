import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n.jsx';

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const squash = (s) => fold(s).replace(/[\s\-_.,/&'()]+/g, '');
const MAX_RESULTS = 50;

// Buscador de clientes: se escribe y la lista se filtra (nombre, NIT/Tax ID, teléfono, correo, ciudad).
// Dos modos:
//  - por id (por defecto): value = id del cliente, onChange(id) — vacío = sin cliente.
//  - texto libre (freeText): value = nombre escrito, onChange(nombre) — permite escribir un cliente nuevo.
// required: el formulario no se envía sin escoger cliente (validación del navegador).
export default function CustomerPicker({ customers, value, onChange, required, freeText, emptyLabel, placeholder }) {
  const { t } = useI18n();
  const selected = useMemo(() => (freeText ? null : customers.find((c) => String(c.id) === String(value)) || null), [customers, value, freeText]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const hiddenRef = useRef(null);
  // Mensaje de "escoge un cliente" solo mientras no haya uno escogido
  useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.setCustomValidity(value ? '' : t('Escoge un cliente de la lista'));
  }, [value, t]);

  const index = useMemo(() => customers.map((c) => {
    const text = [c.name, c.tax_id, c.phone, c.email, c.city].filter(Boolean).join(' ');
    return { c, words: fold(text), flat: squash(text), name: squash(c.name) };
  }), [customers]);

  const q = freeText ? String(value || '') : query;
  const results = useMemo(() => {
    const s = q.trim();
    const base = [...index].sort((a, b) => String(a.c.name).localeCompare(String(b.c.name)));
    if (!s) return base.slice(0, MAX_RESULTS).map((x) => x.c);
    const terms = fold(s).split(/\s+/).filter(Boolean);
    const qFlat = squash(s);
    const out = [];
    for (const x of base) {
      const hit = (qFlat.length >= 2 && x.flat.includes(qFlat)) || terms.every((w) => x.words.includes(w));
      if (!hit) continue;
      out.push([x.name.startsWith(qFlat) ? 0 : x.name.includes(qFlat) ? 1 : 2, x.c]);
    }
    out.sort((a, b) => a[0] - b[0]);
    return out.slice(0, MAX_RESULTS).map((r) => r[1]);
  }, [q, index]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current && inputRef.current.getBoundingClientRect();
      if (r) setRect({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 360), spaceBelow: window.innerHeight - r.bottom });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    const el = listRef.current && listRef.current.children[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function choose(c) {
    if (freeText) onChange(c ? c.name : '');
    else onChange(c ? String(c.id) : '');
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

  const shown = freeText ? (value || '') : (open ? query : (selected ? selected.name : ''));
  const maxH = rect ? Math.max(180, Math.min(340, rect.spaceBelow - 16)) : 340;
  const sub = (c) => [c.city, c.phone, c.tax_id].filter(Boolean).join(' · ');

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={shown}
        placeholder={selected ? selected.name : (placeholder || t('Buscar cliente (nombre, teléfono, NIT, ciudad)…'))}
        onFocus={() => { setOpen(true); if (!freeText) setQuery(''); }}
        onChange={(e) => { if (freeText) onChange(e.target.value); else setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        style={{ paddingRight: (selected || (freeText && value)) ? 28 : undefined }}
      />
      {/* Para que "required" funcione igual que en el select anterior */}
      {required && !freeText && (
        <input ref={hiddenRef} tabIndex={-1} aria-hidden="true" required value={value || ''} onChange={() => {}}
          style={{ position: 'absolute', left: 12, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      )}
      {(selected || (freeText && value)) && !open && (
        <button type="button" className="link-btn" title={t('Quitar cliente')} onMouseDown={(e) => { e.preventDefault(); choose(null); }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>✕</button>
      )}
      {open && rect && createPortal(
        <div ref={listRef} onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, maxHeight: maxH, overflowY: 'auto', zIndex: 10000,
            background: '#fff', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, boxShadow: '0 10px 30px rgba(15,23,42,.18)' }}>
          {!freeText && emptyLabel && !query && (
            <div onClick={() => choose(null)} style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>{emptyLabel}</div>
          )}
          {results.length === 0 && (
            <div className="muted" style={{ padding: '10px 12px', fontSize: 13 }}>
              {freeText && q.trim() ? t('Cliente nuevo: se creará al guardar') : t('Sin resultados')}
            </div>
          )}
          {results.map((c, i) => (
            <div key={c.id} onClick={() => choose(c)} onMouseEnter={() => setActive(i)}
              style={{ padding: '7px 12px', cursor: 'pointer', background: i === active ? '#fff3ec' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
              <strong style={{ fontSize: 13 }}>{c.name}</strong>
              {sub(c) && <div className="muted" style={{ fontSize: 11.5 }}>{sub(c)}</div>}
            </div>
          ))}
          {results.length === MAX_RESULTS && <div className="muted" style={{ padding: '6px 12px', fontSize: 11 }}>{t('Mostrando los primeros 50 — escribe más para afinar')}</div>}
        </div>,
        document.body,
      )}
    </div>
  );
}
