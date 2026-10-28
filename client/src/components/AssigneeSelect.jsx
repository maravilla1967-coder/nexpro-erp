import React from 'react';
import { useI18n } from '../i18n.jsx';

// "Asignado a": un mecánico propio o un proveedor externo (taller que monta el trabajo,
// ej. Florida Power Train para bombas y PTO). El valor es 'm:<id>', 's:<id>' o ''.
export function assigneeValue(wo) {
  if (!wo) return '';
  if (wo.supplier_id) return `s:${wo.supplier_id}`;
  if (wo.mechanic_id) return `m:${wo.mechanic_id}`;
  return '';
}

export function assigneePayload(value) {
  const [kind, id] = String(value || '').split(':');
  return { mechanicId: kind === 'm' ? Number(id) : null, supplierId: kind === 's' ? Number(id) : null };
}

export function assigneeName(wo, t) {
  if (wo.supplier_name) return `${wo.supplier_name} (${t('proveedor')})`;
  return wo.mechanic_name || '—';
}

export default function AssigneeSelect({ value, onChange, mechanics, suppliers }) {
  const { t } = useI18n();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('— Sin asignar —')}</option>
      <optgroup label={t('Mecánicos')}>
        {mechanics.map((m) => <option key={`m${m.id}`} value={`m:${m.id}`}>{m.name}</option>)}
      </optgroup>
      <optgroup label={t('Proveedores (taller externo)')}>
        {suppliers.map((s) => <option key={`s${s.id}`} value={`s:${s.id}`}>{s.name}</option>)}
      </optgroup>
    </select>
  );
}
