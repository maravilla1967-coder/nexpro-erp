import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { sendMail } from './mailStatus.js';

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Envío directo desde el Outlook conectado (Microsoft 365): adjuntos del computador + botón Enviar.
// Si el usuario no ha conectado su Outlook, muestra el enlace para hacerlo.
export default function DirectSend({ mail, to, cc, subject, body, onSent }) {
  const { t } = useI18n();
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState('');
  const input = useRef(null);
  if (!mail) return null;
  if (!mail.connected) {
    return (
      <div className="direct-send off">
        📤 {t('Para que el correo salga directo desde tu cuenta de Nexpro, sin abrir otra app:')} <Link to="/mi-correo">{t('conecta tu Outlook')}</Link>.
      </div>
    );
  }
  const total = files.reduce((s, f) => s + f.size, 0);
  async function send() {
    setError('');
    if (total > 3 * 1024 * 1024) { setError(t('Los adjuntos pasan de 3 MB en total.')); return; }
    setBusy(true);
    try {
      const r = await sendMail({ to, cc, subject, body, files });
      setSent(r.from || mail.email);
      onSent && onSent();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (sent) return <div className="direct-send ok">✅ {t('Correo enviado desde')} <strong>{sent}</strong>. {t('Quedó en tu carpeta Enviados de Outlook y en el historial del cliente.')}</div>;
  return (
    <div className="direct-send">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" onClick={send} disabled={busy || !to}>
          {busy ? t('Enviando…') : `📤 ${t('Enviar desde')} ${mail.email}`}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => input.current && input.current.click()}>{t('📎 Adjuntar archivos')}</button>
        <input ref={input} type="file" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
        {files.length > 0 && <span className={`muted ${total > 3 * 1024 * 1024 ? 'text-danger' : ''}`} style={{ fontSize: 12 }}>{files.length} {t('adjunto(s)')} · {kb(total)} / 3 MB</span>}
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {files.map((f, i) => (
            <span key={i} className="qp-chip" style={{ cursor: 'default' }}>
              📎 {f.name} <button type="button" className="link-btn" style={{ color: 'var(--red)' }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
            </span>
          ))}
        </div>
      )}
      {error && <div className="text-danger" style={{ fontSize: 12.5, marginTop: 6 }}>{error} {/conect/i.test(error) && <Link to="/mi-correo">{t('Ir a Mi correo')}</Link>}</div>}
    </div>
  );
}
