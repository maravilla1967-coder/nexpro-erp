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
