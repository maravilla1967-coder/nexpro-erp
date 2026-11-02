import React, { useRef, useState } from 'react';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';

const isImage = (f) => /^image\//.test(f.mime_type || f.type || '') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.original_name || f.name || '');
const fileIcon = (name) => (/\.pdf$/i.test(name) ? '📄' : /\.(xlsx?|csv)$/i.test(name) ? '📊' : /\.(docx?|txt|rtf)$/i.test(name) ? '📝' : /\.(zip|rar)$/i.test(name) ? '🗜️' : '📎');
const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`);

// Zona para soltar o escoger archivos (requerimientos, especificaciones, fotos del equipo…).
// Modo "pendiente" (pending/onPendingChange): guarda los archivos en memoria hasta que se crea la
// solicitud. Modo normal (request): los sube de una vez a la solicitud y muestra los que ya tiene.
export default function RequestFiles({ request, onChanged, pending, onPendingChange }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const list = request ? (request.files || []) : [];

  async function add(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setError('');
    const big = files.find((f) => f.size > 20 * 1024 * 1024);
    if (big) { setError(`${big.name}: ${t('pesa más de 20 MB')}`); return; }
    if (!request) { onPendingChange([...(pending || []), ...files]); return; }
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    setBusy(true);
    try { const r = await api.postForm(`/crm/requests/${request.id}/files`, fd); onChanged && onChanged(r); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(f) {
    if (!window.confirm(`${t('¿Quitar el archivo')} ${f.original_name || ''}?`)) return;
    try { await api.del(`/crm/requests/${request.id}/files/${f.id}`); const r = await api.get(`/crm/requests/${request.id}`); onChanged && onChanged(r); } catch (e) { if (!e.pendingApproval) setError(e.message); }
  }

  return (
    <div>
      <div className={`drop-zone ${over ? 'over' : ''}`}
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}>
        {busy ? t('Subiendo…') : t('📎 Arrastra aquí documentos o fotos que mandó el cliente, o haz clic para escogerlos')}
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <div className="text-danger" style={{ fontSize: 12, marginTop: 4 }}>{error}</div>}

      {pending && pending.length > 0 && (
        <div className="file-grid">
          {pending.map((f, i) => (
            <div key={i} className="file-tile">
              {isImage(f) ? <img src={URL.createObjectURL(f)} alt="" /> : <span className="file-ico">{fileIcon(f.name)}</span>}
              <span className="file-name" title={f.name}>{f.name}</span>
              <span className="muted" style={{ fontSize: 11 }}>{kb(f.size)} · {t('se sube al guardar')}</span>
              <button type="button" className="file-x" onClick={() => onPendingChange(pending.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}

      {list.length > 0 && (
        <div className="file-grid">
          {list.map((f) => (
            <div key={f.id} className="file-tile">
              <a href={f.file_url} target="_blank" rel="noreferrer" className="file-link">
                {isImage(f) ? <img src={f.file_url} alt="" /> : <span className="file-ico">{fileIcon(f.original_name || '')}</span>}
                <span className="file-name" title={f.original_name}>{f.original_name || f.file_url.split('/').pop()}</span>
              </a>
              <span className="muted" style={{ fontSize: 11 }}>{String(f.created_at).slice(0, 10)}{f.size ? ` · ${kb(f.size)}` : ''}{f.created_by_name ? ` · ${f.created_by_name}` : ''}</span>
              <button type="button" className="file-x" onClick={() => remove(f)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
