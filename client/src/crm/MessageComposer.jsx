import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import DirectSend from './DirectSend.jsx';
import { useMailStatus } from './mailStatus.js';
import { ackMessage, quoteMessage, mailtoHref, outlookHref, smsHref, whatsappHref } from './messages.js';

// Ventana con el mensaje ya preparado para el cliente (acuse de recibo o cotización). Se puede
// editar, cambiar de idioma y enviar por el mismo medio por donde llegó la solicitud: correo,
// texto o WhatsApp. Al enviarlo queda registrado en el historial de interacciones del cliente.
export default function MessageComposer({ request, kind = 'acuse', onClose, onSent }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const mail = useMailStatus();
  const customer = request.customer || { name: request.customer_name };
  const contact = { name: request.contact_name, email: request.contact_email, phone: request.contact_phone, mobile: request.contact_mobile };
  const [lang, setLang] = useState((request.customer && request.customer.preferred_language) || 'en');
  const defaultChannel = ['texto', 'whatsapp'].includes(request.channel) ? request.channel : 'email';
  const [channel, setChannel] = useState(defaultChannel);
  const replyLooksEmail = request.reply_to && request.reply_to.includes('@');
  const [to, setTo] = useState(() => (defaultChannel === 'email'
    ? (replyLooksEmail ? request.reply_to : (contact.email || (request.customer && request.customer.email) || ''))
    : (!replyLooksEmail && request.reply_to) || contact.mobile || contact.phone || (request.customer && request.customer.phone) || ''));
  const build = (l) => (kind === 'cotizacion' ? quoteMessage : ackMessage)({ lang: l, customer, contact, request, userName: user && user.name });
  const initial = useMemo(() => build(lang), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(defaultChannel === 'email' ? initial.body : initial.sms);
  const [logged, setLogged] = useState(false);
  const [error, setError] = useState('');

  function switchLang(l) {
    setLang(l);
    const m = build(l);
    setSubject(m.subject);
    setBody(channel === 'email' ? m.body : m.sms);
  }
  function switchChannel(c) {
    const m = build(lang);
    setChannel(c);
    setBody(c === 'email' ? m.body : m.sms);
    if (c === 'email') setTo((replyLooksEmail && request.reply_to) || contact.email || (request.customer && request.customer.email) || '');
    else setTo((!replyLooksEmail && request.reply_to) || contact.mobile || contact.phone || (request.customer && request.customer.phone) || '');
  }

  async function log() {
    if (logged) return;
    try {
      const r = await api.post(`/crm/requests/${request.id}/messages`, { kind, channel, to, subject: channel === 'email' ? subject : '', body });
      setLogged(true);
      onSent && onSent(r);
    } catch (e) { setError(e.message); }
  }
  function openOutlook() {
    window.open(outlookHref(to, subject, body), '_blank', 'noopener');
    log();
  }
  function openApp() {
    const href = channel === 'email' ? mailtoHref(to, subject, body) : channel === 'whatsapp' ? whatsappHref(to, body) : smsHref(to, body);
    if (channel === 'whatsapp') window.open(href, '_blank'); else window.location.href = href;
    log();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(channel === 'email' ? `${subject}\n\n${body}` : body); } catch (_) {}
    log();
  }

  const title = kind === 'cotizacion' ? t('Enviar cotización al cliente') : t('Acuse de recibo para el cliente');
  return (
    <Modal title={`${title} · ${request.number}`} onClose={onClose} wide>
      {error && <div className="error-banner">{error}</div>}
      {logged && <div className="notice-banner" style={{ background: '#dcfce7', color: '#166534' }}>{t('Listo: quedó registrado en el historial del cliente.')}</div>}
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <div className="seg">
          {[['email', '✉️ Email'], ['texto', '💬 SMS'], ['whatsapp', '🟢 WhatsApp']].map(([k, l]) => (
            <button key={k} type="button" className={`seg-btn ${channel === k ? 'active' : ''}`} onClick={() => switchChannel(k)}>{l}</button>
          ))}
        </div>
        <div className="seg">
          {[['en', 'English'], ['es', 'Español']].map(([k, l]) => (
            <button key={k} type="button" className={`seg-btn ${lang === k ? 'active' : ''}`} onClick={() => switchLang(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{channel === 'email' ? t('Para (correo)') : t('Para (teléfono)')}</label>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={channel === 'email' ? 'cliente@empresa.com' : '305-555-0000'} />
      </div>
      {channel === 'email' && (
        <div className="field"><label>{t('Asunto')}</label><input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
      )}
      <div className="field"><label>{t('Mensaje')}</label><textarea rows={channel === 'email' ? 14 : 5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
      {kind === 'cotizacion' && request.sales_order_id && (
        <div className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>
          {t('Adjunta el PDF de la cotización:')} <Link to={`/pedidos/${request.sales_order_id}/documento`} target="_blank">{t('abrir la orden de pedido')} {request.sales_order_number}</Link> → {t('Imprimir / Guardar PDF')}.
        </div>
      )}
      {channel === 'email' && !logged && <DirectSend mail={mail} to={to} subject={subject} body={body} onSent={log} />}
      <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={onClose}>{logged ? t('Cerrar') : t('Ahora no')}</button>
        <button type="button" className="btn" onClick={copy}>{t('📋 Copiar texto')}</button>
        {!logged && <button type="button" className="btn" onClick={log}>{t('Ya lo envié')}</button>}
        {channel === 'email' && <button type="button" className="btn" onClick={openOutlook} disabled={!to} title={t('Abre el correo en Outlook en el navegador (outlook.office.com)')}>{t('Outlook web')}</button>}
        {channel === 'email' ? (
          <button type="button" className={`btn ${mail && mail.connected ? '' : 'btn-primary'}`} onClick={openApp} disabled={!to} title={t('Abre el correo ya escrito en la app de Outlook del computador')}>{t('📧 Abrir en Outlook')}</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={openApp} disabled={!to}>
            {channel === 'whatsapp' ? t('Abrir WhatsApp') : t('Abrir mensajes')}
          </button>
        )}
      </div>
    </Modal>
  );
}
