const express = require('express');
const { get, run, all } = require('../../db');
const { hashPassword, verifyPassword, signToken } = require('../utils/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function userWithPermissions(userId) {
  const user = get('SELECT id, name, email, role, status FROM users WHERE id = ?', [userId]);
  if (!user) return null;
  const permRows = all('SELECT module, can_edit FROM user_permissions WHERE user_id = ?', [userId]);
  const permissions = {};
  permRows.forEach((r) => { permissions[r.module] = !!r.can_edit; });
  return { ...user, permissions };
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });

  const user = get('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  if (user.status !== 'activo') {
    return res.status(403).json({ error: 'Tu cuenta está desactivada. Contacta al administrador.' });
  }
  const token = signToken({ userId: user.id });
  res.json({ token, user: userWithPermissions(user.id) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(userWithPermissions(req.user.id));
});

router.post('/accept-invite', (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Falta el token de invitación o la contraseña' });
  if (String(password).length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  const user = get('SELECT * FROM users WHERE invite_token = ?', [token]);
  if (!user) return res.status(404).json({ error: 'El enlace de invitación no es válido' });
  if (user.invite_expires_at && new Date(user.invite_expires_at) < new Date()) {
    return res.status(400).json({ error: 'El enlace de invitación ya venció. Pide al administrador que lo reenvíe.' });
  }
  if (user.status === 'desactivado') {
    return res.status(403).json({ error: 'Esta cuenta fue desactivada.' });
  }

  const passwordHash = hashPassword(password);
  run(
    `UPDATE users SET password_hash = ?, status = 'activo', invite_token = NULL, invite_expires_at = NULL, activated_at = datetime('now') WHERE id = ?`,
    [passwordHash, user.id]
  );
  const sessionToken = signToken({ userId: user.id });
  res.json({ token: sessionToken, user: userWithPermissions(user.id) });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Falta la contraseña actual o la nueva' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });

  const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!verifyPassword(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'La contraseña actual no es correcta' });
  }
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(newPassword), req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
