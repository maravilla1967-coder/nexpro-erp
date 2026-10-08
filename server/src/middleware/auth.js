const { get, all } = require('../../db');
const { verifyToken } = require('../utils/auth');

// Carga el usuario autenticado en req.user a partir del header Authorization: Bearer <token>.
// Se re-consulta la base de datos en cada request (no solo el token) para que una
// desactivación de usuario tenga efecto inmediato, sin esperar a que expire el token.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });

  const user = get('SELECT id, name, email, role, status FROM users WHERE id = ?', [payload.userId]);
  if (!user || user.status !== 'activo') {
    return res.status(401).json({ error: 'Tu cuenta no está activa. Contacta al administrador.' });
  }

  const permRows = all('SELECT module, can_edit FROM user_permissions WHERE user_id = ?', [user.id]);
  const permissions = {};
  permRows.forEach((r) => { permissions[r.module] = !!r.can_edit; });

  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, permissions };
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo un administrador puede hacer esto.' });
  next();
}

// Middleware de fábrica: deja pasar lecturas (GET/HEAD) siempre; para escrituras,
// exige que el usuario sea admin o tenga permiso de edición en ese módulo.
function requireModuleEdit(moduleKey) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (req.user.role === 'admin') return next();
    if (req.user.permissions[moduleKey]) return next();
    return res.status(403).json({ error: 'No tienes permiso para editar este módulo. Pídele acceso al administrador.' });
  };
}

module.exports = { requireAuth, requireAdmin, requireModuleEdit };
