import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Selector con búsqueda (para listas largas, ej. 200+ proveedores).
// options: [{ value, label, group?, hint? }]. Se escribe y la lista se filtra; ↑/↓ + Enter, Esc cierra.
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function SearchPicker({ options, value, onChange, placeholder, emptyLabel }) {
  const selected = useMemo(() => options.find((o) => String(o.value) === String(value)) || null, [options, value]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const terms = fold(query).split(/\s+/).filter(Boolean);
    const list = terms.length ? options.filter((o) => { const t = fold(`${o.label} ${o.group || ''} ${o.hint || ''}`); return terms.every((w) => t.includes(w)); }) : options;
    return emptyLabel && !terms.length ? [{ value: '', label: emptyLabel }, ...list] : list;
  }, [options, query, emptyLabel]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = inputRef.current && inputRef.current.getBoundingClientRect();
      if (r) setRect({ left: r.left, top: r.bottom + 4, width: r.width, spaceBelow: window.innerHeight - r.bottom });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    const el = listRef.current && listRef.current.querySelector(`[data-i="${active}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function choose(o) {
    onChange(o ? o.value : '');
    setQuery(''); setOpen(false);
    inputRef.current && inputRef.current.blur();
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { if (open && results[active]) { e.preventDefault(); choose(results[active]); } }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  }

  const maxH = rect ? Math.max(180, Math.min(360, rect.spaceBelow - 16)) : 360;
  let lastGroup = null;
  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={open ? query : (selected ? selected.label : '')}
        placeholder={selected ? selected.label : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {selected && selected.group && !open && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{selected.group}</div>}
      {open && rect && createPortal(
        <div ref={listRef} onMouseDown={(e) => e.preventDefault()}
          style={{ position: 'fixed', left: rect.left, top: rect.top, width: rect.width, maxHeight: maxH, overflowY: 'auto', zIndex: 10000,
            background: '#fff', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, boxShadow: '0 10px 30px rgba(15,23,42,.18)' }}>
          {results.length === 0 && <div className="muted" style={{ padding: '10px 12px', fontSize: 13 }}>—</div>}
          {results.map((o, i) => {
            const header = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group || lastGroup;
            return (
              <React.Fragment key={`${o.value}`}>
                {header && <div style={{ padding: '6px 12px 3px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', background: '#f8fafc' }}>{header}</div>}
                <div data-i={i} onClick={() => choose(o)} onMouseEnter={() => setActive(i)}
                  style={{ padding: '7px 12px', cursor: 'pointer', fontSize: 13, background: i === active ? '#fff3ec' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                  {o.label}
                </div>
              </React.Fragment>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
