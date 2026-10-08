const { all, get } = require('../../db');

// Genera el siguiente número de documento tipo PREFIX-0001, buscando el mayor existente.
// (Se mantiene por compatibilidad; los documentos nuevos usan el esquema NX-AAAAMMDD-NN.)
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

// AAAAMMDD de la fecha local del servidor.
function todayStamp() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// Genera el número base del día para un módulo: NX-AAAAMMDD-NN (NN = consecutivo del día,
// independiente por tabla). Sirve tanto para documentos sin sufijo (recepción de
// vehículo/orden de trabajo) como como base para pedidos (cotización) y facturas, a los
// que luego se les agrega el sufijo de etapa con withStageSuffix().
function nextDocNumber(table) {
  const stamp = todayStamp();
  const rows = all(`SELECT number FROM ${table} WHERE number LIKE ?`, [`NX-${stamp}-%`]);
  let maxSeq = 0;
  for (const r of rows) {
    const m = String(r.number).match(/^NX-\d{8}-(\d{2})/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  const seq = String(maxSeq + 1).padStart(2, '0');
  return `NX-${stamp}-${seq}`;
}

// A partir de un número base (NX-AAAAMMDD-NN) genera el número con sufijo de etapa:
// -1 para pedido/cotización, -2 para factura. Si el número ya traía un sufijo de etapa
// (por ejemplo al re-facturar desde un pedido), se reemplaza por el nuevo.
function withStageSuffix(baseNumber, stage) {
  const clean = String(baseNumber).replace(/-[12]$/, '');
  return `${clean}-${stage}`;
}

// Quita el sufijo de etapa (-1/-2) de un número, dejando el número base del día.
function stripStageSuffix(numberWithStage) {
  return String(numberWithStage).replace(/-[12]$/, '');
}

// Órdenes de compra: NX-<2 letras del proveedor>-<consecutivo de 3 dígitos>, consecutivo
// propio por proveedor.
function nextPoNumber(vendorCode) {
  const code = String(vendorCode || 'XX').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2).padEnd(2, 'X');
  const row = get(
    `SELECT number FROM purchase_orders WHERE number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`NX-${code}-%`]
  );
  let next = 1;
  if (row && row.number) {
    const parts = row.number.split('-');
    const n = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return `NX-${code}-${String(next).padStart(3, '0')}`;
}

module.exports = { nextNumber, nextDocNumber, withStageSuffix, stripStageSuffix, nextPoNumber, todayStamp };
