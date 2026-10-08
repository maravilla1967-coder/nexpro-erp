// Utilidades de autenticación: hash de contraseñas y firma de tokens de sesión.
// Usa solo node:crypto (sin dependencias externas) para mantener el proyecto liviano.
const crypto = require('crypto');
const { get, run } = require('../../db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// La clave de firma de sesiones se genera una sola vez y se guarda en la base de datos,
// para no depender de una variable de entorno adicional en Railway.
function getSecret() {
  const row = get(`SELECT value FROM app_settings WHERE key = 'session_secret'`);
  if (row && row.value) return row.value;
  const secret = crypto.randomBytes(48).toString('hex');
  run(`INSERT INTO app_settings (key, value) VALUES ('session_secret', ?)`, [secret]);
  return secret;
}

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input) {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días

function signToken(payload) {
  const secret = getSecret();
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const encoded = base64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('hex');
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [encoded, sig] = token.split('.');
  const secret = getSecret();
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(encoded));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function genInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, genInviteToken };
