const { all, get, run, nowIso } = require('../../db');
const { nextDocNumber } = require('./numbering');

// Enlace entre las solicitudes del CRM (llamadas, correos…) y la recepción del equipo / vehículo.
//
// Caso típico: entra una llamada de alguien que no dio el nombre de la empresa, se registra la
// solicitud con un cliente provisional (p. ej. "VAN AIR COMPRESOR") y el teléfono. Días después
// llega el equipo y se recibe con el cliente real (p. ej. "FPI Pipelining"). Aquí se detecta que
// la recepción corresponde a esa llamada (mismo teléfono / correo / cliente y mismo producto, o el
// VIN / serial escrito en la llamada) y se enlaza todo: la solicitud queda ligada al vehículo, pasa
// al cliente real con su historial, y si el cliente provisional quedó vacío se fusiona en el real.

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const digits = (s) => String(s || '').replace(/\D/g, '');
const phone10 = (s) => { const d = digits(s); return d.length >= 7 ? d.slice(-10) : ''; };
const alnum = (s) => fold(s).replace(/[^a-z0-9]/g, '');
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
// Palabras que no identifican un producto
const STOP = new Set(['de', 'la', 'el', 'los', 'las', 'del', 'con', 'para', 'por', 'una', 'uno', 'the', 'and', 'with', 'for',
  'truck', 'camion', 'camión', 'equipo', 'equipment', 'chasis', 'chassis', 'vehiculo', 'vehicle', 'new', 'nuevo', 'gas', 'powered']);

const OPEN = "('nueva','en_proceso','cotizada')";

function customerPhones(customerId) {
  if (!customerId) return [];
  const c = get('SELECT phone, phone2 FROM customers WHERE id = ?', [customerId]);
  const ks = all('SELECT phone, mobile FROM contacts WHERE customer_id = ?', [customerId]);
  return [c && c.phone, c && c.phone2, ...ks.flatMap((k) => [k.phone, k.mobile])].map(phone10).filter(Boolean);
}
function customerEmails(customerId) {
  if (!customerId) return [];
  const c = get('SELECT email FROM customers WHERE id = ?', [customerId]);
  const ks = all('SELECT email FROM contacts WHERE customer_id = ?', [customerId]);
  return [c && c.email, ...ks.map((k) => k.email)].map((e) => fold(e).trim()).filter((e) => e.includes('@'));
}

// Texto completo de la solicitud (asunto, detalles, ítems) para buscar el producto y el VIN / serial
function requestText(r) {
  const items = all('SELECT description, notes FROM crm_request_items WHERE request_id = ?', [r.id]);
  return [r.subject, r.notes, ...items.flatMap((i) => [i.description, i.notes])].filter(Boolean).join(' ');
}

// Palabras que identifican el equipo recibido: marca, modelo, VIN, seriales y modelos de los equipos instalados
function vehicleKeys(v) {
  const eq = all(`SELECT e.serial_number, e.manufacturer, e.model, COALESCE(t.name, e.custom_type_name) AS type_name
                  FROM vehicle_equipment e LEFT JOIN equipment_types t ON t.id = e.equipment_type_id WHERE e.vehicle_id = ?`, [v.id]);
  const ids = [v.vin, v.plate, ...eq.map((e) => e.serial_number)].map(alnum).filter((x) => x.length >= 5);
  const words = new Set();
  const addWords = (s) => fold(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d{4}$/.test(w)).forEach((w) => words.add(w));
  [v.make, v.model, ...eq.flatMap((e) => [e.manufacturer, e.model])].forEach(addWords);
  // Modelos con números (G60, MV607, VST-52) pesan más que una marca suelta
  const models = new Set([v.model, ...eq.map((e) => e.model)].flatMap((s) => fold(s).split(/[^a-z0-9]+/)).filter((w) => w.length >= 2 && /\d/.test(w) && /[a-z]/.test(w)));
  return { ids, words: [...words], models: [...models] };
}

// Busca las solicitudes abiertas (sin vehículo enlazado) que pueden corresponder a esta recepción.
// Devuelve [{ request, score, reasons[], strong }] ordenado de mayor a menor coincidencia.
function findRequestMatches(vehicleId) {
  const v = get('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
  if (!v) return [];
  const keys = vehicleKeys(v);
  const vPhones = customerPhones(v.customer_id);
  const vEmails = customerEmails(v.customer_id);
  const reqs = all(`SELECT r.*, c.name AS customer_name, c.status AS customer_status FROM crm_requests r JOIN customers c ON c.id = r.customer_id
                    WHERE r.vehicle_id IS NULL AND r.status IN ${OPEN} AND r.created_at >= datetime('now', '-365 days')
                    ORDER BY r.created_at DESC`);
  const out = [];
  for (const r of reqs) {
    const text = requestText(r);
    const ftext = fold(text);
    const atext = alnum(text);
    const reasons = [];
    // 1) VIN, placa o serial escrito en la llamada
    const idHit = keys.ids.find((x) => atext.includes(x));
    if (idHit) reasons.push('vin');
    // 2) Mismo cliente, mismo teléfono o mismo correo
    let contact = false;
    if (v.customer_id && r.customer_id === v.customer_id) { contact = true; reasons.push('cliente'); }
    const rPhones = [phone10(r.reply_to), ...(text.match(/[\d()+\-. ]{7,}/g) || []).map(phone10), ...customerPhones(r.customer_id)].filter(Boolean);
    if (vPhones.length && rPhones.some((p) => vPhones.includes(p))) { contact = true; reasons.push('telefono'); }
    const rEmails = [...String(r.reply_to || '').matchAll(EMAIL_RE), ...text.matchAll(EMAIL_RE)].map((m) => fold(m[0])).concat(customerEmails(r.customer_id));
    if (vEmails.length && rEmails.some((e) => vEmails.includes(e))) { contact = true; reasons.push('correo'); }
    // 3) Mismo producto: modelo (pesa más) o marca / palabras del equipo
    const modelHits = keys.models.filter((m) => new RegExp(`(^|[^a-z0-9])${m}([^a-z0-9]|$)`).test(ftext) || atext.includes(m));
    const wordHits = keys.words.filter((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(ftext));
    const product = modelHits.length > 0 || wordHits.length >= 2;
    if (product) reasons.push('producto');

    let score = 0;
    if (idHit) score = 100;
    else if (contact && product) score = 95;
    else if (contact) score = 70;
    else if (modelHits.length && wordHits.length >= 2) score = 60;
    else if (product) score = 45;
    if (score < 45) continue;
    // Enlace automático solo cuando no hay duda: VIN / serial, o contacto + mismo producto
    out.push({ request: { id: r.id, number: r.number, subject: r.subject, notes: r.notes, created_at: r.created_at, channel: r.channel, reply_to: r.reply_to, customer_id: r.customer_id, customer_name: r.customer_name, status: r.status },
      score, reasons, strong: score >= 95 });
  }
  out.sort((a, b) => b.score - a.score || String(b.request.created_at).localeCompare(String(a.request.created_at)));
  return out.slice(0, 8);
}

// ¿El cliente quedó vacío (solo era un nombre provisional de la llamada)? Sin facturas, pedidos,
// vehículos, solicitudes ni seriales: entonces se puede fusionar en el cliente real.
function isEmptyCustomer(id) {
  const c = get('SELECT * FROM customers WHERE id = ?', [id]);
  if (!c || c.supplier_id) return false;
  const n = (sql) => get(sql, [id]).n;
  return n('SELECT COUNT(*) AS n FROM crm_requests WHERE customer_id = ?') === 0
    && n('SELECT COUNT(*) AS n FROM invoices WHERE customer_id = ?') === 0
    && n('SELECT COUNT(*) AS n FROM sales_orders WHERE customer_id = ?') === 0
    && n('SELECT COUNT(*) AS n FROM vehicles WHERE customer_id = ?') === 0
    && n('SELECT COUNT(*) AS n FROM product_serials WHERE customer_id = ?') === 0;
}

// Pasa el cliente provisional al real: contactos, interacciones y oportunidades; el nombre
// provisional queda como alias del real (así una búsqueda por ese nombre lo sigue encontrando)
// y el teléfono / correo se completan si el real no los tenía. El provisional se elimina solo si
// lo hace el administrador; si no, queda inactivo con una nota.
function mergeCustomerInto(fromId, toId, user) {
  const from = get('SELECT * FROM customers WHERE id = ?', [fromId]);
  const to = get('SELECT * FROM customers WHERE id = ?', [toId]);
  if (!from || !to || fromId === toId) return null;
  run('UPDATE contacts SET customer_id = ?, is_primary = 0 WHERE customer_id = ?', [toId, fromId]);
  run('UPDATE activities SET customer_id = ? WHERE customer_id = ?', [toId, fromId]);
  run('UPDATE opportunities SET customer_id = ? WHERE customer_id = ?', [toId, fromId]);
  try { run('UPDATE warranties SET customer_id = ? WHERE customer_id = ?', [toId, fromId]); } catch (e) { /* tabla opcional */ }
  const aliases = [...String(to.aliases || '').split(/[,;\n]/), from.name, ...String(from.aliases || '').split(/[,;\n]/)]
    .map((s) => s.trim()).filter((s) => s && fold(s) !== fold(to.name));
  const uniq = [...new Map(aliases.map((a) => [fold(a), a])).values()].join(', ');
  let phone = to.phone; let phone2 = to.phone2;
  const known = [phone, phone2].map(phone10).filter(Boolean);
  for (const p of [from.phone, from.phone2].filter((x) => phone10(x) && !known.includes(phone10(x)))) {
    if (!String(phone || '').trim()) phone = p; else if (!String(phone2 || '').trim()) phone2 = p;
    known.push(phone10(p));
  }
  run('UPDATE customers SET aliases = ?, phone = ?, phone2 = ?, email = COALESCE(NULLIF(email,\'\'), ?), updated_at = ? WHERE id = ?',
    [uniq || null, phone || null, phone2 || null, from.email || null, nowIso(), toId]);
  run(`INSERT INTO activities (customer_id, type, subject, notes, done, created_by, occurred_at) VALUES (?, 'nota', ?, ?, 1, ?, ?)`,
    [toId, `Cliente "${from.name}" (de la llamada) fusionado en ${to.name}`, 'Se detectó que la llamada y la recepción del equipo son del mismo cliente.', user ? user.id : null, nowIso()]);
  if (user && user.role === 'admin') {
    run('DELETE FROM customers WHERE id = ?', [fromId]);
    return { merged: true, deleted: true, name: from.name };
  }
  const note = `Fusionado en ${to.name} (#${toId}) el ${nowIso().slice(0, 10)} — se puede eliminar.`;
  run(`UPDATE customers SET status = 'inactivo', notes = CASE WHEN COALESCE(notes,'') = '' THEN ? ELSE notes || char(10) || ? END, updated_at = ? WHERE id = ?`,
    [note, note, nowIso(), fromId]);
  return { merged: true, deleted: false, name: from.name };
}

// Enlaza la solicitud con el vehículo / equipo recibido. Si son de clientes distintos, la
// solicitud (con su historial, archivos y cotización en borrador) pasa al cliente del vehículo,
// y el cliente provisional de la llamada se fusiona si quedó vacío. Si el vehículo no tenía
// cliente, toma el de la llamada.
function linkRequestToVehicle(requestId, vehicleId, user, how = 'manual') {
  const r = get('SELECT * FROM crm_requests WHERE id = ?', [requestId]);
  const v = get('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
  if (!r || !v) throw Object.assign(new Error('Solicitud o vehículo no encontrado'), { status: 404 });
  const uid = user ? user.id : null;
  const result = { requestId: r.id, requestNumber: r.number, vehicleId: v.id, movedFrom: null, merge: null };
  run(`UPDATE crm_requests SET vehicle_id = ?, status = CASE WHEN status = 'nueva' THEN 'en_proceso' ELSE status END, updated_at = ? WHERE id = ?`,
    [v.id, nowIso(), r.id]);

  if (!v.customer_id) {
    run('UPDATE vehicles SET customer_id = ? WHERE id = ?', [r.customer_id, v.id]);
  } else if (v.customer_id !== r.customer_id) {
    const oldCustomer = get('SELECT id, name FROM customers WHERE id = ?', [r.customer_id]);
    run('UPDATE crm_requests SET customer_id = ?, contact_id = NULL WHERE id = ?', [v.customer_id, r.id]);
    run('UPDATE activities SET customer_id = ? WHERE request_id = ?', [v.customer_id, r.id]);
    // La cotización de la solicitud se mueve solo si no está facturada
    if (r.sales_order_id) {
      run(`UPDATE sales_orders SET customer_id = ?, contact_id = NULL WHERE id = ?
           AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.sales_order_id = sales_orders.id AND i.status NOT IN ('anulada','cancelado'))`, [v.customer_id, r.sales_order_id]);
    }
    result.movedFrom = oldCustomer;
    if (oldCustomer && isEmptyCustomer(oldCustomer.id)) result.merge = mergeCustomerInto(oldCustomer.id, v.customer_id, user);
  }
  const customerId = get('SELECT customer_id FROM crm_requests WHERE id = ?', [r.id]).customer_id;
  run(`INSERT INTO activities (customer_id, type, subject, notes, done, request_id, created_by, occurred_at) VALUES (?, 'nota', ?, ?, 1, ?, ?, ?)`,
    [customerId, `${r.number}: enlazada con la recepción ${v.vin}${how === 'auto' ? ' (automático)' : ''}`,
      [v.make, v.model, v.year].filter(Boolean).join(' ') || null, r.id, uid, nowIso()]);
  return result;
}

// Enlaces automáticos para una recepción nueva (o editada): solo coincidencias seguras, y solo
// si hay una sola solicitud segura (si hay dos o más, se dejan como sugerencias para escoger).
function autoLinkVehicle(vehicleId, user) {
  const matches = findRequestMatches(vehicleId);
  const strong = matches.filter((m) => m.strong);
  if (strong.length !== 1) return [];
  try { return [linkRequestToVehicle(strong[0].request.id, vehicleId, user, 'auto')]; } catch (e) { console.error('Auto-enlace solicitud:', e.message); return []; }
}

function linkedRequests(vehicleId) {
  return all(`SELECT r.id, r.number, r.subject, r.status, r.channel, r.created_at, r.reply_to, r.customer_id, c.name AS customer_name,
                     (SELECT COUNT(*) FROM crm_request_files f WHERE f.request_id = r.id) AS files_count
              FROM crm_requests r JOIN customers c ON c.id = r.customer_id WHERE r.vehicle_id = ? ORDER BY r.created_at DESC`, [vehicleId]);
}

// Orden de trabajo (orden de servicio) para un vehículo, con sus servicios
function createWorkOrder(vehicleId, { mechanicId, supplierId, notes, diagnosis, services, requestId } = {}) {
  const calc = (s) => (s.pricingType === 'servicio_completo' ? Number(s.flatPrice || 0) : Math.round(Number(s.hours || 0) * Number(s.hourlyRate || 0) * 100) / 100);
  const number = nextDocNumber('work_orders', 'WO');
  const woId = run(`INSERT INTO work_orders (number, vehicle_id, mechanic_id, supplier_id, status, notes, diagnosis, request_id) VALUES (?,?,?,?,?,?,?,?)`,
    [number, vehicleId, supplierId ? null : (mechanicId || null), supplierId || null, 'pendiente', notes || null, diagnosis || null, requestId || null]).lastInsertRowid;
  for (const s of (Array.isArray(services) ? services : []).filter((x) => x && String(x.description || '').trim())) {
    run(`INSERT INTO work_order_services (work_order_id, service_id, description, pricing_type, hours, hourly_rate, flat_price, total) VALUES (?,?,?,?,?,?,?,?)`,
      [woId, s.serviceId || null, String(s.description).trim(), s.pricingType || 'hora', Number(s.hours) || 0, Number(s.hourlyRate) || 0, Number(s.flatPrice) || 0, calc(s)]);
  }
  run("UPDATE vehicles SET status = 'en_servicio' WHERE id = ? AND status = 'recibido'", [vehicleId]);
  return { id: woId, number };
}

module.exports = { findRequestMatches, linkRequestToVehicle, autoLinkVehicle, linkedRequests, createWorkOrder, mergeCustomerInto, isEmptyCustomer };
