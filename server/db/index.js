const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_FILE || path.join(__dirname, 'nexpro.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migraciones idempotentes para bases de datos ya existentes (CREATE TABLE IF NOT EXISTS
// no agrega columnas nuevas a una tabla que ya existe con datos).
function tryAlter(sql) {
  try {
    db.exec(sql);
  } catch (e) {
    // La columna ya existe; no hacer nada.
  }
}
tryAlter('ALTER TABLE work_orders ADD COLUMN diagnosis TEXT');
tryAlter('ALTER TABLE work_orders ADD COLUMN resolution TEXT');
tryAlter('ALTER TABLE services ADD COLUMN name_en TEXT');
tryAlter('ALTER TABLE services ADD COLUMN description_en TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN code TEXT');
tryAlter('ALTER TABLE work_order_parts ADD COLUMN notes TEXT');
tryAlter('ALTER TABLE customers ADD COLUMN zip TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN city TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN zip TEXT');
tryAlter('ALTER TABLE work_orders ADD COLUMN invoice_id INTEGER REFERENCES invoices(id)');
tryAlter('ALTER TABLE invoices ADD COLUMN include_wire_info INTEGER NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE purchase_orders ADD COLUMN order_date TEXT');
tryAlter('ALTER TABLE purchase_order_items ADD COLUMN received_qty REAL NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE products ADD COLUMN track_serials INTEGER NOT NULL DEFAULT 0');
// Datos del fabricante para carrocerías / equipos (listas de precios Reading, etc.):
// Item # del fabricante, CA del chasis (pulgadas), GVWR del chasis (lb), peso de la carrocería (lb),
// costo de instalación y si es configuración en stock del fabricante (✓ en la lista).
tryAlter('ALTER TABLE products ADD COLUMN vendor_item_number TEXT');
tryAlter('ALTER TABLE products ADD COLUMN chassis_ca REAL');
tryAlter('ALTER TABLE products ADD COLUMN gvwr REAL');
tryAlter('ALTER TABLE products ADD COLUMN body_weight REAL');
tryAlter('ALTER TABLE products ADD COLUMN installation_cost REAL NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE products ADD COLUMN vendor_stocked INTEGER NOT NULL DEFAULT 0');
// Recargo cobrado al cliente aparte del abono (p. ej. 3% por pagar con tarjeta en Square).
// No reduce el saldo de la factura: el total cobrado = amount + surcharge.
tryAlter('ALTER TABLE invoice_payments ADD COLUMN surcharge REAL NOT NULL DEFAULT 0');
// Comisión que cobra el procesador (Square: 3.5% + $0.15). Neto recibido = amount + surcharge - processor_fee.
tryAlter('ALTER TABLE invoice_payments ADD COLUMN processor_fee REAL NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE warranties ADD COLUMN product_serial_id INTEGER REFERENCES product_serials(id)');
// Cadena de compras enlazada: condiciones de pago del proveedor, cuenta por pagar creada desde
// la recepción, y faltantes cerrados (lo que ya no va a llegar de una línea).
tryAlter('ALTER TABLE suppliers ADD COLUMN payment_terms_days INTEGER');
tryAlter('ALTER TABLE supplier_bills ADD COLUMN goods_receipt_id INTEGER REFERENCES goods_receipts(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE purchase_order_items ADD COLUMN short_qty REAL NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE purchase_orders ADD COLUMN short_note TEXT');
tryAlter('ALTER TABLE purchase_orders ADD COLUMN payment_terms_days INTEGER'); // vacío = las del proveedor
// Finanzas: cada cobro / pago puede quedar en una cuenta bancaria (y conciliado).
tryAlter('ALTER TABLE invoice_payments ADD COLUMN bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE invoice_payments ADD COLUMN bank_cleared INTEGER NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE supplier_bill_payments ADD COLUMN bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE supplier_bill_payments ADD COLUMN bank_cleared INTEGER NOT NULL DEFAULT 0');
// Préstamos: base de días para el interés (365 = actual/365, 360 = comercial).
tryAlter('ALTER TABLE loans ADD COLUMN day_basis INTEGER NOT NULL DEFAULT 365');

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: Number(result.changes) };
}

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { db, all, get, run, nowIso };

// Migración única: los equipos instalados con un tipo "nuevo" escrito a mano pasan a usar la
// lista maestra de tipos (se crea el tipo si no existía).
try {
  const flag = get("SELECT value FROM app_settings WHERE key = 'equipment_types_master_v1'");
  if (!flag) {
    const rows = all("SELECT id, custom_type_name FROM vehicle_equipment WHERE equipment_type_id IS NULL AND custom_type_name IS NOT NULL AND trim(custom_type_name) != ''");
    for (const r of rows) {
      const name = r.custom_type_name.trim();
      let t = get('SELECT id FROM equipment_types WHERE lower(name) = lower(?)', [name]);
      const tid = t ? t.id : run('INSERT INTO equipment_types (name) VALUES (?)', [name]).lastInsertRowid;
      run('UPDATE vehicle_equipment SET equipment_type_id = ?, custom_type_name = NULL WHERE id = ?', [tid, r.id]);
    }
    run("INSERT INTO app_settings (key, value) VALUES ('equipment_types_master_v1', ?)", [String(rows.length)]);
  }
} catch (e) { console.error('Migración de tipos de equipo:', e.message); }
