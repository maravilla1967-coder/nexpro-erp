const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_FILE || path.join(__dirname, 'nexpro.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

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
