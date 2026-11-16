import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';
import { refreshMailStatus } from '../crm/mailStatus.js';

// "Mi correo (Outlook)": cada usuario conecta su cuenta de Outlook (Microsoft 365) para que el ERP
// envíe los correos directamente desde ella. El administrador además guarda aquí, una sola vez,
// los datos de la app registrada en Microsoft Entra.
export default function MailSettings() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const [st, setSt] = useState(null);
  const [cfg, setCfg] = useState({ tenantId: '', clientId: '', clientSecret: '' });
  const [msg, setMsg] = useState(params.get('ok') ? 'ok' : '');
  const [error, setError] = useState(params.get('error') || '');
  const [busy, setBusy] = useState(false);

  function load() {
    refreshMailStatus().then((s) => {
      if (!s) return;
      setSt(s);
      if (s.config) setCfg((c) => ({ ...c, tenantId: s.config.tenantId, clientId: s.config.clientId }));
    });
  }
  useEffect(() => { load(); if (params.get('ok') || params.get('error')) setParams({}, { replace: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveConfig(e) {
    e.preventDefault(); setError(''); setMsg('');
    try { await api.put('/mail/config', cfg); setCfg({ ...cfg, clientSecret: '' }); setMsg('config'); load(); } catch (err) { setError(err.message); }
  }
  async function connect() {
    setError(''); setBusy(true);
    try { const { url } = await api.get('/mail/connect-url'); window.location.href = url; } catch (err) { setError(err.message); setBusy(false); }
  }
  async function disconnect() {
    if (!window.confirm(t('¿Desconectar tu Outlook del ERP? Los correos ya no saldrán directo hasta que lo vuelvas a conectar.'))) return;
    await api.post('/mail/disconnect', {}); load();
  }
  const copy = (v) => { try { navigator.clipboard.writeText(v); } catch (_) {} };

  return (
    <>
      <div className="topbar"><div><h1>{t('Mi correo (Outlook)')}</h1><div className="sub">{t('Enviar los correos del ERP directo desde tu cuenta de Outlook / Microsoft 365')}</div></div></div>
      <div className="content" style={{ maxWidth: 900 }}>
        {error && <div className="error-banner">{error}</div>}
        {msg === 'ok' && <div className="notice-banner" style={{ background: '#dcfce7', color: '#166534' }}>{t('✓ Tu Outlook quedó conectado. Ya puedes enviar los correos directo desde el ERP.')}</div>}
        {msg === 'config' && <div className="notice-banner" style={{ background: '#dcfce7', color: '#166534' }}>{t('✓ Datos de Microsoft 365 guardados. Ahora pulsa "Conectar mi Outlook".')}</div>}

        <div className="card">
          <div className="card-title">{t('Tu cuenta')}</div>
          {!st ? t('Cargando…') : st.connected ? (
            <>
              <div style={{ fontSize: 15 }}>✅ {t('Conectado como')} <strong>{st.email}</strong></div>
              <div className="muted" style={{ fontSize: 13, margin: '6px 0 12px' }}>{t('Los acuses, cotizaciones y reenvíos salen desde esta cuenta y quedan en tu carpeta Enviados de Outlook.')}</div>
              <div className="row-actions">
                <button className="btn" onClick={connect} disabled={busy}>{t('Conectar otra cuenta')}</button>
                <button className="btn btn-danger" onClick={disconnect}>{t('Desconectar')}</button>
              </div>
            </>
          ) : st.configured ? (
            <>
              <div className="muted" style={{ fontSize: 13.5, marginBottom: 12 }}>{t('Pulsa el botón, escoge tu cuenta de Nexpro (p. ej. je.ramirez@nexprotrucks.com) y acepta los permisos. Solo se hace una vez.')}</div>
              <button className="btn btn-primary" onClick={connect} disabled={busy}>{busy ? t('Abriendo Microsoft…') : t('🔗 Conectar mi Outlook')}</button>
            </>
          ) : (
            <div className="muted">{isAdmin ? t('Primero completa abajo la conexión con Microsoft 365 (una sola vez).') : t('El administrador todavía no ha activado la conexión con Microsoft 365.')}</div>
          )}
        </div>

        {isAdmin && st && (
          <div className="card">
            <div className="card-title">{t('Conexión con Microsoft 365 (solo administrador, una vez)')}</div>
            <ol style={{ fontSize: 13.5, lineHeight: 1.6, paddingLeft: 18, marginTop: 0 }}>
              <li>{t('Entra a')} <a href="https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer">entra.microsoft.com → App registrations</a> {t('con je.ramirez@nexprotrucks.com y pulsa "New registration".')}</li>
              <li>{t('Name: "Nexpro ERP". Supported account types: "Accounts in this organizational directory only".')}</li>
              <li>{t('Redirect URI: tipo "Web" y pega esta dirección:')}
                <div className="copy-line"><code>{st.redirectUri}</code><button type="button" className="btn btn-sm" onClick={() => copy(st.redirectUri)}>{t('Copiar')}</button></div>
                {t('Pulsa "Register".')}</li>
              <li>{t('En la página de la app copia "Application (client) ID" y "Directory (tenant) ID" en los campos de abajo.')}</li>
              <li>{t('Menú "Certificates & secrets" → "New client secret" → 24 months → "Add". Copia el "Value" (no el Secret ID) en el campo de abajo. Solo se ve una vez.')}</li>
              <li>{t('Menú "API permissions" → "Add a permission" → Microsoft Graph → Delegated → marca Mail.Send y User.Read → "Add permissions" → "Grant admin consent for Nexpro".')}</li>
              <li>{t('Pulsa "Guardar" aquí abajo y luego "Conectar mi Outlook" arriba.')}</li>
            </ol>
            <form onSubmit={saveConfig}>
              <div className="grid grid-2">
                <div className="field"><label>Directory (tenant) ID</label><input value={cfg.tenantId} onChange={(e) => setCfg({ ...cfg, tenantId: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
                <div className="field"><label>Application (client) ID</label><input value={cfg.clientId} onChange={(e) => setCfg({ ...cfg, clientId: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /></div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label>Client secret (Value) {st.config && st.config.secretSet && <span className="muted">— {t('guardado')} {st.config.secretHint}; {t('déjalo vacío para no cambiarlo')}</span>}</label>
                  <input type="password" value={cfg.clientSecret} onChange={(e) => setCfg({ ...cfg, clientSecret: e.target.value })} autoComplete="off" />
                </div>
              </div>
              <div className="modal-footer"><button type="submit" className="btn btn-primary">{t('Guardar')}</button></div>
            </form>
            <div className="muted" style={{ fontSize: 12 }}>{t('Si entras al ERP también por otra dirección, agrega esa dirección + /api/mail/callback como otra Redirect URI en la app de Entra.')}</div>
          </div>
        )}
      </div>
    </>
  );
}
