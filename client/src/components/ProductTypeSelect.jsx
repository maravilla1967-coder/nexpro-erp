import React, { useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

const NEW = '__new__';

// Selector de tipo de producto con opción "＋ Crear tipo nuevo…" que lo crea ahí mismo
// (sin salir del formulario) y lo deja seleccionado.
export default function ProductTypeSelect({ types, setTypes, value, onChange }) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function create() {
    const n = name.trim();
    if (!n) return;
    setBusy(true); setError('');
    try {
      const created = await api.post('/products/types', { name: n });
      const next = [...types.filter((x) => x.id !== created.id), created].sort((a, b) => String(a.name).localeCompare(String(b.name)));
      setTypes(next);
      onChange(String(created.id));
      setCreating(false); setName('');
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  if (creating) {
    return (
      <div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input autoFocus placeholder={t('Nombre del tipo nuevo')} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); create(); } if (e.key === 'Escape') { e.preventDefault(); setCreating(false); } }} />
          <button type="button" className="btn btn-primary btn-sm" disabled={busy || !name.trim()} onClick={create}>{t('Crear')}</button>
          <button type="button" className="btn btn-sm" onClick={() => { setCreating(false); setName(''); setError(''); }}>✕</button>
        </div>
        {error && <div className="error-banner" style={{ marginTop: 6, marginBottom: 0 }}>{error}</div>}
      </div>
    );
  }
  return (
    <select value={value || ''} onChange={(e) => (e.target.value === NEW ? setCreating(true) : onChange(e.target.value))}>
      <option value="">{t('— Sin tipo —')}</option>
      {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      <option value={NEW}>{t('＋ Crear tipo nuevo…')}</option>
    </select>
  );
}
