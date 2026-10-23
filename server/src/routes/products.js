const express = require('express');
const { db, all, get, run, nowIso } = require('../../db');
const { makeUploader } = require('../middleware/upload');
const { requireModuleEdit } = require('../middleware/auth');

const router = express.Router();
router.use(requireModuleEdit('inventario'));
const upload = makeUploader('products');

function calcSellingPrice(cost, freight, marginPercent) {
  const base = Number(cost || 0) + Number(freight || 0);
  const margin = Number(marginPercent);
  if (!margin || margin >= 100) return base;
  // Precio de venta = Costo / (1 - margen%)  ->  margen 30% => Costo/.70
  return Math.round((base / (1 - margin / 100)) * 100) / 100;
}

// ---- Product Types (lista de tipos de producto, para agrupar) ----
router.get('/types', (req, res) => {
  res.json(all('SELECT * FROM product_types ORDER BY name'));
});

router.post('/types', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre del tipo es obligatorio' });
  const existing = get('SELECT * FROM product_types WHERE name = ?', [name]);
  if (existing) return res.status(200).json(existing);
  const result = run('INSERT INTO product_types (name) VALUES (?)', [name]);
  res.status(201).json(get('SELECT * FROM product_types WHERE id = ?', [result.lastInsertRowid]));
});

router.delete('/types/:id', (req, res) => {
  run('DELETE FROM product_types WHERE id = ?', [req.params.id]);
  res.status(204).end();
});


// ---- Datos del fabricante (carrocerías / equipos) ----
// Item # del fabricante, CA del chasis (pulgadas), GVWR (lb), peso de la carrocería (lb),
// costo de instalación y "configuración en stock" del fabricante.
function num(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).replace(/[$,"″\s]/g, '');
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function bool01(v) {
  if (v === undefined || v === null || v === '') return undefined;
  return ['1', 'true', 'yes', 'si', 'sí', 'x', '✓', '✔'].includes(String(v).trim().toLowerCase()) || v === true || v === 1 ? 1 : 0;
}
function setVendorFields(id, b) {
  const map = {
    vendor_item_number: b.vendorItemNumber !== undefined ? (String(b.vendorItemNumber).trim() || null) : undefined,
    chassis_ca: num(b.chassisCa),
    gvwr: num(b.gvwr),
    body_weight: num(b.bodyWeight),
    installation_cost: b.installationCost !== undefined ? (num(b.installationCost) || 0) : undefined,
    vendor_stocked: bool01(b.vendorStocked),
  };
  const cols = Object.entries(map).filter(([, v]) => v !== undefined);
  if (!cols.length) return;
  run(`UPDATE products SET ${cols.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`, [...cols.map(([, v]) => v), id]);
}

// ---- Importar lista de precios (CSV/JSON ya convertido a filas en el navegador) ----
// POST /api/products/import  { rows: [...], supplierName, productTypeName, marginPercent, dryRun }
// Cada fila: sku, name, vendorItemNumber, description, chassisCa, gvwr, bodyWeight, purchaseCost,
// installationCost, vendorStocked, trackSerials. Se empata por SKU: si existe se actualiza, si no se crea.
// Con dryRun = true no escribe nada: solo devuelve qué haría con cada fila (para revisar antes).
router.post('/import', (req, res) => {
  const { rows, supplierName, productTypeName, dryRun } = req.body || {};
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'No hay filas para importar' });
  const margin = req.body.marginPercent !== undefined && req.body.marginPercent !== '' ? parseFloat(req.body.marginPercent) : 30;

  const supplier = supplierName ? get('SELECT id, name FROM suppliers WHERE lower(name) = lower(?)', [supplierName.trim()])
    || get('SELECT id, name FROM suppliers WHERE name LIKE ? ORDER BY id LIMIT 1', [`%${supplierName.trim()}%`]) : null;
  const ptype = productTypeName ? get('SELECT id, name FROM product_types WHERE lower(name) = lower(?)', [productTypeName.trim()]) : null;

  const seen = new Set();
  const results = rows.map((r, i) => {
    const sku = String(r.sku || '').trim();
    const name = String(r.name || '').trim();
    const cost = num(r.purchaseCost);
    const errors = [];
    if (!sku) errors.push('Falta SKU');
    if (!name) errors.push('Falta nombre');
    if (cost === null || cost === undefined) errors.push('Costo inválido');
    if (sku && seen.has(sku)) errors.push('SKU repetido en el archivo');
    seen.add(sku);
    const existing = sku ? get('SELECT id, name, purchase_cost FROM products WHERE sku = ?', [sku]) : null;
    return {
      row: i + 1, sku, name, vendorItemNumber: r.vendorItemNumber || '', description: r.description || '',
      chassisCa: num(r.chassisCa), gvwr: num(r.gvwr), bodyWeight: num(r.bodyWeight), purchaseCost: cost,
      installationCost: num(r.installationCost) || 0, vendorStocked: bool01(r.vendorStocked) || 0,
      trackSerials: bool01(r.trackSerials) ?? 1,
      sellingPrice: cost != null ? calcSellingPrice(cost, 0, margin) : null,
      action: errors.length ? 'error' : existing ? 'actualizar' : 'crear',
      previousCost: existing ? existing.purchase_cost : null,
      errors,
    };
  });

  const summary = {
    crear: results.filter((r) => r.action === 'crear').length,
    actualizar: results.filter((r) => r.action === 'actualizar').length,
    error: results.filter((r) => r.action === 'error').length,
    supplier: supplier ? supplier.name : (supplierName ? `${supplierName} (se creará)` : null),
    productType: ptype ? ptype.name : (productTypeName ? `${productTypeName} (se creará)` : null),
    marginPercent: margin,
  };
  if (dryRun || summary.error > 0) return res.json({ dryRun: true, summary, results });

  let supplierId = supplier ? supplier.id : null;
  if (!supplierId && supplierName) supplierId = run('INSERT INTO suppliers (name) VALUES (?)', [supplierName.trim()]).lastInsertRowid;
  let typeId = ptype ? ptype.id : null;
  if (!typeId && productTypeName) typeId = run('INSERT INTO product_types (name) VALUES (?)', [productTypeName.trim()]).lastInsertRowid;

  db.exec('BEGIN');
  try {
    for (const r of results) {
      const existing = get('SELECT id FROM products WHERE sku = ?', [r.sku]);
      let id;
      if (existing) {
        id = existing.id;
        run(`UPDATE products SET name=?, description=?, purchase_cost=?, margin_percent=?, selling_price=?,
               product_type_id=COALESCE(?, product_type_id), supplier_id=COALESCE(?, supplier_id), updated_at=? WHERE id=?`,
          [r.name, r.description || null, r.purchaseCost, margin, r.sellingPrice, typeId, supplierId, nowIso(), id]);
      } else {
        id = run(`INSERT INTO products (sku, name, description, product_type_id, purchase_cost, freight_cost, margin_percent, selling_price, stock_qty, unit, supplier_id, active)
                  VALUES (?,?,?,?,?,0,?,?,0,'unidad',?,1)`,
          [r.sku, r.name, r.description || null, typeId, r.purchaseCost, margin, r.sellingPrice, supplierId]).lastInsertRowid;
      }
      run('UPDATE products SET track_serials = ? WHERE id = ?', [r.trackSerials ? 1 : 0, id]);
      setVendorFields(id, r);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: `No se importó nada: ${e.message}` });
  }
  res.json({ dryRun: false, summary, results });
});

// ---- Products ----
// "Maneja seriales" llega desde un formulario multipart: 'true'/'false' como texto.
function setTrackSerials(id, v) {
  if (v === undefined || v === null || v === '') return;
  const on = v === true || v === 'true' || v === '1' || v === 1;
  run('UPDATE products SET track_serials = ? WHERE id = ?', [on ? 1 : 0, id]);
}

// Números de serie escritos al crear/editar el producto (uno por línea, o separados por coma):
// se dan de alta como unidades disponibles. El stock nunca queda por debajo de las unidades
// con serial disponibles.
function parseSerials(v) {
  return [...new Set(String(v || '').split(/[\n,;\t]+/).map((s) => s.trim()).filter(Boolean))];
}
function addProductSerials(productId, serials, userId) {
  if (!serials.length) return;
  const p = get('SELECT * FROM products WHERE id = ?', [productId]);
  const date = new Date().toISOString().slice(0, 10);
  run('UPDATE products SET track_serials = 1 WHERE id = ?', [productId]);
  for (const sn of serials) {
    const id = run(`INSERT INTO product_serials (product_id, serial, status, supplier_id, received_date, unit_cost, status_date, notes)
                    VALUES (?,?,?,?,?,?,?,?)`, [productId, sn, 'disponible', p.supplier_id || null, date, p.purchase_cost, date, 'Alta desde la ficha del producto']).lastInsertRowid;
    run('INSERT INTO serial_events (serial_id, event, notes, created_by) VALUES (?,?,?,?)', [id, 'alta_manual', 'Ficha del producto', userId || null]);
  }
  const avail = get(`SELECT COUNT(*) n FROM product_serials WHERE product_id = ? AND status = 'disponible'`, [productId]).n;
  run('UPDATE products SET stock_qty = MAX(stock_qty, ?) WHERE id = ?', [avail, productId]);
}
function duplicateSerial(productId, serials) {
  if (!productId) return null;
  for (const sn of serials) if (get('SELECT id FROM product_serials WHERE product_id = ? AND serial = ?', [productId, sn])) return sn;
  return null;
}

router.get('/', (req, res) => {
  const { q, typeId, active } = req.query;
  let sql = `SELECT p.*, pt.name as product_type_name, s.name as supplier_name,
                    (SELECT COUNT(*) FROM product_serials ps WHERE ps.product_id = p.id AND ps.status = 'disponible') AS serials_available
             FROM products p
             LEFT JOIN product_types pt ON pt.id = p.product_type_id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ? OR p.vendor_item_number LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (typeId) {
    sql += ' AND p.product_type_id = ?';
    params.push(typeId);
  }
  if (active !== undefined) {
    sql += ' AND p.active = ?';
    params.push(active === 'true' ? 1 : 0);
  }
  sql += ' ORDER BY p.name';
  res.json(all(sql, params));
});

router.get('/:id', (req, res) => {
  const product = get(
    `SELECT p.*, pt.name as product_type_name, s.name as supplier_name
     FROM products p
     LEFT JOIN product_types pt ON pt.id = p.product_type_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.id = ?`,
    [req.params.id]
  );
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

router.post('/', upload.single('photo'), (req, res) => {
  const b = req.body;
  if (!b.name) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const purchaseCost = parseFloat(b.purchaseCost || 0);
  const freightCost = parseFloat(b.freightCost || 0);
  const marginPercent = b.marginPercent !== undefined && b.marginPercent !== '' ? parseFloat(b.marginPercent) : 30;
  const sellingPrice = b.sellingPrice !== undefined && b.sellingPrice !== ''
    ? parseFloat(b.sellingPrice)
    : calcSellingPrice(purchaseCost, freightCost, marginPercent);
  const photoUrl = req.file ? `/uploads/products/${req.file.filename}` : (b.photoUrl || null);

  const result = run(
    `INSERT INTO products (sku, name, description, photo_url, product_type_id, purchase_cost, freight_cost, margin_percent, selling_price, stock_qty, unit, supplier_id, active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [b.sku || null, b.name, b.description || null, photoUrl, b.productTypeId || null, purchaseCost, freightCost,
     marginPercent, sellingPrice, parseFloat(b.stockQty || 0), b.unit || 'unidad', b.supplierId || null,
     b.active !== undefined ? (b.active === 'false' ? 0 : 1) : 1]
  );
  setTrackSerials(result.lastInsertRowid, b.trackSerials);
  setVendorFields(result.lastInsertRowid, b);
  addProductSerials(result.lastInsertRowid, parseSerials(b.serials), req.user && req.user.id);
  res.status(201).json(get('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', upload.single('photo'), (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  const newSerials = parseSerials(b.serials);
  const dup = duplicateSerial(existing.id, newSerials);
  if (dup) return res.status(400).json({ error: `El serial ${dup} ya está registrado para este producto.` });

  const purchaseCost = b.purchaseCost !== undefined ? parseFloat(b.purchaseCost) : existing.purchase_cost;
  const freightCost = b.freightCost !== undefined ? parseFloat(b.freightCost) : existing.freight_cost;
  const marginPercent = b.marginPercent !== undefined && b.marginPercent !== '' ? parseFloat(b.marginPercent) : existing.margin_percent;
  const sellingPrice = b.sellingPrice !== undefined && b.sellingPrice !== ''
    ? parseFloat(b.sellingPrice)
    : calcSellingPrice(purchaseCost, freightCost, marginPercent);
  const photoUrl = req.file ? `/uploads/products/${req.file.filename}` : (b.photoUrl ?? existing.photo_url);

  run(
    `UPDATE products SET sku=?, name=?, description=?, photo_url=?, product_type_id=?, purchase_cost=?, freight_cost=?,
       margin_percent=?, selling_price=?, stock_qty=?, unit=?, supplier_id=?, active=?, updated_at=?
     WHERE id=?`,
    [b.sku ?? existing.sku, b.name ?? existing.name, b.description ?? existing.description, photoUrl,
     b.productTypeId ?? existing.product_type_id, purchaseCost, freightCost, marginPercent, sellingPrice,
     b.stockQty !== undefined ? parseFloat(b.stockQty) : existing.stock_qty, b.unit ?? existing.unit,
     b.supplierId ?? existing.supplier_id, b.active !== undefined ? (b.active === 'false' || b.active === false ? 0 : 1) : existing.active,
     nowIso(), req.params.id]
  );
  setTrackSerials(req.params.id, b.trackSerials);
  setVendorFields(req.params.id, b);
  addProductSerials(existing.id, newSerials, req.user && req.user.id);
  res.json(get('SELECT * FROM products WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
