// Importación única del catálogo que Nexpro tenía en MaxxSuite (exportado el 2026-10-16):
// productos con su código (SKU), categoría (→ tipo de producto), unidad y costo, y los
// clientes reales (se dejaron fuera los registros de prueba de MaxxSuite: BOT TEST, Acme
// Test, "AAA BBB", "Cliente sin nombre" y duplicados como "PENSKEE").
// No duplica nada: salta los productos cuyo SKU o nombre ya existe y los clientes cuyo
// nombre ya existe. Protegido por la bandera 'maxxsuite_import_v1'.
const fs = require('fs');
const path = require('path');
const { db, get, run } = require('./index');

function priceFor(cost, margin = 30) {
  return Math.round((Number(cost || 0) / (1 - margin / 100)) * 100) / 100;
}

function importMaxxsuite() {
  if (get("SELECT value FROM app_settings WHERE key = 'maxxsuite_import_v1'")) return;
  const file = path.join(__dirname, 'maxxsuite-import.json');
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const report = { products_created: 0, products_skipped: 0, types_created: 0, customers_created: 0, customers_skipped: 0 };

  db.exec('BEGIN');
  try {
    const typeIds = new Map();
    for (const p of data.products) {
      const exists = (p.sku && get('SELECT id FROM products WHERE sku = ?', [p.sku])) ||
        get('SELECT id FROM products WHERE lower(name) = lower(?)', [p.name]);
      if (exists) { report.products_skipped++; continue; }
      let typeId = typeIds.get(p.category);
      if (!typeId) {
        const t = get('SELECT id FROM product_types WHERE lower(name) = lower(?)', [p.category]);
        typeId = t ? t.id : run('INSERT INTO product_types (name) VALUES (?)', [p.category]).lastInsertRowid;
        if (!t) report.types_created++;
        typeIds.set(p.category, typeId);
      }
      run(`INSERT INTO products (sku, name, product_type_id, purchase_cost, freight_cost, margin_percent, selling_price, stock_qty, unit, active)
           VALUES (?,?,?,?,0,30,?,0,?,1)`,
        [p.sku, p.name, typeId, p.cost, priceFor(p.cost), p.unit]);
      report.products_created++;
    }
    for (const c of data.customers) {
      if (get('SELECT id FROM customers WHERE lower(name) = lower(?)', [c.name])) { report.customers_skipped++; continue; }
      run(`INSERT INTO customers (type, name, tax_id, city, industry, status, source, notes) VALUES (?,?,?,?,?,?,?,?)`,
        [c.type || 'empresa', c.name, c.tax_id || null, c.city || null, c.industry || null, 'cliente', 'MaxxSuite', 'Importado de MaxxSuite']);
      report.customers_created++;
    }
    run("INSERT INTO app_settings (key, value) VALUES ('maxxsuite_import_v1', ?)", [JSON.stringify(report)]);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  console.log('Importación de MaxxSuite:', JSON.stringify(report));
}

module.exports = { importMaxxsuite };
