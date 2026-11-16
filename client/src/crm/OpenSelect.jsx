import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

// Lista desplegable "abierta": opciones fijas + las que los usuarios han agregado, y al final
// "➕ Agregar otro…" para crear una opción nueva ahí mismo (queda disponible para todos).
const cache = {};
export function useOpenOptions(list, builtins) {
  const [extra, setExtra] = useState(cache[list] || []);
  useEffect(() => {
    api.get(`/options/${list}`).then((rows) => { cache[list] = rows.map((r) => r.value); setExtra(cache[list]); }).catch(() => {});
  }, [list]);
  const keys = new Set(builtins.map((b) => b.key));
  const all = [...builtins, ...extra.filter((v) => !keys.has(v)).map((v) => ({ key: v, label: v }))];
  const add = (v) => { cache[list] = [...(cache[list] || []), v]; setExtra(cache[list]); };
  return [all, add];
}

export default function OpenSelect({ list, builtins, value, onChange, emptyLabel }) {
  const { t } = useI18n();
  const [options, addOption] = useOpenOptions(list, builtins);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const shown = value && !options.some((o) => o.key === value) ? [...options, { key: value, label: value }] : options;

  async function save() {
    const v = text.trim();
    if (!v) { setAdding(false); return; }
    const existing = shown.find((o) => o.key.toLowerCase() === v.toLowerCase() || t(o.label).toLowerCase() === v.toLowerCase());
    if (existing) { onChange(existing.key); setAdding(false); setText(''); return; }
    try {
      const r = await api.post(`/options/${list}`, { value: v });
      addOption(r.value); onChange(r.value); setAdding(false); setText(''); setErr('');
    } catch (e) { setErr(e.message); }
  }

  if (adding) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus value={text} placeholder={t('Escribe la opción nueva')} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') setAdding(false); }} />
          <button type="button" className="btn btn-sm btn-primary" onClick={save}>{t('Agregar')}</button>
          <button type="button" className="btn btn-sm" onClick={() => { setAdding(false); setText(''); }}>✕</button>
        </div>
        {err && <div className="hint" style={{ color: 'var(--red)' }}>{err}</div>}
      </div>
    );
  }
  return (
    <select value={value || ''} onChange={(e) => (e.target.value === '__add' ? setAdding(true) : onChange(e.target.value))}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {shown.map((o) => <option key={o.key} value={o.key}>{t(o.label)}</option>)}
      <option value="__add">➕ {t('Agregar otro…')}</option>
    </select>
  );
}
