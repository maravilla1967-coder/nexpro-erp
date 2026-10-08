const express = require('express');
const { all, get, run, nowIso } = require('../../db');
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

// ---- Products ----
router.get('/', (req, res) => {
  const { q, typeId, active } = req.query;
  let sql = `SELECT p.*, pt.name as product_type_name, s.name as supplier_name
             FROM products p
             LEFT JOIN product_types pt ON pt.id = p.product_type_id
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE 1=1`;
  const params = [];
  if (q) {
    sql += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
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
  res.status(201).json(get('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]));
});

router.put('/:id', upload.single('photo'), (req, res) => {
  const b = req.body;
  const existing = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

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
  res.json(get('SELECT * FROM products WHERE id = ?', [req.params.id]));
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
