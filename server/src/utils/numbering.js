const { get } = require('../../db');

// Genera el siguiente número de documento tipo PREFIX-0001, buscando el mayor existente.
function nextNumber(table, prefix) {
  const row = get(
    `SELECT number FROM ${table} WHERE number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}-%`]
  );
  let next = 1;
  if (row && row.number) {
    const parts = row.number.split('-');
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

module.exports = { nextNumber };
