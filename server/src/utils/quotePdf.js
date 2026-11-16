// Lee una cotización en PDF hecha con la plantilla de Nexpro (Claude Design / Canva) y saca lo
// necesario para crear la cotización del ERP: número, referencia, equipo ofertado, cliente, líneas
// (ítem, cantidad, descripción, precio) y total. Funciona en inglés y en español.
//
// La plantilla trae una tabla "INVESTMENT SUMMARY" / "RESUMEN DE INVERSIÓN" con las columnas
// ITEM | QTY | DESCRIPTION | PRICE (USD) y termina en "TOTAL QUOTED PRICE" / "PRECIO TOTAL COTIZADO".
// Se usan las posiciones del texto en la página para separar las columnas.

let pdfjsPromise = null;
function pdfjs() {
  if (!pdfjsPromise) pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsPromise;
}

const MONEY = /(?:US\$|USD|\$)\s*([\d.,]+\d)/;
const toNumber = (s) => {
  let v = String(s || '').trim();
  // 25,000.00 (EE. UU.) o 25.000,00 (latino)
  if (/,\d{2}$/.test(v) && v.includes('.')) v = v.replace(/\./g, '').replace(',', '.');
  else v = v.replace(/,/g, '');
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Texto de cada página agrupado en renglones (por posición vertical) con la x de cada pedazo.
async function readLines(buffer) {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false, disableFontFace: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items = tc.items.filter((i) => i.str && i.str.trim()).map((i) => ({ x: i.transform[4], y: i.transform[5], str: i.str }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const it of items) {
      const line = lines.find((l) => Math.abs(l.y - it.y) <= 2.5);
      if (line) line.parts.push(it); else lines.push({ y: it.y, parts: [it] });
    }
    for (const l of lines) {
      l.parts.sort((a, b) => a.x - b.x);
      l.text = clean(l.parts.map((x) => x.str).join(' '));
    }
    lines.sort((a, b) => b.y - a.y);
    pages.push(lines);
  }
  await doc.destroy();
  return pages;
}

async function parseQuotePdf(buffer) {
  const pages = await readLines(buffer);
  const all = pages.flat();
  const warnings = [];
  const find = (re) => all.find((l) => re.test(norm(l.text)));
  const after = (line, labelRe) => {
    if (!line) return null;
    const parts = line.parts.filter((p) => !labelRe.test(norm(p.str)));
    return clean(parts.map((p) => p.str).join(' ')) || null;
  };

  const quoteLine = find(/^(QUOTE NO|COTIZACION NO|QUOTATION NO)/) || find(/(QUOTE NO|COTIZACION NO)\./);
  const quoteNumber = quoteLine ? (quoteLine.text.match(/NX-[\w-]+/) || [after(quoteLine, /(QUOTE|COTIZACION|NO\.?)/)])[0] : null;
  const refLine = find(/^(REFERENCE|REFERENCIA)\b/);
  const reference = refLine ? after(refLine, /^(REFERENCE|REFERENCIA)$/) : null;
  const language = all.some((l) => /RESUMEN DE INVERSION|COTIZACION NO/.test(norm(l.text))) ? 'es' : 'en';

  // Equipo ofertado: el renglón que sigue al título
  let equipment = null;
  const eqIdx = all.findIndex((l) => /^(EQUIPMENT OFFERED|EQUIPO OFERTADO)$/.test(norm(l.text)));
  if (eqIdx >= 0 && all[eqIdx + 1]) equipment = all[eqIdx + 1].text;

  // Cliente: primer renglón bajo "PREPARED FOR / PREPARADA PARA" (columna izquierda)
  let customerName = null; let attention = null;
  const pfIdx = all.findIndex((l) => /(PREPARED FOR|PREPARADA PARA)/.test(norm(l.text)));
  if (pfIdx >= 0) {
    const pf = all[pfIdx].parts.find((p) => /(PREPARED FOR|PREPARADA PARA)/.test(norm(p.str)));
    const leftCol = (l) => clean(l.parts.filter((p) => !pf || p.x < pf.x + 200).map((p) => p.str).join(' '));
    customerName = all[pfIdx + 1] ? leftCol(all[pfIdx + 1]) : null;
    const second = all[pfIdx + 2] ? leftCol(all[pfIdx + 2]) : '';
    if (second && !/\d{3,}/.test(second)) attention = second.replace(/^(Attn:|Atención:|At\.?:)\s*/i, '');
  }

  // Tabla de líneas
  const items = [];
  let total = null;
  for (const lines of pages) {
    const startIdx = lines.findIndex((l) => /(INVESTMENT SUMMARY|RESUMEN DE INVERSION)/.test(norm(l.text)));
    if (startIdx < 0) continue;
    const headerIdx = lines.findIndex((l, i) => i > startIdx && /(DESCRIPTION|DESCRIPCION)/.test(norm(l.text)));
    const header = lines[headerIdx];
    const col = (re) => { const p = header && header.parts.find((x) => re.test(norm(x.str))); return p ? p.x : null; };
    const xDesc = col(/^(DESCRIPTION|DESCRIPCION)/) ?? 130;
    const xPrice = col(/^(PRICE|PRECIO)/) ?? 480;
    const xQty = col(/^(QTY|CANT)/) ?? 80;
    const endIdx = lines.findIndex((l, i) => i > headerIdx && /(TOTAL QUOTED PRICE|PRECIO TOTAL|^TOTAL\b)/.test(norm(l.text)));
    const body = lines.slice(headerIdx + 1, endIdx < 0 ? undefined : endIdx);
    if (endIdx >= 0) { const m = lines[endIdx].text.match(MONEY); if (m) total = toNumber(m[1]); }

    // Renglones con precio = una línea de la cotización; la descripción son los pedazos en la columna
    // de descripción desde el renglón anterior con precio hasta el siguiente.
    const anchors = body.map((l, i) => ({ l, i })).filter(({ l }) => MONEY.test(l.text) && l.parts.some((p) => p.x >= xPrice - 60 && MONEY.test(p.str + (p.str.match(/\$$/) ? ' 0' : ''))) || (MONEY.test(l.text) && /^\s*\d{1,3}\b/.test(l.text)));
    const descOf = (l) => clean(l.parts.filter((p) => p.x >= xDesc - 8 && p.x < xPrice - 20).map((p) => p.str).join(' '));
    // Cada renglón de descripción se asigna al renglón con precio más cercano (arriba o abajo):
    // en la plantilla el nombre va justo encima del precio y el detalle justo debajo.
    const groups = anchors.map(() => []);
    body.forEach((bl, bi) => {
      const d = descOf(bl);
      if (!d || d === '—' || d === '-' || !anchors.length) return;
      let best = 0;
      anchors.forEach((a, k) => { if (Math.abs(a.l.y - bl.y) < Math.abs(anchors[best].l.y - bl.y)) best = k; });
      groups[best].push({ y: bl.y, d });
    });
    anchors.forEach(({ l }, k) => {
      const descLines = groups[k].sort((a, b) => b.y - a.y).map((g) => g.d);
      const left = l.parts.filter((p) => p.x < xDesc - 8).map((p) => p.str.trim()).filter(Boolean);
      const nums = left.join(' ').match(/\d+(?:\.\d+)?/g) || [];
      const qtyPart = l.parts.find((p) => Math.abs(p.x - xQty) < 40 && /^\d+(\.\d+)?$/.test(p.str.trim()));
      const qty = qtyPart ? Number(qtyPart.str) : (nums.length >= 2 ? Number(nums[1]) : 1);
      const m = l.text.match(new RegExp(MONEY.source, 'g'));
      const lineTotal = m ? toNumber(m[m.length - 1].match(MONEY)[1]) : null;
      const [title, ...rest] = descLines;
      items.push({
        item: nums[0] || String(items.length + 1).padStart(2, '0'),
        quantity: qty > 0 ? qty : 1,
        description: title || '',
        details: rest.join(' · '),
        lineTotal,
        unitPrice: lineTotal != null && qty > 0 ? Math.round((lineTotal / qty) * 100) / 100 : null,
      });
    });
    break;
  }

  for (const it of items) {
    if (!it.description) {
      it.description = equipment || reference || 'Equipo según cotización';
      warnings.push(`La línea ${it.item} no trae descripción en la tabla; se usó "${it.description}".`);
    }
  }
  if (!items.length) warnings.push('No se encontró la tabla de precios ("Investment summary" / "Resumen de inversión"). Agrega las líneas a mano.');
  const sum = Math.round(items.reduce((s, i) => s + (i.lineTotal || 0), 0) * 100) / 100;
  if (total != null && items.length && Math.abs(sum - total) > 0.01) warnings.push(`La suma de las líneas (${sum}) no coincide con el total del PDF (${total}). Revisa los precios.`);

  return { quoteNumber, reference, equipment, customerName, attention, language, items, total: total ?? (items.length ? sum : null), warnings };
}

module.exports = { parseQuotePdf };
