const { all, get } = require('../../db');

// Genera el siguiente número de documento tipo PREFIX-0001, buscando el mayor existente.
// (Se mantiene por compatibilidad; los documentos nuevos usan el esquema
// NX-<TIPO>-AAAAMMDD-NN, ej. NX-WO-20261009-01.)
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
// independiente por tabla), o NX-<TIPO>-AAAAMMDD-NN si se indica un código de tipo de
// documento (por ejemplo WO, QT, INV), para identificar el tipo de documento a simple
// vista en el número mismo. El consecutivo es independiente por tabla y por tipo, así que
// los documentos con el esquema anterior (sin código de tipo) no interfieren con el conteo
// de los nuevos.
function nextDocNumber(table, typeCode) {
  const stamp = todayStamp();
  const prefix = typeCode ? `NX-${typeCode}-${stamp}-` : `NX-${stamp}-`;
  const re = typeCode ? new RegExp(`^NX-${typeCode}-\\d{8}-(\\d{2})`) : /^NX-\d{8}-(\d{2})/;
  const rows = all(`SELECT number FROM ${table} WHERE number LIKE ?`, [`${prefix}%`]);
  let maxSeq = 0;
  for (const r of rows) {
    const m = String(r.number).match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  const seq = String(maxSeq + 1).padStart(2, '0');
  return `${prefix}${seq}`;
}

// A partir de un número base (NX-AAAAMMDD-NN) genera el número con sufijo de etapa:
// -1 para pedido/cotización, -2 para factura. Esquema anterior, mantenido por
// compatibilidad con documentos ya creados; los documentos nuevos usan nextDocNumber()
// con código de tipo y asInvoiceNumber() para la relación pedido → factura.
function withStageSuffix(baseNumber, stage) {
  const clean = String(baseNumber).replace(/-[12]$/, '');
  return `${clean}-${stage}`;
}

// Quita el sufijo de etapa (-1/-2) de un número, dejando el número base del día.
function stripStageSuffix(numberWithStage) {
  return String(numberWithStage).replace(/-[12]$/, '');
}

// A partir del número de un pedido/cotización genera el número de la factura
// correspondiente, manteniendo la fecha y el consecutivo para que quede clara la
// relación entre ambos documentos:
//   - Esquema nuevo: NX-QT-AAAAMMDD-NN  →  NX-INV-AAAAMMDD-NN
//   - Esquema anterior (pedidos creados antes de este cambio, sin código de tipo):
//     NX-AAAAMMDD-NN(-1)?  →  se mantiene el comportamiento anterior (sufijo -2).
function asInvoiceNumber(quoteNumber) {
  const s = String(quoteNumber);
  if (/^NX-QT-\d{8}-\d{2}$/.test(s)) return s.replace(/^NX-QT-/, 'NX-INV-');
  return withStageSuffix(s, 2);
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

module.exports = { nextNumber, nextDocNumber, withStageSuffix, stripStageSuffix, asInvoiceNumber, nextPoNumber, todayStamp };
