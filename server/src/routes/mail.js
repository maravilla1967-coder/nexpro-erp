const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const { get, run } = require('../../db');
const { requireAdmin } = require('../middleware/auth');

// Correo de Microsoft 365 (Outlook): el ERP envía los correos directamente desde la cuenta de
// Outlook de cada usuario (p. ej. je.ramirez@nexprotrucks.com) usando Microsoft Graph.
//
// 1) El administrador registra el ERP en Microsoft Entra (portal.azure.com) y pega aquí el
//    Tenant ID, el Client ID y el Client Secret (pantalla "Mi correo (Outlook)").
// 2) Cada usuario pulsa "Conectar mi Outlook" una vez y autoriza con su cuenta de Microsoft.
// 3) Desde ahí, "Enviar" manda el correo desde su cuenta; queda en su carpeta Enviados.
//
// Permisos delegados que pide: Mail.Send, User.Read, offline_access (para no pedir login cada vez).

const SCOPES = 'offline_access openid profile email User.Read Mail.Send';

function setting(key) {
  const r = get('SELECT value FROM app_settings WHERE key = ?', [key]);
  return r ? r.value : null;
}
function setSetting(key, value) {
  if (get('SELECT key FROM app_settings WHERE key = ?', [key])) run('UPDATE app_settings SET value = ? WHERE key = ?', [value, key]);
  else run('INSERT INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
}
function config() {
  return { tenantId: setting('ms_tenant_id'), clientId: setting('ms_client_id'), clientSecret: setting('ms_client_secret') };
}
const configured = () => { const c = config(); return !!(c.tenantId && c.clientId && c.clientSecret); };

// Dirección a la que Microsoft devuelve al usuario después de autorizar. Debe estar registrada
// tal cual en la app de Entra ("Redirect URI", tipo Web).
function redirectUri(req) {
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${req.get('host')}/api/mail/callback`;
}

async function tokenRequest(params) {
  const c = config();
  const body = new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, scope: SCOPES, ...params });
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description ? String(data.error_description).split('\r\n')[0] : `Microsoft respondió ${r.status}`);
  return data;
}

function saveTokens(userId, email, tok) {
  const expires = Date.now() + (Number(tok.expires_in) || 3600) * 1000 - 60000;
  const ex = get('SELECT user_id FROM mail_accounts WHERE user_id = ?', [userId]);
  if (ex) {
    run(`UPDATE mail_accounts SET email = COALESCE(?, email), access_token = ?, refresh_token = COALESCE(?, refresh_token), expires_at = ?, updated_at = datetime('now') WHERE user_id = ?`,
      [email, tok.access_token, tok.refresh_token || null, expires, userId]);
  } else {
    run(`INSERT INTO mail_accounts (user_id, email, access_token, refresh_token, expires_at) VALUES (?,?,?,?,?)`,
      [userId, email, tok.access_token, tok.refresh_token || null, expires]);
  }
}

async function accessTokenFor(userId) {
  const acc = get('SELECT * FROM mail_accounts WHERE user_id = ?', [userId]);
  if (!acc) return null;
  if (acc.access_token && acc.expires_at > Date.now()) return { token: acc.access_token, email: acc.email };
  if (!acc.refresh_token) return null;
  const tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: acc.refresh_token });
  saveTokens(userId, null, tok);
  return { token: tok.access_token, email: acc.email };
}

// Estados de autorización pendientes (state → usuario), válidos 15 minutos.
const pending = new Map();

// ---------- Ruta pública: Microsoft vuelve aquí después de autorizar ----------
const publicRouter = express.Router();
publicRouter.get('/callback', async (req, res) => {
  const back = (msg, ok) => res.redirect(`/mi-correo?${ok ? 'ok=1' : `error=${encodeURIComponent(msg)}`}`);
  try {
    if (req.query.error) return back(String(req.query.error_description || req.query.error).split('\r\n')[0]);
    const st = pending.get(String(req.query.state || ''));
    pending.delete(String(req.query.state || ''));
    if (!st || st.expires < Date.now()) return back('La autorización venció o no es válida. Vuelve a pulsar "Conectar mi Outlook".');
    const tok = await tokenRequest({ grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: st.redirectUri });
    const me = await (await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    })).json();
    saveTokens(st.userId, me.mail || me.userPrincipalName || null, tok);
    return back(null, true);
  } catch (e) {
    return back(e.message);
  }
});

// ---------- Rutas con sesión del ERP ----------
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 10 } });

router.get('/status', (req, res) => {
  const acc = get('SELECT email, updated_at FROM mail_accounts WHERE user_id = ?', [req.user.id]);
  const c = config();
  res.json({
    configured: configured(),
    connected: !!acc,
    email: acc ? acc.email : null,
    redirectUri: redirectUri(req),
    // El administrador ve qué está configurado (nunca el secreto completo)
    config: req.user.role === 'admin' ? {
      tenantId: c.tenantId || '', clientId: c.clientId || '',
      secretSet: !!c.clientSecret, secretHint: c.clientSecret ? `••••${String(c.clientSecret).slice(-4)}` : '',
    } : undefined,
  });
});

router.put('/config', requireAdmin, (req, res) => {
  const b = req.body || {};
  const tenantId = String(b.tenantId || '').trim();
  const clientId = String(b.clientId || '').trim();
  if (!tenantId || !clientId) return res.status(400).json({ error: 'Tenant ID y Client ID son obligatorios' });
  setSetting('ms_tenant_id', tenantId);
  setSetting('ms_client_id', clientId);
  if (String(b.clientSecret || '').trim()) setSetting('ms_client_secret', String(b.clientSecret).trim());
  res.json({ ok: true });
});

router.get('/connect-url', (req, res) => {
  if (!configured()) return res.status(400).json({ error: 'Falta configurar la conexión con Microsoft 365 (lo hace el administrador en esta misma pantalla).' });
  const state = crypto.randomBytes(24).toString('hex');
  const ru = redirectUri(req);
  pending.set(state, { userId: req.user.id, redirectUri: ru, expires: Date.now() + 15 * 60000 });
  const c = config();
  const params = new URLSearchParams({
    client_id: c.clientId, response_type: 'code', redirect_uri: ru, response_mode: 'query',
    scope: SCOPES, state, prompt: 'select_account',
  });
  if (req.query.hint) params.set('login_hint', String(req.query.hint));
  res.json({ url: `https://login.microsoftonline.com/${encodeURIComponent(c.tenantId)}/oauth2/v2.0/authorize?${params}` });
});

router.post('/disconnect', (req, res) => {
  run('DELETE FROM mail_accounts WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});

const splitAddr = (s) => String(s || '').split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));

// Enviar un correo desde la cuenta de Outlook del usuario. Campos: to, cc, subject, body y
// archivos adjuntos (campo "files", hasta 3 MB en total).
router.post('/send', upload.array('files', 10), async (req, res) => {
  try {
    const b = req.body || {};
    const to = splitAddr(b.to);
    if (!to.length) return res.status(400).json({ error: 'Escribe un correo válido en "Para".' });
    const files = req.files || [];
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > 3 * 1024 * 1024) return res.status(400).json({ error: 'Los adjuntos pasan de 3 MB en total. Quita alguno o envía uno más liviano.' });
    const acc = await accessTokenFor(req.user.id);
    if (!acc) return res.status(409).json({ error: 'Tu Outlook no está conectado. Ve a "Mi correo (Outlook)" y pulsa "Conectar mi Outlook".', needsConnect: true });
    const message = {
      subject: String(b.subject || ''),
      body: { contentType: 'Text', content: String(b.body || '') },
      toRecipients: to.map((address) => ({ emailAddress: { address } })),
      ccRecipients: splitAddr(b.cc).map((address) => ({ emailAddress: { address } })),
      attachments: files.map((f) => ({
        '@odata.type': '#microsoft.graph.fileAttachment', name: f.originalname,
        contentType: f.mimetype || 'application/octet-stream', contentBytes: f.buffer.toString('base64'),
      })),
    };
    const r = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST', headers: { Authorization: `Bearer ${acc.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });
    if (r.status === 401) {
      run('UPDATE mail_accounts SET expires_at = 0 WHERE user_id = ?', [req.user.id]);
      return res.status(409).json({ error: 'Microsoft pidió volver a conectar tu Outlook. Pulsa "Conectar mi Outlook" otra vez.', needsConnect: true });
    }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return res.status(502).json({ error: `Outlook no aceptó el correo: ${(d.error && d.error.message) || r.status}` });
    }
    res.json({ ok: true, from: acc.email });
  } catch (e) {
    const net = /fetch failed|ENOTFOUND|ECONN|timeout/i.test(e.message);
    res.status(502).json({ error: net ? 'No se pudo conectar con Microsoft en este momento. Intenta de nuevo en un minuto.' : e.message });
  }
});

module.exports = router;
module.exports.publicRouter = publicRouter;
