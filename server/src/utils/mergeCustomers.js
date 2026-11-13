// Fusionar clientes duplicados: todo lo que apunta a los clientes "origen" (vehículos, contactos,
// facturas, órdenes, solicitudes, oportunidades, historial, seriales, garantías…) pasa al cliente
// "destino", y los orígenes se borran. Los datos vacíos del destino se completan con los del origen,
// y los nombres de los orígenes quedan como alias para que la búsqueda los siga encontrando.
const { db, all, get, run, nowIso } = require('../../db');

// Todas las columnas de cualquier tabla que guarden un id de cliente: las que tienen llave foránea
// a customers y las que se llaman customer_id (algunas se agregaron con ALTER sin llave foránea).
function customerRefColumns() {
  const tables = all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").map((t) => t.name);
  const refs = [];
  for (const t of tables) {
    if (t === 'customers') continue;
    const cols = new Set();
    for (const fk of all(`PRAGMA foreign_key_list("${t}")`)) if (fk.table === 'customers') cols.add(fk.from);
    for (const c of all(`PRAGMA table_info("${t}")`)) if (c.name === 'customer_id') cols.add(c.name);
    for (const c of cols) refs.push({ table: t, column: c });
  }
  return refs;
}

const FILL_FIELDS = ['tax_id', 'email', 'phone', 'phone2', 'address', 'city', 'state', 'zip', 'industry', 'source', 'website', 'supplier_id'];

function mergeCustomers(targetId, sourceIds, newName) {
  targetId = Number(targetId);
  const ids = [...new Set((sourceIds || []).map(Number))].filter((x) => x && x !== targetId);
  const target = get('SELECT * FROM customers WHERE id = ?', [targetId]);
  if (!target) throw new Error('Cliente destino no existe');
  if (!ids.length) throw new Error('Elige al menos un cliente para fusionar');
  const sources = ids.map((id) => get('SELECT * FROM customers WHERE id = ?', [id]));
  if (sources.some((s) => !s)) throw new Error('Uno de los clientes a fusionar no existe');

  const keepPrimary = get('SELECT id FROM contacts WHERE customer_id = ? AND is_primary = 1 ORDER BY id LIMIT 1', [targetId]);
  const refs = customerRefColumns();
  const moved = {};
  db.exec('BEGIN');
  try {
    for (const { table, column } of refs) {
      const r = run(`UPDATE "${table}" SET "${column}" = ? WHERE "${column}" IN (${ids.map(() => '?').join(',')})`, [targetId, ...ids]);
      if (r.changes) moved[table] = (moved[table] || 0) + Number(r.changes);
    }
    // Completar datos vacíos, unir roles, alias y notas.
    const upd = {};
    for (const f of FILL_FIELDS) {
      if (target[f] == null || target[f] === '') {
        const s = sources.find((x) => x[f] != null && x[f] !== '');
        if (s) upd[f] = s[f];
      }
    }
    const split = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
    upd.roles = [...new Set([target, ...sources].flatMap((c) => split(c.roles)))].join(',') || target.roles;
    const finalName = (newName && String(newName).trim()) || target.name;
    const aliasSet = new Set([...split(target.aliases), ...sources.flatMap((s) => [s.name, ...split(s.aliases)])]);
    if (finalName !== target.name) aliasSet.add(target.name);
    aliasSet.delete(finalName);
    upd.aliases = [...aliasSet].join(', ') || null;
    const notes = [target.notes, ...sources.map((s) => s.notes)].filter((n) => n && String(n).trim());
    upd.notes = [...new Set(notes)].join('\n\n') || null;
    upd.name = finalName;
    if (['lead', 'prospecto'].includes(target.status)) {
      const better = sources.find((s) => !['lead', 'prospecto'].includes(s.status));
      if (better) upd.status = better.status;
    }
    upd.updated_at = nowIso();
    const keys = Object.keys(upd);
    run(`UPDATE customers SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => upd[k]), targetId]);
    // Solo un contacto principal.
    const prim = all('SELECT id FROM contacts WHERE customer_id = ? AND is_primary = 1 ORDER BY id', [targetId]);
    const keep = keepPrimary ? keepPrimary.id : (prim[0] && prim[0].id);
    for (const p of prim) if (p.id !== keep) run('UPDATE contacts SET is_primary = 0 WHERE id = ?', [p.id]);
    for (const id of ids) run('DELETE FROM customers WHERE id = ?', [id]);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return { customer: get('SELECT * FROM customers WHERE id = ?', [targetId]), merged: sources.map((s) => ({ id: s.id, name: s.name })), moved };
}

module.exports = { mergeCustomers };
