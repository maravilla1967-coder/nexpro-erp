import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Estado de la conexión de Outlook del usuario (se consulta una vez y se comparte).
let cache = null;
let inflight = null;

export function refreshMailStatus() {
  inflight = api.get('/mail/status').then((s) => { cache = s; inflight = null; return s; }).catch(() => { inflight = null; return null; });
  return inflight;
}

export function useMailStatus() {
  const [status, setStatus] = useState(cache);
  useEffect(() => {
    let alive = true;
    (inflight || refreshMailStatus()).then((s) => { if (alive && s) setStatus(s); });
    return () => { alive = false; };
  }, []);
  return status;
}

// Envía el correo desde el Outlook conectado. files: File[] del computador.
export async function sendMail({ to, cc, subject, body, files }) {
  const fd = new FormData();
  fd.append('to', to || '');
  fd.append('cc', cc || '');
  fd.append('subject', subject || '');
  fd.append('body', body || '');
  (files || []).forEach((f) => fd.append('files', f));
  return api.postForm('/mail/send', fd);
}
