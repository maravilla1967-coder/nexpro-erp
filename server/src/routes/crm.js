const express = require('express');
const { all, get, run, nowIso } = require('../../db');
const { nextDocNumber } = require('../utils/numbering');
const { requireModuleEdit } = require('../middleware/auth');
const { makeDocUploader } = require('../middleware/upload');
const { linkRequestToVehicle, createWorkOrder } = require('../utils/requestLinks');

const docUpload = makeDocUploader('crm-requests');

// CRM: búsqueda instantánea cuando alguien llama, detección de clientes duplicados, ficha 360
// del cliente (todo lo que se le ha hecho), solicitudes con productos/servicios escogidos de la
// lista y su paso a orden de pedido para cotizar.
const router = express.Router();
router.use(requireModuleEdit('clientes'));

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const digits = (s) => String(s || '').replace(/\D/g, '');
// Palabras que no distinguen a una empresa de otra ("Inc", "LLC", "City of"…).
const STOP = new Set(['inc', 'llc', 'corp', 'corporation', 'co', 'company', 'the', 'of', 'ltd', 'sa', 'sas', 'de', 'la', 'el', 'del', 'y', 'and', 'cia', 'pa', 'pllc', 'lp', 'llp', 'group', 'grupo']);
const tokens = (s) => fold(s).replace(/&/g, ' and ').split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
const squash = (s) => tokens(s).join('');

function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Qué tanto se parecen dos nombres de empresa (0-100). Detecta: mismo nombre con distinta
// escritura, uno contenido en el otro ("Miami Dade" ⊂ "Miami-Dade Water & Sewer"), errores de
// tipeo y siglas comunes.
function nameScore(a, b) {
  const sa = squash(a); const sb = squash(b);
  if (!sa || !sb) return 0;
  if (sa === sb) return 100;
  const ta = tokens(a); const tb = tokens(b);
  const setA = new Set(ta); const setB = new Set(tb);
  const inter = ta.filter((w) => setB.has(w)).length;
  let score = 0;
  if (inter && (ta.every((w) => setB.has(w)) || tb.every((w) => setA.has(w)))) score = Math.max(score, 82);
  if (sa.length >= 3 && sb.length >= 3 && (sa.startsWith(sb) || sb.startsWith(sa))) score = Math.max(score, 80);
  if (sa.length >= 4 && sb.length >= 4 && (sa.includes(sb) || sb.includes(sa))) score = Math.max(score, 72);
  const union = new Set([...ta, ...tb]).size;
  if (union) score = Math.max(score, Math.round((inter / union) * 75));
  const maxLen = Math.max(sa.length, sb.length);
  if (maxLen >= 5) {
    const ratio = 1 - lev(sa, sb) / maxLen;
    if (ratio >= 0.75) score = Math.max(score, Math.round(ratio * 90));
  }
  // Siglas: "MDWASD" ↔ "Miami Dade Water And Sewer Department"
  const initials = (t) => t.map((w) => w[0]).join('');
  if (sa.length >= 3 && sa.length <= 8 && initials(tb) === sa) score = Math.max(score, 78);
  if (sb.length >= 3 && sb.length <= 8 && initials(ta) === sb) score = Math.max(score, 78);
  return score;
}

// ---------- Clientes parecidos (para no crear duplicados) ----------
// GET /crm/duplicates?name=&phone=&email=&taxId=&excludeId=
router.get('/duplicates', (req, res) => {
  const { name, phone, email, taxId, excludeId } = req.query;
  const custs = all('SELECT id, name, aliases, phone, phone2, email, tax_id, city, status, roles FROM customers');
  const contactRows = all('SELECT customer_id, name, phone, mobile, email FROM contacts');
  const ph = digits(phone).slice(-10);
  const em = fold(email).trim();
  const tx = fold(taxId).replace(/[^a-z0-9]/g, '');
  const out = [];
  for (const c of custs) {
    if (excludeId && String(c.id) === String(excludeId)) continue;
    let score = 0; let reason = '';
    if (name && String(name).trim().length >= 2) {
      const names = [c.name, ...String(c.aliases || '').split(/[,;\n]/)].filter((x) => x && x.trim());
      for (const n of names) {
        const s = nameScore(name, n);
        if (s > score) { score = s; reason = n === c.name ? 'nombre' : `alias: ${n.trim()}`; }
      }
    }
    if (ph.length >= 7) {
      const phones = [c.phone, c.phone2, ...contactRows.filter((k) => k.customer_id === c.id).flatMap((k) => [k.phone, k.mobile])];
      if (phones.some((p) => digits(p).slice(-10) === ph)) { score = Math.max(score, 95); reason = 'mismo teléfono'; }
    }
    if (em && em.includes('@')) {
      const emails = [c.email, ...contactRows.filter((k) => k.customer_id === c.id).map((k) => k.email)].map((e) => fold(e).trim());
      if (emails.includes(em)) { score = Math.max(score, 95); reason = 'mismo correo'; }
    }
    if (tx.length >= 4 && fold(c.tax_id).replace(/[^a-z0-9]/g, '') === tx) { score = 100; reason = 'mismo NIT / Tax ID'; }
    if (score >= 45) out.push({ ...c, score, reason });
  }
  out.sort((a, b) => b.score - a.score);
  res.json(out.slice(0, 8));
});

// ---------- Búsqueda de la llamada ----------
// GET /crm/lookup?q=  → busca por teléfono (cualquier formato), nombre del cliente o de la persona,
// alias, correo, VIN / placa del vehículo o número de serie de un equipo, y proveedores.
router.get('/lookup', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const qd = digits(q);
  const qf = fold(q);
  const terms = qf.split(/\s+/).filter(Boolean);
  const textHit = (...fields) => {
    const t = fold(fields.filter(Boolean).join(' '));
    return terms.every((w) => t.includes(w));
  };
  const phoneHit = (...phones) => qd.length >= 4 && phones.some((p) => digits(p).includes(qd));
  const hits = [];
  const seen = new Set();
  const push = (h) => { const k = `${h.kind}:${h.customer_id || ''}:${h.contact_id || ''}:${h.supplier_id || ''}:${h.vehicle_id || ''}`; if (!seen.has(k)) { seen.add(k); hits.push(h); } };

  const custs = all('SELECT id, name, aliases, phone, phone2, email, tax_id, city, status, roles FROM customers');
  for (const c of custs) {
    let score = 0; let matched = '';
    if (phoneHit(c.phone, c.phone2)) { score = 98; matched = c.phone || c.phone2; }
    if (textHit(c.name, c.aliases, c.email, c.tax_id, c.city)) { score = Math.max(score, fold(c.name).startsWith(qf) ? 90 : 75); matched = matched || c.name; }
    if (!score && qf.length >= 3) { const s = nameScore(q, c.name); if (s >= 60) { score = s - 10; matched = c.name; } }
    if (score) push({ kind: 'cliente', score, customer_id: c.id, title: c.name, subtitle: [c.city, c.phone, c.email].filter(Boolean).join(' · '), roles: c.roles, status: c.status, matched });
  }

  const contacts = all(`SELECT k.*, c.name AS customer_name, c.roles, c.status FROM contacts k JOIN customers c ON c.id = k.customer_id`);
  for (const k of contacts) {
    let score = 0;
    if (phoneHit(k.phone, k.mobile)) score = 99;
    if (textHit(k.name, k.email, k.role)) score = Math.max(score, fold(k.name).startsWith(qf) ? 88 : 70);
    if (score) push({ kind: 'contacto', score, customer_id: k.customer_id, contact_id: k.id, title: `${k.name} — ${k.customer_name}`, subtitle: [k.role, k.phone || k.mobile, k.email].filter(Boolean).join(' · '), roles: k.roles, status: k.status, contact_type: k.contact_type });
  }

  if (q.length >= 3) {
    const like = `%${q}%`;
    for (const v of all(`SELECT v.id, v.vin, v.plate, v.make, v.model, v.year, v.customer_id, v.contact_id, c.name AS customer_name
                         FROM vehicles v LEFT JOIN customers c ON c.id = v.customer_id WHERE v.vin LIKE ? OR v.plate LIKE ? LIMIT 15`, [like, like])) {
      push({ kind: 'vehiculo', score: 85, customer_id: v.customer_id, contact_id: v.contact_id, vehicle_id: v.id, title: `${v.vin} — ${v.customer_name || 'sin cliente'}`, subtitle: [v.year, v.make, v.model, v.plate].filter(Boolean).join(' ') });
    }
    for (const e of all(`SELECT e.serial_number, e.manufacturer, e.model, v.id AS vehicle_id, v.vin, v.customer_id, v.contact_id, c.name AS customer_name,
                                COALESCE(t.name, e.custom_type_name) AS type_name
                         FROM vehicle_equipment e JOIN vehicles v ON v.id = e.vehicle_id LEFT JOIN customers c ON c.id = v.customer_id
                         LEFT JOIN equipment_types t ON t.id = e.equipment_type_id WHERE e.serial_number LIKE ? LIMIT 15`, [like])) {
      push({ kind: 'equipo', score: 86, customer_id: e.customer_id, contact_id: e.contact_id, vehicle_id: e.vehicle_id, title: `${e.type_name || 'Equipo'} S/N ${e.serial_number} — ${e.customer_name || 'sin cliente'}`, subtitle: [e.manufacturer, e.model, `VIN ${e.vin}`].filter(Boolean).join(' · ') });
    }
    for (const s of all(`SELECT s.serial, s.customer_id, p.name AS product_name, c.name AS customer_name FROM product_serials s
                         JOIN products p ON p.id = s.product_id LEFT JOIN customers c ON c.id = s.customer_id
                         WHERE s.serial LIKE ? AND s.customer_id IS NOT NULL LIMIT 10`, [like])) {
      push({ kind: 'equipo', score: 84, customer_id: s.customer_id, title: `S/N ${s.serial} — ${s.customer_name}`, subtitle: s.product_name });
    }
  }

  // Proveedores que todavía no tienen ficha en el CRM
  for (const s of all(`SELECT s.* FROM suppliers s WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.supplier_id = s.id)`)) {
    let score = 0;
    if (phoneHit(s.phone)) score = 90;
    if (textHit(s.name, s.email, s.code)) score = Math.max(score, 65);
    if (score) push({ kind: 'proveedor', score, supplier_id: s.id, title: s.name, subtitle: ['Proveedor', s.phone, s.email].filter(Boolean).join(' · ') });
  }

  hits.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));
  res.json(hits.slice(0, 30));
});

// Crear la ficha CRM de un proveedor (para registrarle llamadas, solicitudes, etc.)
router.post('/from-supplier/:id', (req, res) => {
  const s = get('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
  if (!s) return res.status(404).json({ error: 'Proveedor no encontrado' });
  const existing = get('SELECT id FROM customers WHERE supplier_id = ?', [s.id]);
  if (existing) return res.json({ id: existing.id });
  const id = run(`INSERT INTO customers (type, name, tax_id, email, phone, address, city, zip, status, roles, supplier_id, source)
                  VALUES ('empresa',?,?,?,?,?,?,?,'cliente','proveedor',?,'Proveedores')`,
  [s.name, s.tax_id, s.email, s.phone, s.address, s.city, s.zip, s.id]).lastInsertRowid;
  res.status(201).json({ id });
});

// ---------- Lista de productos / servicios para escoger sin escribir ----------
router.get('/catalog', (req, res) => {
  res.json({
    productTypes: all(`SELECT t.id, t.name, (SELECT COUNT(*) FROM products p WHERE p.product_type_id = t.id AND p.active = 1) AS count
                       FROM product_types t ORDER BY t.name`),
    products: all(`SELECT id, name, sku, vendor_item_number, description, selling_price, product_type_id, stock_qty
                   FROM products WHERE active = 1 ORDER BY name`),
    services: all('SELECT id, name, name_en, description, pricing_type, hourly_rate, flat_price FROM services WHERE active = 1 ORDER BY name'),
    equipmentTypes: all('SELECT id, name FROM equipment_types ORDER BY name'),
  });
});

// ---------- Ficha 360 del cliente ----------
function invoicesFor(customerId) {
  return all(`SELECT i.id, i.number, i.status, i.issue_date, i.due_date, i.total, i.sales_order_id,
                     COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id = i.id), 0) AS paid
              FROM invoices i WHERE i.customer_id = ? ORDER BY i.issue_date DESC, i.id DESC`, [customerId])
    .map((i) => ({ ...i, paid: round2(i.paid), balance: ['cancelado', 'anulada'].includes(i.status) ? 0 : round2(i.total - i.paid) }));
}

function requestsFor(where, params) {
  const reqs = all(`SELECT r.*, c.name AS customer_name, k.name AS contact_name, k.contact_type, k.email AS contact_email,
                           k.phone AS contact_phone, k.mobile AS contact_mobile, so.number AS sales_order_number, so.status AS sales_order_status,
                           (SELECT COALESCE(SUM(i.quantity * i.unit_price),0) FROM sales_order_items i WHERE i.sales_order_id = so.id) AS sales_order_total,
                           (SELECT COUNT(*) FROM sales_order_items i WHERE i.sales_order_id = so.id AND i.unit_price <= 0) AS sales_order_unpriced,
                           (SELECT inv.id FROM invoices inv WHERE inv.sales_order_id = so.id AND inv.status NOT IN ('anulada','cancelado')) AS invoice_id,
                           (SELECT inv.number FROM invoices inv WHERE inv.sales_order_id = so.id AND inv.status NOT IN ('anulada','cancelado')) AS invoice_number,
                           u.name AS created_by_name, au.name AS assigned_name, v.vin AS vehicle_vin
                    FROM crm_requests r
                    JOIN customers c ON c.id = r.customer_id
                    LEFT JOIN contacts k ON k.id = r.contact_id
                    LEFT JOIN sales_orders so ON so.id = r.sales_order_id
                    LEFT JOIN users u ON u.id = r.created_by
                    LEFT JOIN users au ON au.id = r.assigned_user_id
                    LEFT JOIN vehicles v ON v.id = r.vehicle_id
                    WHERE ${where} ORDER BY r.created_at DESC, r.id DESC`, params);
  const ids = reqs.map((r) => r.id);
  const items = ids.length ? all(`SELECT i.*, s.name_en AS service_name_en FROM crm_request_items i LEFT JOIN services s ON s.id = i.service_id
                                  WHERE i.request_id IN (${ids.map(() => '?').join(',')}) ORDER BY i.id`, ids) : [];
  const files = ids.length ? all(`SELECT f.*, u.name AS created_by_name FROM crm_request_files f LEFT JOIN users u ON u.id = f.created_by
                                  WHERE f.request_id IN (${ids.map(() => '?').join(',')}) ORDER BY f.id`, ids) : [];
  for (const r of reqs) {
    r.items = items.filter((i) => i.request_id === r.id);
    r.files = files.filter((f) => f.request_id === r.id);
  }
  return reqs;
}

router.get('/customers/:id/360', (req, res) => {
  const id = Number(req.params.id);
  const customer = get('SELECT * FROM customers WHERE id = ?', [id]);
  if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });
  if (customer.supplier_id) customer.supplier = get('SELECT id, name, code FROM suppliers WHERE id = ?', [customer.supplier_id]);

  const contacts = all('SELECT * FROM contacts WHERE customer_id = ? ORDER BY is_primary DESC, active DESC, name', [id]);
  const requests = requestsFor('r.customer_id = ?', [id]);
  const interactions = all(`SELECT a.*, k.name AS contact_name, u.name AS created_by_name, r.number AS request_number
                            FROM activities a LEFT JOIN contacts k ON k.id = a.contact_id
                            LEFT JOIN users u ON u.id = a.created_by LEFT JOIN crm_requests r ON r.id = a.request_id
                            WHERE a.customer_id = ? ORDER BY COALESCE(a.occurred_at, a.created_at) DESC, a.id DESC`, [id]);
  const opportunities = all('SELECT * FROM opportunities WHERE customer_id = ? ORDER BY created_at DESC', [id]);

  // Vehículos con sus equipos (seriales) y todo el historial de servicio
  const vehicles = all(`SELECT v.*, k.name AS contact_name FROM vehicles v LEFT JOIN contacts k ON k.id = v.contact_id
                        WHERE v.customer_id = ? ORDER BY v.received_at DESC`, [id]);
  for (const v of vehicles) {
    v.equipment = all(`SELECT e.*, COALESCE(t.name, e.custom_type_name) AS type_name FROM vehicle_equipment e
                       LEFT JOIN equipment_types t ON t.id = e.equipment_type_id WHERE e.vehicle_id = ? ORDER BY e.id`, [v.id]);
    v.work_orders = all(`SELECT w.id, w.number, w.status, w.created_at, w.updated_at, w.diagnosis, w.resolution, w.notes, w.invoice_id,
                                m.name AS mechanic_name, s.name AS supplier_name, i.number AS invoice_number,
                                (SELECT COALESCE(SUM(total),0) FROM work_order_services x WHERE x.work_order_id = w.id) +
                                (SELECT COALESCE(SUM(total),0) FROM work_order_parts x WHERE x.work_order_id = w.id) AS total
                         FROM work_orders w LEFT JOIN mechanics m ON m.id = w.mechanic_id LEFT JOIN suppliers s ON s.id = w.supplier_id
                         LEFT JOIN invoices i ON i.id = w.invoice_id WHERE w.vehicle_id = ? ORDER BY w.created_at DESC`, [v.id]);
    for (const w of v.work_orders) {
      w.services = all('SELECT description, pricing_type, hours, total FROM work_order_services WHERE work_order_id = ?', [w.id]);
      w.parts = all('SELECT description, action, quantity, serial, total FROM work_order_parts WHERE work_order_id = ?', [w.id]);
    }
    v.warranties = all('SELECT id, number, kind, status, item_description, serial_number, claim_date FROM warranties WHERE vehicle_id = ?', [v.id]);
  }

  const salesOrders = all(`SELECT so.*, k.name AS contact_name, r.number AS request_number,
                                  (SELECT COALESCE(SUM(i.quantity * i.unit_price),0) FROM sales_order_items i WHERE i.sales_order_id = so.id) AS total
                           FROM sales_orders so LEFT JOIN contacts k ON k.id = so.contact_id LEFT JOIN crm_requests r ON r.id = so.request_id
                           WHERE so.customer_id = ? ORDER BY so.created_at DESC`, [id]);
  const invoices = invoicesFor(id);
  const payments = all(`SELECT p.id, p.payment_date, p.amount, p.method, p.reference, i.number AS invoice_number, i.id AS invoice_id
                        FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.customer_id = ?
                        ORDER BY p.payment_date DESC, p.id DESC`, [id]);
  const serials = all(`SELECT s.id, s.serial, s.status, s.status_date, p.name AS product_name, i.number AS invoice_number, v.vin
                       FROM product_serials s JOIN products p ON p.id = s.product_id LEFT JOIN invoices i ON i.id = s.invoice_id
                       LEFT JOIN vehicles v ON v.id = s.vehicle_id
                       WHERE s.customer_id = ? OR s.vehicle_id IN (SELECT id FROM vehicles WHERE customer_id = ?) ORDER BY s.status_date DESC`, [id, id]);
  const warranties = all(`SELECT id, number, kind, status, item_description, serial_number, vin, claim_date, created_at FROM warranties
                          WHERE customer_id = ? OR vehicle_id IN (SELECT id FROM vehicles WHERE customer_id = ?) ORDER BY created_at DESC`, [id, id]);

  const live = invoices.filter((i) => !['cancelado', 'anulada'].includes(i.status));
  const today = new Date().toISOString().slice(0, 10);
  const summary = {
    total_invoiced: round2(live.reduce((s, i) => s + i.total, 0)),
    total_paid: round2(payments.reduce((s, p) => s + p.amount, 0)),
    balance_due: round2(live.reduce((s, i) => s + Math.max(0, i.balance), 0)),
    overdue: round2(live.filter((i) => i.balance > 0.004 && i.due_date && String(i.due_date).slice(0, 10) < today).reduce((s, i) => s + i.balance, 0)),
    open_requests: requests.filter((r) => ['nueva', 'en_proceso', 'cotizada'].includes(r.status)).length,
    open_quotes: salesOrders.filter((s) => !['facturado', 'cancelado'].includes(s.status)).length,
    vehicles: vehicles.length,
    equipment: vehicles.reduce((s, v) => s + v.equipment.length, 0),
    work_orders: vehicles.reduce((s, v) => s + v.work_orders.length, 0),
    last_interaction: interactions[0] ? (interactions[0].occurred_at || interactions[0].created_at) : null,
    first_invoice: live.length ? live[live.length - 1].issue_date : null,
  };

  // Línea de tiempo: todo lo que ha pasado con el cliente, en orden
  const tl = [];
  for (const a of interactions) tl.push({ date: a.occurred_at || a.created_at, kind: 'interaccion', type: a.type, title: a.subject, detail: a.notes, who: a.contact_name, by: a.created_by_name, direction: a.direction, ref: a.request_number });
  for (const r of requests) tl.push({ date: r.created_at, kind: 'solicitud', title: `${r.number} · ${r.subject || ''}`, detail: r.items.map((i) => `${i.quantity !== 1 ? `${i.quantity} × ` : ''}${i.description}`).join(', '), who: r.contact_name, status: r.status, link: `/crm/solicitudes?abrir=${r.id}` });
  for (const s of salesOrders) tl.push({ date: s.created_at, kind: 'pedido', title: `${s.number} · $${round2(s.total).toLocaleString('en-US')}`, status: s.status, who: s.contact_name, link: `/pedidos/${s.id}/documento` });
  for (const i of invoices) tl.push({ date: i.issue_date, kind: 'factura', title: `${i.number} · $${round2(i.total).toLocaleString('en-US')}`, status: i.status, detail: i.balance > 0.004 ? `Saldo $${i.balance.toLocaleString('en-US')}` : null, link: `/facturas/${i.id}` });
  for (const p of payments) tl.push({ date: p.payment_date, kind: 'pago', title: `$${round2(p.amount).toLocaleString('en-US')} → ${p.invoice_number}`, detail: [p.method, p.reference].filter(Boolean).join(' · '), link: `/facturas/${p.invoice_id}` });
  for (const v of vehicles) {
    tl.push({ date: v.received_at, kind: 'vehiculo', title: `VIN ${v.vin} · ${[v.year, v.make, v.model].filter(Boolean).join(' ')}`, detail: v.equipment.map((e) => `${e.type_name || ''}${e.serial_number ? ` S/N ${e.serial_number}` : ''}`).join(', '), who: v.contact_name, link: `/vehiculos/${v.id}` });
    for (const w of v.work_orders) tl.push({ date: w.created_at, kind: 'servicio', title: `${w.number} · VIN ${v.vin}`, detail: [...w.services.map((s) => s.description), ...w.parts.map((p) => p.description)].join(', '), status: w.status, who: w.mechanic_name || w.supplier_name, link: `/ordenes-trabajo/${w.id}/documento` });
  }
  for (const w of warranties) tl.push({ date: w.claim_date || w.created_at, kind: 'garantia', title: `${w.number} · ${w.item_description || ''}`, status: w.status, link: `/garantias/${w.id}/documento` });
  tl.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  res.json({ customer, contacts, requests, interactions, opportunities, vehicles, salesOrders, invoices, payments, serials, warranties, summary, timeline: tl });
});

// ---------- Solicitudes ----------
const PRICE = {
  producto: (i) => { const p = i.product_id && get('SELECT selling_price FROM products WHERE id = ?', [i.product_id]); return p ? p.selling_price : 0; },
  servicio: (i) => {
    const s = i.service_id && get('SELECT pricing_type, hourly_rate, flat_price FROM services WHERE id = ?', [i.service_id]);
    if (!s) return 0;
    return s.pricing_type === 'hora' ? (s.hourly_rate || 0) : (s.flat_price || 0);
  },
};

function cleanItems(items) {
  return (Array.isArray(items) ? items : []).map((i) => ({
    kind: ['producto', 'servicio', 'categoria', 'equipo', 'libre'].includes(i.kind) ? i.kind : 'libre',
    product_id: i.productId || i.product_id || null,
    service_id: i.serviceId || i.service_id || null,
    product_type_id: i.productTypeId || i.product_type_id || null,
    equipment_type_id: i.equipmentTypeId || i.equipment_type_id || null,
    description: String(i.description || '').trim(),
    quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
    notes: i.notes || null,
  })).filter((i) => i.description);
}

function saveItems(requestId, items) {
  run('DELETE FROM crm_request_items WHERE request_id = ?', [requestId]);
  for (const i of items) {
    run(`INSERT INTO crm_request_items (request_id, kind, product_id, service_id, product_type_id, equipment_type_id, description, quantity, notes)
         VALUES (?,?,?,?,?,?,?,?,?)`,
    [requestId, i.kind, i.product_id, i.service_id, i.product_type_id, i.equipment_type_id, i.description, i.quantity, i.notes]);
  }
}

const CHANNEL_TO_ACTIVITY = { llamada: 'llamada', email: 'email', texto: 'texto', whatsapp: 'whatsapp', web: 'web', visita: 'visita' };

function getRequest(id) {
  const r = requestsFor('r.id = ?', [id])[0];
  if (!r) return null;
  r.customer = get('SELECT id, name, email, phone, preferred_language, address, city, state, zip FROM customers WHERE id = ?', [r.customer_id]);
  r.interactions = all(`SELECT a.*, u.name AS created_by_name FROM activities a LEFT JOIN users u ON u.id = a.created_by
                        WHERE a.request_id = ? ORDER BY COALESCE(a.occurred_at, a.created_at) DESC`, [id]);
  // Equipo / vehículo recibido y órdenes de servicio de esta llamada
  r.vehicle = r.vehicle_id ? get('SELECT id, vin, make, model, year, status FROM vehicles WHERE id = ?', [r.vehicle_id]) : null;
  r.work_orders = all(`SELECT w.id, w.number, w.status, w.created_at, w.vehicle_id, v.vin FROM work_orders w JOIN vehicles v ON v.id = w.vehicle_id
                       WHERE w.request_id = ? OR (? IS NOT NULL AND w.vehicle_id = ?) ORDER BY w.created_at DESC`, [id, r.vehicle_id, r.vehicle_id]);
  return r;
}

// Crea (o completa) la orden de pedido de la solicitud: los productos y servicios van con su
// precio de lista; las categorías / equipos / texto libre van en $0 "por cotizar" para que se
// revisen y se pongan con exactitud antes de enviar la cotización. Nunca borra líneas ya puestas.
function quoteFromRequest(requestId) {
  const r = get('SELECT * FROM crm_requests WHERE id = ?', [requestId]);
  const items = all('SELECT * FROM crm_request_items WHERE request_id = ? ORDER BY id', [requestId]);
  if (!items.length) throw Object.assign(new Error('La solicitud no tiene productos o servicios para cotizar'), { status: 400 });
  let soId = r.sales_order_id;
  if (soId && !get('SELECT id FROM sales_orders WHERE id = ?', [soId])) soId = null;
  if (soId) {
    const so = get('SELECT status FROM sales_orders WHERE id = ?', [soId]);
    if (so.status !== 'borrador') return soId; // ya se revisó / envió: no se toca
  } else {
    const number = nextDocNumber('sales_orders', 'QT');
    soId = run(`INSERT INTO sales_orders (number, customer_id, status, notes, contact_id, request_id) VALUES (?,?,?,?,?,?)`,
      [number, r.customer_id, 'borrador', `Solicitud ${r.number}${r.subject ? `: ${r.subject}` : ''}`, r.contact_id, r.id]).lastInsertRowid;
    run('UPDATE crm_requests SET sales_order_id = ?, status = CASE WHEN status = \'nueva\' THEN \'en_proceso\' ELSE status END, updated_at = ? WHERE id = ?', [soId, nowIso(), r.id]);
  }
  const existing = all('SELECT description FROM sales_order_items WHERE sales_order_id = ?', [soId]).map((x) => fold(x.description));
  for (const i of items) {
    const isPriced = i.kind === 'producto' || i.kind === 'servicio';
    const desc = isPriced ? i.description : `${i.description} (por cotizar)`;
    if (existing.includes(fold(desc))) continue;
    const price = isPriced ? round2(PRICE[i.kind](i)) : 0;
    run(`INSERT INTO sales_order_items (sales_order_id, product_id, description, quantity, unit_price) VALUES (?,?,?,?,?)`,
      [soId, i.product_id || null, desc, i.quantity || 1, price]);
    existing.push(fold(desc));
  }
  run('UPDATE sales_orders SET updated_at = ? WHERE id = ?', [nowIso(), soId]);
  return soId;
}

router.get('/requests', (req, res) => {
  const { status, q, customerId } = req.query;
  let where = '1=1'; const params = [];
  if (status === 'abiertas') where += " AND r.status IN ('nueva','en_proceso','cotizada')";
  else if (status) { where += ' AND r.status = ?'; params.push(status); }
  if (customerId) { where += ' AND r.customer_id = ?'; params.push(customerId); }
  if (q) {
    const like = `%${q}%`;
    where += ` AND (r.number LIKE ? OR r.subject LIKE ? OR r.notes LIKE ? OR c.name LIKE ? OR k.name LIKE ?
               OR EXISTS (SELECT 1 FROM crm_request_items x WHERE x.request_id = r.id AND x.description LIKE ?))`;
    params.push(like, like, like, like, like, like);
  }
  res.json(requestsFor(where, params));
});

router.get('/requests/:id', (req, res) => {
  const r = getRequest(req.params.id);
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.json(r);
});

router.post('/requests', (req, res) => {
  const b = req.body || {};
  const customer = b.customerId && get('SELECT id FROM customers WHERE id = ?', [b.customerId]);
  if (!customer) return res.status(400).json({ error: 'Escoge el cliente de la solicitud' });
  const items = cleanItems(b.items);
  if (!items.length && !String(b.subject || '').trim() && !String(b.notes || '').trim()) {
    return res.status(400).json({ error: 'Escoge al menos un producto o servicio, o escribe qué necesita el cliente' });
  }
  if (b.contactId && !get('SELECT id FROM contacts WHERE id = ? AND customer_id = ?', [b.contactId, customer.id])) {
    return res.status(400).json({ error: 'El contacto no pertenece a este cliente' });
  }
  const subject = String(b.subject || '').trim() || items.map((i) => i.description).slice(0, 3).join(', ').slice(0, 140) || 'Solicitud';
  const channel = CHANNEL_TO_ACTIVITY[b.channel] ? b.channel : 'llamada';
  const number = nextDocNumber('crm_requests', 'RQ');
  const id = run(`INSERT INTO crm_requests (number, customer_id, contact_id, channel, subject, notes, status, priority, vehicle_id, reply_to, assigned_user_id, created_by)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  [number, customer.id, b.contactId || null, channel, subject, b.notes || null, 'nueva', b.priority || 'normal',
    b.vehicleId || null, b.replyTo || null, b.assignedUserId || null, req.user ? req.user.id : null]).lastInsertRowid;
  saveItems(id, items);
  // La llamada / correo / texto queda en el historial de interacciones del cliente
  run(`INSERT INTO activities (customer_id, type, subject, notes, done, contact_id, request_id, direction, created_by, occurred_at)
       VALUES (?,?,?,?,1,?,?,'entrante',?,?)`,
  [customer.id, CHANNEL_TO_ACTIVITY[channel], `${number}: ${subject}`, b.notes || null, b.contactId || null, id, req.user ? req.user.id : null, nowIso()]);
  // Un cliente potencial que pide algo pasa de "lead" a "prospecto"
  run("UPDATE customers SET status = 'prospecto', updated_at = ? WHERE id = ? AND status = 'lead'", [nowIso(), customer.id]);
  // La solicitud solo guarda la información para cotizar: la orden de pedido (y su número) se
  // crea únicamente cuando alguien pulsa "Crear cotización" o "Facturar" en la solicitud.
  res.status(201).json(getRequest(id));
});

router.put('/requests/:id', (req, res) => {
  const b = req.body || {};
  const r = get('SELECT * FROM crm_requests WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const STATUSES = ['nueva', 'en_proceso', 'cotizada', 'ganada', 'perdida', 'cerrada'];
  const val = (k, col) => (b[k] !== undefined ? (b[k] === '' ? null : b[k]) : r[col]);
  run(`UPDATE crm_requests SET status=?, priority=?, subject=?, notes=?, contact_id=?, assigned_user_id=?, vehicle_id=?, channel=?, reply_to=?, updated_at=? WHERE id=?`,
    [STATUSES.includes(b.status) ? b.status : r.status, val('priority', 'priority') || 'normal', val('subject', 'subject'), val('notes', 'notes'),
      val('contactId', 'contact_id'), val('assignedUserId', 'assigned_user_id'), val('vehicleId', 'vehicle_id'),
      CHANNEL_TO_ACTIVITY[b.channel] ? b.channel : r.channel, val('replyTo', 'reply_to'), nowIso(), r.id]);
  if (Array.isArray(b.items)) saveItems(r.id, cleanItems(b.items));
  if (b.status && b.status !== r.status) {
    run(`INSERT INTO activities (customer_id, type, subject, done, request_id, created_by, occurred_at) VALUES (?, 'nota', ?, 1, ?, ?, ?)`,
      [r.customer_id, `${r.number}: estado → ${b.status}`, r.id, req.user ? req.user.id : null, nowIso()]);
    if (b.status === 'ganada') run("UPDATE customers SET status = 'cliente', updated_at = ? WHERE id = ? AND status IN ('lead','prospecto')", [nowIso(), r.customer_id]);
  }
  res.json(getRequest(r.id));
});

// Borrar una solicitud mal hecha: SOLO el administrador (Jorge). Se van con ella su historial de la
// llamada, sus ítems y archivos, y la cotización si sigue en borrador sin factura. Lo que ya tiene
// vida propia se conserva: cotización enviada o facturada, vehículo recibido y órdenes de trabajo
// (quedan sin enlace a la solicitud).
function deleteRequest(id) {
  const r = get('SELECT * FROM crm_requests WHERE id = ?', [id]);
  if (!r) return null;
  run('DELETE FROM activities WHERE request_id = ?', [id]);
  run('UPDATE work_orders SET request_id = NULL WHERE request_id = ?', [id]);
  let quoteDeleted = false;
  if (r.sales_order_id) {
    const so = get(`SELECT so.id, so.status, (SELECT COUNT(*) FROM invoices i WHERE i.sales_order_id = so.id) AS inv FROM sales_orders so WHERE so.id = ?`, [r.sales_order_id]);
    if (so && so.status === 'borrador' && !so.inv) {
      run('UPDATE crm_requests SET sales_order_id = NULL WHERE id = ?', [id]);
      run('DELETE FROM sales_order_items WHERE sales_order_id = ?', [so.id]);
      run('DELETE FROM sales_orders WHERE id = ?', [so.id]);
      quoteDeleted = true;
    }
  }
  run('UPDATE sales_orders SET request_id = NULL WHERE request_id = ?', [id]);
  run('DELETE FROM crm_requests WHERE id = ?', [id]);
  return { number: r.number, quoteDeleted };
}
const adminOnly = (req, res, next) => (req.user && req.user.role === 'admin' ? next()
  : res.status(403).json({ error: 'Solo el administrador puede borrar solicitudes. Pídeselo a Jorge.' }));

router.delete('/requests/:id', adminOnly, (req, res) => {
  const out = deleteRequest(Number(req.params.id));
  if (!out) return res.status(404).json({ error: 'Solicitud no encontrada' });
  res.status(204).end();
});

// Borrar varias a la vez (las marcadas en la lista). Solo el administrador.
router.post('/requests/bulk-delete', adminOnly, (req, res) => {
  const ids = (Array.isArray((req.body || {}).ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'No escogiste ninguna solicitud' });
  const deleted = ids.map(deleteRequest).filter(Boolean);
  res.json({ deleted: deleted.length });
});

// Crear / completar la orden de pedido (cotización) a partir de la solicitud
router.post('/requests/:id/quote', (req, res) => {
  const r = get('SELECT * FROM crm_requests WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada' });
  try {
    const soId = quoteFromRequest(r.id);
    res.json({ salesOrderId: soId, request: getRequest(r.id) });
  } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});

// Recibir el equipo / vehículo de la llamada y abrir la orden de servicio en un solo paso, con los
// datos que ya se tomaron en la llamada (sin volver a escribirlos en Recepción ni en Órdenes de
// trabajo). Si el VIN / serial ya existe, se usa ese vehículo. Si en la llamada no se tenía el
// nombre real del cliente, se puede escribir aquí: la solicitud pasa a ese cliente y el cliente
// provisional de la llamada se fusiona en él.
router.post('/requests/:id/service-order', (req, res) => {
  const b = req.body || {};
  const r = get('SELECT * FROM crm_requests WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const vin = String(b.vin || '').trim().toUpperCase();
  let vehicle = b.vehicleId ? get('SELECT * FROM vehicles WHERE id = ?', [b.vehicleId]) : (vin ? get('SELECT * FROM vehicles WHERE upper(vin) = ?', [vin]) : null);
  if (!vehicle && !vin) return res.status(400).json({ error: 'Escribe el VIN o el número de serie del equipo' });

  // Cliente real (si se escribió) o el de la llamada
  let customerId = r.customer_id;
  const name = String(b.customerName || '').trim();
  if (name) {
    const found = get('SELECT id FROM customers WHERE lower(trim(name)) = lower(?)', [name]);
    customerId = found ? found.id : run(`INSERT INTO customers (type, name, status, roles, source, phone) VALUES ('empresa', ?, 'cliente', 'cliente', 'Llamada / recepción', ?)`,
      [name, /\d{7,}/.test(String(r.reply_to || '').replace(/\D/g, '')) ? r.reply_to : null]).lastInsertRowid;
  }

  if (!vehicle) {
    const vid = run(`INSERT INTO vehicles (vin, make, model, year, plate, customer_id, status, notes) VALUES (?,?,?,?,?,?,?,?)`,
      [vin, b.make || null, b.model || null, b.year ? parseInt(b.year, 10) || null : null, b.plate || null, customerId, 'recibido',
        b.vehicleNotes || [r.subject, r.notes].filter(Boolean).join(' — ') || null]).lastInsertRowid;
    vehicle = get('SELECT * FROM vehicles WHERE id = ?', [vid]);
  } else if (!vehicle.customer_id || (name && vehicle.customer_id !== customerId)) {
    run('UPDATE vehicles SET customer_id = ? WHERE id = ?', [customerId, vehicle.id]);
  }

  // Equipo montado (compresor, grúa…) con su serial, si se indicó
  const eq = b.equipment || {};
  const typeName = String(eq.typeName || '').trim();
  if (typeName) {
    const t = get('SELECT id FROM equipment_types WHERE lower(name) = lower(?)', [typeName]);
    const typeId = t ? t.id : run('INSERT INTO equipment_types (name) VALUES (?)', [typeName]).lastInsertRowid;
    const serial = String(eq.serialNumber || '').trim() || null;
    const dup = serial && get('SELECT id FROM vehicle_equipment WHERE vehicle_id = ? AND lower(serial_number) = lower(?)', [vehicle.id, serial]);
    if (!dup) {
      run('INSERT INTO vehicle_equipment (vehicle_id, equipment_type_id, serial_number, manufacturer, model, notes) VALUES (?,?,?,?,?,?)',
        [vehicle.id, typeId, serial, eq.manufacturer || null, eq.model || null, null]);
    }
  }

  let link;
  try { link = linkRequestToVehicle(r.id, vehicle.id, req.user); } catch (e) { return res.status(e.status || 500).json({ error: e.message }); }

  let wo = null;
  if (b.createWorkOrder !== false) {
    wo = createWorkOrder(vehicle.id, {
      mechanicId: b.mechanicId || null, supplierId: b.supplierId || null, services: b.services, requestId: r.id,
      notes: b.notes || [r.subject, r.notes].filter(Boolean).join(' — ') || null, diagnosis: b.diagnosis || null,
    });
    const cid = get('SELECT customer_id FROM crm_requests WHERE id = ?', [r.id]).customer_id;
    run(`INSERT INTO activities (customer_id, type, subject, done, request_id, created_by, occurred_at) VALUES (?, 'nota', ?, 1, ?, ?, ?)`,
      [cid, `${r.number}: orden de servicio ${wo.number} (VIN / serial ${vehicle.vin})`, r.id, req.user ? req.user.id : null, nowIso()]);
  }
  res.status(201).json({ vehicleId: vehicle.id, workOrderId: wo && wo.id, workOrderNumber: wo && wo.number, link, request: getRequest(r.id) });
});

// Deja constancia de un mensaje enviado al cliente (acuse de recibo, cotización, seguimiento)
router.post('/requests/:id/messages', (req, res) => {
  const b = req.body || {};
  const r = get('SELECT * FROM crm_requests WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const kind = ['acuse', 'cotizacion', 'seguimiento'].includes(b.kind) ? b.kind : 'seguimiento';
  const type = ['email', 'texto', 'whatsapp', 'llamada'].includes(b.channel) ? b.channel : 'email';
  const label = { acuse: 'Acuse de recibo enviado', cotizacion: 'Cotización enviada', seguimiento: 'Seguimiento enviado' }[kind];
  run(`INSERT INTO activities (customer_id, type, subject, notes, done, contact_id, request_id, direction, created_by, occurred_at)
       VALUES (?,?,?,?,1,?,?,'saliente',?,?)`,
  [r.customer_id, type, `${r.number}: ${label}${b.to ? ` a ${b.to}` : ''}`, [b.subject, b.body].filter(Boolean).join('\n\n') || null,
    r.contact_id, r.id, req.user ? req.user.id : null, nowIso()]);
  if (kind === 'acuse') run('UPDATE crm_requests SET ack_sent_at = ?, updated_at = ? WHERE id = ?', [nowIso(), nowIso(), r.id]);
  if (kind === 'cotizacion') {
    run("UPDATE crm_requests SET quote_sent_at = ?, status = CASE WHEN status IN ('nueva','en_proceso') THEN 'cotizada' ELSE status END, updated_at = ? WHERE id = ?", [nowIso(), nowIso(), r.id]);
    if (r.sales_order_id) run("UPDATE sales_orders SET status = 'pendiente', updated_at = ? WHERE id = ? AND status = 'borrador'", [nowIso(), r.sales_order_id]);
  }
  res.json(getRequest(r.id));
});

// ---------- Adjuntos de la solicitud (documentos, requerimientos, fotos) ----------
router.post('/requests/:id/files', docUpload.array('files', 20), (req, res) => {
  const r = get('SELECT id, customer_id, number FROM crm_requests WHERE id = ?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'Solicitud no encontrada' });
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: 'No llegó ningún archivo' });
  for (const f of files) {
    run(`INSERT INTO crm_request_files (request_id, file_url, original_name, mime_type, size, created_by) VALUES (?,?,?,?,?,?)`,
      [r.id, `/uploads/crm-requests/${f.filename}`, f.originalname, f.mimetype, f.size, req.user ? req.user.id : null]);
  }
  run(`INSERT INTO activities (customer_id, type, subject, notes, done, request_id, created_by, occurred_at) VALUES (?, 'nota', ?, ?, 1, ?, ?, ?)`,
    [r.customer_id, `${r.number}: ${files.length === 1 ? 'archivo adjunto' : `${files.length} archivos adjuntos`}`, files.map((f) => f.originalname).join(', '), r.id, req.user ? req.user.id : null, nowIso()]);
  res.status(201).json(getRequest(r.id));
});

router.delete('/requests/:id/files/:fileId', (req, res) => {
  run('DELETE FROM crm_request_files WHERE id = ? AND request_id = ?', [req.params.fileId, req.params.id]);
  res.status(204).end();
});

// ---------- Agregar una opción nueva a la lista (para que quede la próxima vez) ----------
// kind: 'equipo' → tipo de equipo; 'servicio' → servicio del catálogo (precio en 0 hasta que se
// complete en Catálogo de Servicios); 'producto' → producto del inventario (costo/precio en 0,
// se completa en Catálogo de productos). Si ya existe con el mismo nombre, se reutiliza.
router.post('/catalog-item', (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Escribe el nombre' });
  if (b.kind === 'equipo') {
    const ex = get('SELECT id, name FROM equipment_types WHERE lower(name) = lower(?)', [name]);
    const id = ex ? ex.id : run('INSERT INTO equipment_types (name) VALUES (?)', [name]).lastInsertRowid;
    return res.status(ex ? 200 : 201).json({ kind: 'equipo', equipmentTypeId: id, description: ex ? ex.name : name, existed: !!ex });
  }
  if (b.kind === 'servicio') {
    const ex = get('SELECT id, name FROM services WHERE lower(name) = lower(?) OR lower(name_en) = lower(?)', [name, name]);
    const id = ex ? ex.id : run(`INSERT INTO services (name, pricing_type, hourly_rate, flat_price, active) VALUES (?, 'servicio_completo', 0, 0, 1)`, [name]).lastInsertRowid;
    return res.status(ex ? 200 : 201).json({ kind: 'servicio', serviceId: id, description: ex ? ex.name : name, existed: !!ex });
  }
  if (b.kind === 'producto') {
    const ex = get('SELECT id, name FROM products WHERE lower(name) = lower(?) AND active = 1', [name]);
    const typeId = b.productTypeId && get('SELECT id FROM product_types WHERE id = ?', [b.productTypeId]) ? Number(b.productTypeId) : null;
    const id = ex ? ex.id : run(`INSERT INTO products (name, description, product_type_id, purchase_cost, freight_cost, selling_price, stock_qty, active)
                                 VALUES (?, ?, ?, 0, 0, 0, 0, 1)`, [name, 'Creado desde el CRM — completar costo y precio', typeId]).lastInsertRowid;
    return res.status(ex ? 200 : 201).json({ kind: 'producto', productId: id, description: ex ? ex.name : name, existed: !!ex });
  }
  res.status(400).json({ error: 'Tipo no válido' });
});

// Asignar un vehículo (y sus equipos) a una persona concreta del cliente
router.put('/vehicles/:id/contact', (req, res) => {
  const v = get('SELECT id, customer_id FROM vehicles WHERE id = ?', [req.params.id]);
  if (!v) return res.status(404).json({ error: 'Vehículo no encontrado' });
  const cid = req.body && req.body.contactId ? Number(req.body.contactId) : null;
  if (cid && !get('SELECT id FROM contacts WHERE id = ? AND customer_id = ?', [cid, v.customer_id])) return res.status(400).json({ error: 'El contacto no pertenece al cliente del vehículo' });
  run('UPDATE vehicles SET contact_id = ? WHERE id = ?', [cid, v.id]);
  res.json({ ok: true });
});

module.exports = router;
module.exports.nameScore = nameScore;
