import React, { useState } from 'react';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { mailtoHref, outlookHref, smsHref, whatsappHref } from './messages.js';

const SENDABLE = ['email', 'texto', 'whatsapp'];

// ¿Esta interacción es un mensaje que se le envió al cliente y se puede volver a enviar?
export function canResend(a) {
  return a && a.direction === 'saliente' && SENDABLE.includes(a.type) && (a.msg_body || a.notes);
}

// Datos del mensaje original. Los registros nuevos los guardan aparte (msg_*); en los anteriores
// se sacan del registro: el destinatario va al final del tema ("… enviado a x@y.com") y, en correos,
// la primera línea de las notas es el asunto.
function original(a) {
  if (a.msg_body || a.msg_subject) return { to: a.msg_to || '', subject: a.msg_subject || '', body: a.msg_body || '' };
  const m = String(a.subject || '').match(/ a (\S+@\S+|[+\d][\d\s().-]{6,})$/);
  const to = m ? m[1].trim() : '';
  const notes = String(a.notes || '');
  if (a.type === 'email') {
    const i = notes.indexOf('\n\n');
    return i > 0 ? { to, subject: notes.slice(0, i), body: notes.slice(i + 2) } : { to, subject: '', body: notes };
  }
  return { to, subject: '', body: notes };
}

// Vuelve a enviar un correo / SMS / WhatsApp que ya se le mandó al cliente. Se puede corregir el
// destinatario o el texto; al abrirlo en Outlook (o copiarlo) queda registrado como reenviado.
export default function ResendMessage({ activity, customerId, onClose, onSent }) {
  const { t } = useI18n();
  const o = original(activity);
  const [to, setTo] = useState(o.to);
  const [subject, setSubject] = useState(o.subject);
  const [body, setBody] = useState(o.body);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState('');
  const isEmail = activity.type === 'email';
  const ref = String(activity.subject || '').match(/^(NX-RQ-[\w-]+):/);

  async function log() {
    if (logged) return;
    try {
      await api.post(`/customers/${customerId}/activities`, {
        type: activity.type, direction: 'saliente', done: true,
        subject: `${ref ? `${ref[1]}: ` : ''}${t('Mensaje reenviado')}${to ? ` a ${to}` : ''}`,
        notes: [isEmail ? subject : '', body].filter(Boolean).join('\n\n'),
        contactId: activity.contact_id || null, requestId: activity.request_id || null,
        msgTo: to, msgSubject: isEmail ? subject : '', msgBody: body,
      });
      setLogged(true);
      onSent && onSent();
    } catch (e) { setError(e.message); }
  }
  function openApp() {
    const href = isEmail ? mailtoHref(to, subject, body) : activity.type === 'whatsapp' ? whatsappHref(to, body) : smsHref(to, body);
    if (activity.type === 'whatsapp') window.open(href, '_blank'); else window.location.href = href;
    log();
  }
  function openWeb() { window.open(outlookHref(to, subject, body), '_blank', 'noopener'); log(); }
  async function copy() {
    try { await navigator.clipboard.writeText(isEmail ? `${subject}\n\n${body}` : body); } catch (_) {}
    log();
  }

  return (
    <Modal title={t('Reenviar mensaje')} onClose={onClose} wide>
      {error && <div className="error-banner">{error}</div>}
      {logged && <div className="notice-banner" style={{ background: '#dcfce7', color: '#166534' }}>{t('Listo: quedó registrado en el historial del cliente.')}</div>}
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>{t('Enviado originalmente')}: {String(activity.occurred_at || activity.created_at).slice(0, 16)}</div>
      <div className="field"><label>{isEmail ? t('Para (correo)') : t('Para (teléfono)')}</label><input value={to} onChange={(e) => setTo(e.target.value)} /></div>
      {isEmail && <div className="field"><label>{t('Asunto')}</label><input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>}
      <div className="field"><label>{t('Mensaje')}</label><textarea rows={isEmail ? 14 : 5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={onClose}>{logged ? t('Cerrar') : t('Ahora no')}</button>
        <button type="button" className="btn" onClick={copy}>{t('📋 Copiar texto')}</button>
        {!logged && <button type="button" className="btn" onClick={log}>{t('Ya lo envié')}</button>}
        {isEmail && <button type="button" className="btn" onClick={openWeb} disabled={!to}>{t('Outlook web')}</button>}
        <button type="button" className="btn btn-primary" onClick={openApp} disabled={!to}>
          {isEmail ? t('📧 Abrir en Outlook') : activity.type === 'whatsapp' ? t('Abrir WhatsApp') : t('Abrir mensajes')}
        </button>
      </div>
    </Modal>
  );
}
