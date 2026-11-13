import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { useI18n } from '../i18n.jsx';

// Fusionar duplicados en el cliente abierto (solo administrador). Busca por las primeras letras
// del nombre, marca los repetidos y todo lo de ellos pasa a este cliente.
export default function MergeCustomersModal({ customer, onClose, onDone }) {
  const { t } = useI18n();
  const [q, setQ] = useState(String(customer.name || '').split(/\s+/)[0] || '');
  const [list, setList] = useState([]);
  const [sel, setSel] = useState([]);
  const [name, setName] = useState(customer.name || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!q.trim()) { setList([]); return; }
    const h = setTimeout(() => {
      api.get(`/customers?q=${encodeURIComponent(q.trim())}`).then((r) => {
        const rows = Array.isArray(r) ? r : (r.list || r.rows || []);
        setList(rows.filter((x) => x.id !== customer.id));
      }).catch(() => setList([]));
    }, 250);
    return () => clearTimeout(h);
  }, [q, customer.id]);

  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function doMerge() {
    if (!sel.length) return;
    const names = list.filter((x) => sel.includes(x.id)).map((x) => x.name).join(', ');
    if (!window.confirm(`${t('Se pasará todo de')} ${names} ${t('a')} "${name}" ${t('y esos registros se borrarán. ¿Continuar?')}`)) return;
    setBusy(true); setErr('');
    try {
      const r = await api.post(`/customers/${customer.id}/merge`, { sourceIds: sel, name });
      onDone(r);
    } catch (e) {
      setErr(e.message || String(e));
    } finally { setBusy(false); }
  }

  return (
    <Modal title={t('🔗 Fusionar duplicados')} onClose={onClose} wide>
      <div className="modal-body">
        <p className="muted" style={{ marginTop: 0 }}>
          {t('Marca los registros repetidos. Sus vehículos, personas, facturas, órdenes, solicitudes, oportunidades e historial pasan a este cliente, y los repetidos se borran. Sus nombres quedan como alias para que la búsqueda los siga encontrando.')}
        </p>
        <label className="field"><span>{t('Nombre definitivo')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span>{t('Buscar repetidos')}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Escribe parte del nombre')} /></label>
        <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8 }}>
          {list.length === 0 && <div className="muted" style={{ padding: 12 }}>{t('Sin resultados')}</div>}
          {list.map((x) => (
            <label key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border, #eee)', cursor: 'pointer' }}>
              <input type="checkbox" checked={sel.includes(x.id)} onChange={() => toggle(x.id)} />
              <span style={{ flex: 1 }}><b>{x.name}</b> {x.city && <span className="muted">· {x.city}</span>}</span>
            </label>
          ))}
        </div>
        {err && <div className="error" style={{ marginTop: 10, color: '#b91c1c' }}>{err}</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
        <button type="button" className="btn btn-primary" disabled={!sel.length || busy || !name.trim()} onClick={doMerge}>
          {busy ? t('Fusionando…') : `${t('Fusionar')} (${sel.length})`}
        </button>
      </div>
    </Modal>
  );
}
