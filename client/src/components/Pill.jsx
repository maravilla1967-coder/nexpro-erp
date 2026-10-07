import React from 'react';
import { useI18n } from '../i18n.jsx';

const COLORS = {
  lead: 'gray', prospecto: 'blue', cliente: 'green', inactivo: 'gray',
  pendiente: 'amber', aprobado: 'blue', en_proceso: 'orange', facturado: 'green',
  cancelado: 'red', pagada: 'green', vencida: 'red', borrador: 'gray', enviada: 'blue',
  recibido: 'blue', en_servicio: 'orange', completado: 'green', entregado: 'gray',
  nuevo: 'gray', calificado: 'blue', propuesta: 'orange', negociacion: 'amber',
  ganado: 'green', perdido: 'red', activo: 'green',
};

export default function Pill({ value }) {
  const { t } = useI18n();
  if (!value) return null;
  const color = COLORS[value] || 'gray';
  const label = t(value.replace(/_/g, ' '));
  return <span className={`pill ${color}`}>{label}</span>;
}
