const express = require('express');
const { get, all, run } = require('../../db');
const { genInviteToken } = require('../utils/auth');
const { MODULE_KEYS } = require('../modules');

const router = express.Router();

const ALLOWED_DOMAIN = '@nexprotrucks.com';
const INVITE_TTL_DAYS = 7;

function inviteExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function withPermissions(user) {
  if (!user) return user;
  const permRows = all('SELECT module, can_edit FROM user_permissions WHERE user_id = ?', [user.id]);
  user.permissions = {};
  permRows.forEach((r) => { user.permissions[r.module] = !!r.can_edit; });
  return user;
}

function savePermissions(userId, modules) {
  run('DELETE FROM user_permissions WHERE user_id = ?', [userId]);
  if (!Array.isArray(modules)) return;
  for (const m of modules) {
    const key = m.module || m.key;
    if (!MODULE_KEYS.includes(key)) continue;
    if (!m.canEdit) continue;
    run('INSERT INTO user_permissions (user_id, module, can_edit) VALUES (?, ?, 1)', [userId, key]);
  }
}

router.get('/', (req, res) => {
  const users = all(
    `SELECT id, name, email, role, status, created_at, activated_at FROM users ORDER BY created_at ASC`
  );
  res.json(users.map(withPermissions));
});

router.post('/', (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  const email = (b.email || '').trim().toLowerCase();
  const role = b.role === 'admin' ? 'admin' : 'usuario';

  if (!name || !email) return res.status(400).json({ error: 'Nombre y correo son obligatorios' });
  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return res.status(400).json({ error: `El correo debe ser de la empresa (${ALLOWED_DOMAIN})` });
  }
  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'Ya existe un usuario con ese correo' });

  const inviteToken = genInviteToken();
  const result = run(
    `INSERT INTO users (name, email, role, status, invite_token, invite_expires_at) VALUES (?,?,?,'invitado',?,?)`,
    [name, email, role, inviteToken, inviteExpiry()]
  );
  savePermissions(result.lastInsertRowid, b.modules);
  const user = withPermissions(get('SELECT id, name, email, role, status, created_at FROM users WHERE id = ?', [result.lastInsertRowid]));
  res.status(201).json({ ...user, inviteToken });
});

router.put('/:id', (req, res) => {
  const b = req.body || {};
  const existing = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });

  if (existing.role === 'admin' && b.role && b.role !== 'admin') {
    const otherAdmins = get(`SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND id != ?`, [existing.id]);
    if (!otherAdmins || otherAdmins.n === 0) {
      return res.status(400).json({ error: 'Debe quedar al menos un administrador' });
    }
  }
  if (existing.role === 'admin' && b.status === 'desactivado') {
    const otherActiveAdmins = get(`SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND status = 'activo' AND id != ?`, [existing.id]);
    if (!otherActiveAdmins || otherActiveAdmins.n === 0) {
      return res.status(400).json({ error: 'Debe quedar al menos un administrador activo' });
    }
  }

  run(
    `UPDATE users SET name = ?, role = ?, status = ? WHERE id = ?`,
    [b.name ?? existing.name, b.role ?? existing.role, b.status ?? existing.status, req.params.id]
  );
  if (Array.isArray(b.modules)) savePermissions(req.params.id, b.modules);
  res.json(withPermissions(get('SELECT id, name, email, role, status, created_at, activated_at FROM users WHERE id = ?', [req.params.id])));
});

router.post('/:id/reinvite', (req, res) => {
  const existing = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
  const inviteToken = genInviteToken();
  run(
    `UPDATE users SET status = 'invitado', invite_token = ?, invite_expires_at = ?, password_hash = NULL WHERE id = ?`,
    [inviteToken, inviteExpiry(), req.params.id]
  );
  res.json({ inviteToken });
});

router.delete('/:id', (req, res) => {
  const existing = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (String(req.user.id) === String(req.params.id)) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }
  if (existing.role === 'admin') {
    const otherAdmins = get(`SELECT COUNT(*) as n FROM users WHERE role = 'admin' AND id != ?`, [existing.id]);
    if (!otherAdmins || otherAdmins.n === 0) {
      return res.status(400).json({ error: 'Debe quedar al menos un administrador' });
    }
  }
  run('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
