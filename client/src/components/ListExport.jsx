import React, { useMemo, useState } from 'react';
import { useI18n } from '../i18n.jsx';

// Herramientas comunes para los listados (inventario, órdenes de compra, pedidos, facturas,
// proveedores, clientes):
//   - Filtrar por rango de fechas (desde / hasta) y por rango de números (desde / hasta).
//   - Marcar filas una por una con casillas (órdenes "tales y tales").
//   - Descargar a Excel (.xlsx) o CSV, e imprimir / guardar PDF del listado con el logo de Nexpro.
// Columnas: { label, value(row), type: 'money'|'number'|'text', mono, noTotal } — noTotal evita
// sumar en la fila TOTAL columnas por unidad (costo unitario, precio de venta…).
// Lo que se exporta o imprime: las filas marcadas si hay alguna marcada; si no, todas las que
// se ven en pantalla después de aplicar los filtros.

const numCompare = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
const dateOnly = (v) => (v ? String(v).slice(0, 10) : '');

export function useListExport({ rows, getDate, getNumber }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [numFrom, setNumFrom] = useState('');
  const [numTo, setNumTo] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const visible = useMemo(() => {
    return (rows || []).filter((r) => {
      if (getDate && (dateFrom || dateTo)) {
        const d = dateOnly(getDate(r));
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      if (getNumber && (numFrom.trim() || numTo.trim())) {
        const n = getNumber(r);
        if (numFrom.trim() && numCompare(n, numFrom.trim()) < 0) return false;
        if (numTo.trim() && numCompare(n, numTo.trim()) > 0) {
          // "Hasta 228" incluye también 228-1, 228-2…
          const base = String(n ?? '').split('-')[0];
          if (base !== numTo.trim()) return false;
        }
      }
      return true;
    });
  }, [rows, getDate, getNumber, dateFrom, dateTo, numFrom, numTo]);

  const selectedRows = (rows || []).filter((r) => selected.has(r.id));
  const target = selectedRows.length > 0 ? selectedRows : visible;
  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visible.forEach((r) => next.delete(r.id));
      else visible.forEach((r) => next.add(r.id));
      return next;
    });
  }
  function clearAll() {
    setSelected(new Set());
    setDateFrom(''); setDateTo(''); setNumFrom(''); setNumTo('');
  }

  return {
    visible, target, selected, selectedCount: selectedRows.length, allVisibleSelected,
    toggle, toggleAllVisible, clearAll,
    hasDate: !!getDate, hasNumber: !!getNumber,
    dateFrom, setDateFrom, dateTo, setDateTo, numFrom, setNumFrom, numTo, setNumTo,
    total: (rows || []).length,
  };
}

export function SelectAllBox({ ex }) {
  return <input type="checkbox" className="row-check" checked={ex.allVisibleSelected} onChange={ex.toggleAllVisible} title="Seleccionar todo" />;
}

export function RowBox({ ex, row }) {
  return <input type="checkbox" className="row-check" checked={ex.selected.has(row.id)} onChange={() => ex.toggle(row.id)} onClick={(e) => e.stopPropagation()} />;
}

function cellValue(col, row) {
  const v = col.value(row);
  return v === undefined || v === null ? '' : v;
}

function fmtMoney(v) {
  const n = Number(v) || 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function stamp() { return new Date().toISOString().slice(0, 10); }

export default function ListExportBar({ ex, title, filename, columns }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const cols = columns.map((c) => ({ ...c, label: t(c.label) }));
  const filtersOn = ex.dateFrom || ex.dateTo || ex.numFrom || ex.numTo;

  function filterDescription() {
    if (ex.selectedCount > 0) return `${ex.selectedCount} ${t('seleccionados')}`;
    const parts = [];
    if (ex.numFrom || ex.numTo) parts.push(`${t('No.')} ${ex.numFrom || '…'} – ${ex.numTo || '…'}`);
    if (ex.dateFrom || ex.dateTo) parts.push(`${t('Fecha')} ${ex.dateFrom || '…'} – ${ex.dateTo || '…'}`);
    return parts.length ? parts.join(' · ') : t('Todos');
  }

  async function downloadExcel() {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const data = ex.target.map((r) => {
        const o = {};
        cols.forEach((c) => {
          const v = cellValue(c, r);
          o[c.label] = c.type === 'money' || c.type === 'number' ? (v === '' ? '' : Number(v) || 0) : String(v);
        });
        return o;
      });
      const moneyCols = cols.filter((c) => c.type === 'money' && !c.noTotal);
      if (moneyCols.length && data.length) {
        const totalRow = {};
        cols.forEach((c, i) => { totalRow[c.label] = i === 0 ? t('TOTAL') : ''; });
        moneyCols.forEach((c) => { totalRow[c.label] = ex.target.reduce((s, r) => s + (Number(cellValue(c, r)) || 0), 0); });
        data.push(totalRow);
      }
      const ws = XLSX.utils.json_to_sheet(data, { header: cols.map((c) => c.label) });
      ws['!cols'] = cols.map((c) => ({ wch: Math.max(c.label.length + 2, c.type === 'money' ? 14 : 16) }));
      // Formato de moneda en las columnas de dinero.
      const range = XLSX.utils.decode_range(ws['!ref']);
      cols.forEach((c, ci) => {
        if (c.type !== 'money') return;
        for (let ri = 1; ri <= range.e.r; ri++) {
          const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
          if (cell && typeof cell.v === 'number') cell.z = '"$"#,##0.00';
        }
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
      XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => q(c.label)).join(',')];
    ex.target.forEach((r) => lines.push(cols.map((c) => q(cellValue(c, r))).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}-${stamp()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function printList() {
    const w = window.open('', '_blank');
    if (!w) { alert(t('Permite las ventanas emergentes para imprimir el listado.')); return; }
    const moneyCols = cols.filter((c) => c.type === 'money' && !c.noTotal);
    const head = cols.map((c) => `<th class="${c.type === 'money' || c.type === 'number' ? 'r' : ''}">${escapeHtml(c.label)}</th>`).join('');
    const body = ex.target.map((r) => '<tr>' + cols.map((c) => {
      const v = cellValue(c, r);
      const txt = c.type === 'money' ? (v === '' ? '' : fmtMoney(v)) : v;
      return `<td class="${c.type === 'money' || c.type === 'number' ? 'r' : ''}${c.mono ? ' m' : ''}">${escapeHtml(txt)}</td>`;
    }).join('') + '</tr>').join('');
    const foot = moneyCols.length ? '<tr class="tot">' + cols.map((c, i) => {
      if (c.type === 'money' && !c.noTotal) return `<td class="r">${fmtMoney(ex.target.reduce((s, r) => s + (Number(cellValue(c, r)) || 0), 0))}</td>`;
      return `<td>${i === 0 ? t('TOTAL') : ''}</td>`;
    }).join('') + '</tr>' : '';
    const logo = `${window.location.origin}/nexpro-logo.png`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} – Nexpro</title>
<style>
  @page { size: letter landscape; margin: 0.45in; }
  body { font-family: 'Segoe UI', system-ui, Arial, sans-serif; color: #1e293b; font-size: 11px; margin: 0; }
  .brand { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #e8622c; padding-bottom: 10px; margin-bottom: 12px; }
  .brand img { height: 54px; }
  .contact { text-align: right; color: #64748b; font-size: 10px; line-height: 1.5; }
  h1 { font-size: 18px; margin: 0 0 2px; color: #0f2742; }
  .meta { color: #64748b; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0f2742; color: #fff; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .03em; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .r { text-align: right; } .m { font-family: ui-monospace, Menlo, monospace; }
  tr.tot td { font-weight: 700; border-top: 2px solid #0f2742; background: #fff; }
  thead { display: table-header-group; } tr { page-break-inside: avoid; }
</style></head><body>
<div class="brand">
  <img src="${logo}" alt="Nexpro Trucks & Equipment Corp." onerror="this.outerHTML='<strong>NEXPRO TRUCKS &amp; EQUIPMENT CORP.</strong>'">
  <div class="contact">7380 NW 77th CT, Miami, FL 33166<br>Tel: 786-631-5922 · info@nexprotrucks.com</div>
</div>
<h1>${escapeHtml(title)}</h1>
<div class="meta">${escapeHtml(filterDescription())} · ${ex.target.length} ${escapeHtml(t('registros'))} · ${escapeHtml(t('Generado'))} ${stamp()}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}${foot}</tbody></table>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
</body></html>`);
    w.document.close();
  }

  return (
    <div className="list-export">
      <div className="list-export-filters">
        {ex.hasNumber && (
          <div className="range"><span>{t('No.')}</span>
            <input placeholder={t('desde')} value={ex.numFrom} onChange={(e) => ex.setNumFrom(e.target.value)} />
            <input placeholder={t('hasta')} value={ex.numTo} onChange={(e) => ex.setNumTo(e.target.value)} />
          </div>
        )}
        {ex.hasDate && (
          <div className="range"><span>{t('Fecha')}</span>
            <input type="date" value={ex.dateFrom} onChange={(e) => ex.setDateFrom(e.target.value)} />
            <input type="date" value={ex.dateTo} onChange={(e) => ex.setDateTo(e.target.value)} />
          </div>
        )}
        {(filtersOn || ex.selectedCount > 0) && <button className="link-btn" onClick={ex.clearAll}>{t('Limpiar')}</button>}
      </div>
      <div className="list-export-actions">
        <span className="muted">
          {ex.selectedCount > 0 ? `${ex.selectedCount} ${t('seleccionados')}` : `${ex.visible.length} ${t('de')} ${ex.total}`}
        </span>
        <button className="btn btn-sm" disabled={busy || ex.target.length === 0} onClick={downloadExcel}>{busy ? '…' : t('⬇ Excel')}</button>
        <button className="btn btn-sm" disabled={ex.target.length === 0} onClick={downloadCsv}>{t('⬇ CSV')}</button>
        <button className="btn btn-sm btn-primary" disabled={ex.target.length === 0} onClick={printList}>{t('🖨️ Imprimir listado')}</button>
      </div>
    </div>
  );
}
