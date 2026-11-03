const express = require('express');
const { all, get, run, nowIso } = require('../../db');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('clientes'));

// ---- Customers ----
// Roles de la relación (puede tener varios): cliente, potencial, proveedor, dealer.
const ROLES = ['cliente', 'potencial', 'proveedor', 'dealer'];
function cleanRoles(v, fallback) {
  const arr = (Array.isArray(v) ? v : String(v || '').split(',')).map((x) => String(x).trim()).filter((x) => ROLES.includes(x));
  const uniq = [...new Set(arr)];
  return uniq.length ? uniq.join(',') : fallback;
}

// Si el cliente también es proveedor, queda enlazado a su ficha en Proveedores (se busca por
// nombre y, si no existe, se crea) para que las órdenes de compra sigan funcionando igual.
function ensureSupplierLink(customerId) {
  const c = get('SELECT * FROM customers WHERE id = ?', [customerId]);
  if (!c || !String(c.roles || '').split(',').includes('proveedor') || c.supplier_id) return;
  let s = get('SELECT id FROM suppliers WHERE lower(trim(name)) = lower(trim(?))', [c.name]);
  if (!s) {
    const id = run(`INSERT INTO suppliers (name, tax_id, email, phone, address, city, zip, notes) VALUES (?,?,?,?,?,?,?,?)`,
      [c.name, c.tax_id, c.email, c.phone, c.address, c.city, c.zip, 'Creado desde el CRM']).lastInsertRowid;
    s = { id };
  }
  run('UPDATE customers SET supplier_id = ? WHERE id = ?', [s.id, customerId]);
}

router.get('/', (req, res) => {
  const { q, status, role } = req.query;
  let sql = `SELECT c.*,
      (SELECT COUNT(*) FROM contacts k WHERE k.customer_id = c.id) AS contacts_count,
      (SELECT COUNT(*) FROM crm_requests r WHERE r.customer_id = c.id AND r.status IN ('nueva','en_proceso','cotizada')) AS open_requests,
      (SELECT MAX(COALESCE(a.occurred_at, a.created_at)) FROM activities a WHERE a.customer_id = c.id) AS last_interaction
    FROM customers c WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ` AND (c.name LIKE ? OR c.aliases LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.tax_id LIKE ? OR c.city LIKE ?
             OR EXISTS (SELECT 1 FROM contacts k WHERE k.customer_id = c.id AND (k.name LIKE ? OR k.email LIKE ? OR k.phone LIKE ? OR k.mobile LIKE ?)))`;
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like, like, like, like);
  }
  if (status) {
    sql += ' AND c.status = ?';
    params.push(status);
  }
  if (role) {
    sql += " AND (',' || COALESCE(c.roles,'') || ',') LIKE ?";
    params.push(`%,${role},%`);
  }
  sql += ' ORDER BY c.created_at DESC';
  res.json(all(sql, params));
});

router.get('/:id', (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
  customer.contacts = all('SELECT * FROM contacts WHERE customer_id = ? ORDER BY is_primary DESC, name', [req.params.id]);
  customer.opportunities = all('SELECT * FROM opportunities WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
  customer.activities = all('SELECT * FROM activities WHERE customer_id = ? ORDER BY created_at DESC', [req.params.id]);
  customer.vehicles = all('SELECT * FROM vehicles WHERE customer_id = ? ORDER BY received_at DESC', [req.params.id]);
  res.json(customer);
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const status = b.status || 'lead';
  const roles = cleanRoles(b.roles, ['lead', 'prospecto'].includes(status) ? 'potencial' : 'cliente');
  const result = run(
    `INSERT INTO customers (type, name, tax_id, email, phone, address, city, zip, industry, status, source, notes,
                            roles, aliases, state, phone2, website, preferred_language)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [b.type || 'empresa', String(b.name).trim(), b.taxId || null, b.email || null, b.phone || null, b.address || null,
     b.city || null, b.zip || null, b.industry || null, status, b.source || null, b.notes || null,
     roles, b.aliases || null, b.state || null, b.phone2 || null, b.website || null, b.preferredLanguage || 'en']
  );
  const id = result.lastInsertRowid;
  // Primer contacto (opcional) en el mismo paso: la persona que llamó.
  const fc = b.firstContact;
  if (fc && fc.name && String(fc.name).trim()) {
    run(`INSERT INTO contacts (customer_id, name, role, contact_type, email, phone, mobile, is_primary, notes) VALUES (?,?,?,?,?,?,?,1,?)`,
      [id, String(fc.name).trim(), fc.role || null, fc.contactType || null, fc.email || null, fc.phone || null, fc.mobile || null, fc.notes || null]);
  }
  ensureSupplierLink(id);
  res.status(201).json(get('SELECT * FROM customers WHERE id = ?', [id]));
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Cliente no encontrado' });
  const roles = b.roles !== undefined ? cleanRoles(b.roles, existing.roles || 'cliente') : existing.roles;
  run(
    `UPDATE customers SET type=?, name=?, tax_id=?, email=?, phone=?, address=?, city=?, zip=?, industry=?, status=?, source=?, notes=?,
       roles=?, aliases=?, state=?, phone2=?, website=?, preferred_language=?, updated_at=?
     WHERE id=?`,
    [b.type ?? existing.type, b.name ?? existing.name, b.taxId ?? existing.tax_id, b.email ?? existing.email,
     b.phone ?? existing.phone, b.address ?? existing.address, b.city ?? existing.city, b.zip ?? existing.zip, b.industry ?? existing.industry,
     b.status ?? existing.status, b.source ?? existing.source, b.notes ?? existing.notes,
     roles, b.aliases ?? existing.aliases, b.state ?? existing.state, b.phone2 ?? existing.phone2, b.website ?? existing.website,
     b.preferredLanguage ?? existing.preferred_language ?? 'en', nowIso(), req.params.id]
  );
  ensureSupplierLink(req.params.id);
  res.json(get('SELECT * FROM customers WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM customers WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

// ---- Contacts ----
// Cada cliente puede tener muchas personas: dueño, gerente, compras, mecánico, operador… Cada una
// con sus datos y, si se quiere, sus propios vehículos/equipos (vehicles.contact_id).
function contactParams(b, existing = {}) {
  const pick = (k, col) => (b[k] !== undefined ? (String(b[k] ?? '').trim() || null) : (existing[col] ?? null));
  return {
    name: pick('name', 'name'), role: pick('role', 'role'), contact_type: pick('contactType', 'contact_type'),
    email: pick('email', 'email'), phone: pick('phone', 'phone'), mobile: pick('mobile', 'mobile'),
    preferred_channel: pick('preferredChannel', 'preferred_channel'), notes: pick('notes', 'notes'),
    is_primary: b.isPrimary !== undefined ? (b.isPrimary ? 1 : 0) : (existing.is_primary || 0),
    active: b.active !== undefined ? (b.active ? 1 : 0) : (existing.active ?? 1),
  };
}

router.post('/:id/contacts', (req, res) => {
  const p = contactParams(req.body);
  if (!p.name) return res.status(400).json({ error: 'El nombre del contacto es obligatorio' });
  if (!get('SELECT id FROM customers WHERE id = ?', [req.params.id])) return res.status(404).json({ error: 'Cliente no encontrado' });
  const first = !get('SELECT id FROM contacts WHERE customer_id = ? LIMIT 1', [req.params.id]);
  if (p.is_primary) run('UPDATE contacts SET is_primary = 0 WHERE customer_id = ?', [req.params.id]);
  const result = run(
    `INSERT INTO contacts (customer_id, name, role, contact_type, email, phone, mobile, preferred_channel, notes, is_primary, active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [req.params.id, p.name, p.role, p.contact_type, p.email, p.phone, p.mobile, p.preferred_channel, p.notes, first ? 1 : p.is_primary, p.active]
  );
  res.status(201).json(get('SELECT * FROM contacts WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/contacts/:contactId', (req, res) => {
  const existing = get('SELECT * FROM contacts WHERE id = ?', [req.params.contactId]);
  if (!existing) return res.status(404).json({ error: 'Contacto no encontrado' });
  const p = contactParams(req.body, existing);
  if (!p.name) return res.status(400).json({ error: 'El nombre del contacto es obligatorio' });
  if (p.is_primary && !existing.is_primary) run('UPDATE contacts SET is_primary = 0 WHERE customer_id = ?', [existing.customer_id]);
  run(`UPDATE contacts SET name=?, role=?, contact_type=?, email=?, phone=?, mobile=?, preferred_channel=?, notes=?, is_primary=?, active=? WHERE id=?`,
    [p.name, p.role, p.contact_type, p.email, p.phone, p.mobile, p.preferred_channel, p.notes, p.is_primary, p.active, existing.id]);
  res.json(get('SELECT * FROM contacts WHERE id = ?', [existing.id]));
});

router.delete('/contacts/:contactId', (req, res) => {
  run('DELETE FROM contacts WHERE id = ?', [req.params.contactId]);
  res.status(204).end();
});

// ---- Opportunities ----
router.post('/:id/opportunities', (req, res) => {
  const b = req.body;
  if (!b.title) return res.status(400).json({ error: 'El título es obligatorio' });
  const result = run(
    `INSERT INTO opportunities (customer_id, title, stage, value, probability, expected_close, notes)
     VALUES (?,?,?,?,?,?,?)`,
    [req.params.id, b.title, b.stage || 'nuevo', b.value ?? null, b.probability ?? null, b.expectedClose || null, b.notes || null]
  );
  res.status(201).json(get('SELECT * FROM opportunities WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/opportunities/:oppId', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM opportunities WHERE id = ?', [req.params.oppId]);
  if (!existing) return res.status(404).json({ error: 'Oportunidad no encontrada' });
  run(
    `UPDATE opportunities SET title=?, stage=?, value=?, probability=?, expected_close=?, notes=?, updated_at=? WHERE id=?`,
    [b.title ?? existing.title, b.stage ?? existing.stage, b.value ?? existing.value, b.probability ?? existing.probability,
     b.expectedClose ?? existing.expected_close, b.notes ?? existing.notes, nowIso(), req.params.oppId]
  );
  res.json(get('SELECT * FROM opportunities WHERE id = ?', [req.params.oppId]));
});

router.delete('/opportunities/:oppId', (req, res) => {
  run('DELETE FROM opportunities WHERE id = ?', [req.params.oppId]);
  res.status(204).end();
});

// ---- Activities (interacciones: llamadas, correos, textos, visitas, notas, tareas) ----
router.post('/:id/activities', (req, res) => {
  const b = req.body;
  if (!b.subject || !b.type) return res.status(400).json({ error: 'Tipo y asunto son obligatorios' });
  const result = run(
    `INSERT INTO activities (customer_id, type, subject, notes, due_date, done, contact_id, request_id, direction, created_by, occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [req.params.id, b.type, b.subject, b.notes || null, b.dueDate || null, b.done ? 1 : 0,
     b.contactId || null, b.requestId || null, b.direction || null, req.user ? req.user.id : null, b.occurredAt || nowIso()]
  );
  res.status(201).json(get('SELECT * FROM activities WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/activities/:actId', (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM activities WHERE id = ?', [req.params.actId]);
  if (!existing) return res.status(404).json({ error: 'Actividad no encontrada' });
  run(
    `UPDATE activities SET type=?, subject=?, notes=?, due_date=?, done=? WHERE id=?`,
    [b.type ?? existing.type, b.subject ?? existing.subject, b.notes ?? existing.notes,
     b.dueDate ?? existing.due_date, b.done !== undefined ? (b.done ? 1 : 0) : existing.done, req.params.actId]
  );
  res.json(get('SELECT * FROM activities WHERE id = ?', [req.params.actId]));
});

router.delete('/activities/:actId', (req, res) => {
  run('DELETE FROM activities WHERE id = ?', [req.params.actId]);
  res.status(204).end();
});

module.exports = router;
