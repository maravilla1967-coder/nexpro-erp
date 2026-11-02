// Listas fijas del CRM. La clave se guarda en la base de datos; la etiqueta (en español) pasa por t().

export const ROLES = [
  { key: 'cliente', label: 'Cliente', color: 'green' },
  { key: 'potencial', label: 'Cliente potencial', color: 'blue' },
  { key: 'proveedor', label: 'Proveedor', color: 'orange' },
  { key: 'dealer', label: 'Dealer', color: 'amber' },
];
export const roleLabel = (k) => (ROLES.find((r) => r.key === k) || { label: k }).label;
export const splitRoles = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

// Qué papel tiene la persona dentro del cliente
export const CONTACT_TYPES = [
  { key: 'dueno', label: 'Dueño' },
  { key: 'gerente', label: 'Gerente / Director' },
  { key: 'gerente_flota', label: 'Gerente de flota' },
  { key: 'compras', label: 'Compras' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'mecanico', label: 'Mecánico' },
  { key: 'operador', label: 'Operador / Conductor' },
  { key: 'contabilidad', label: 'Contabilidad / Pagos' },
  { key: 'vendedor', label: 'Vendedor / Representante' },
  { key: 'empleado', label: 'Empleado' },
  { key: 'otro', label: 'Otro' },
];
export const contactTypeLabel = (k) => (CONTACT_TYPES.find((c) => c.key === k) || { label: k || '' }).label;

export const CHANNELS = [
  { key: 'llamada', label: 'Llamada', icon: '📞' },
  { key: 'email', label: 'Email', icon: '✉️' },
  { key: 'texto', label: 'Texto (SMS)', icon: '💬' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '🟢' },
  { key: 'visita', label: 'Visita', icon: '🤝' },
  { key: 'web', label: 'Web', icon: '🌐' },
];
export const channelIcon = (k) => (CHANNELS.find((c) => c.key === k) || { icon: '•' }).icon;

// Tipos de interacción (tabla activities)
export const INTERACTION_TYPES = [
  { key: 'llamada', label: 'Llamada', icon: '📞' },
  { key: 'email', label: 'Email', icon: '✉️' },
  { key: 'texto', label: 'Texto (SMS)', icon: '💬' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '🟢' },
  { key: 'reunion', label: 'Reunión', icon: '👥' },
  { key: 'visita', label: 'Visita', icon: '🤝' },
  { key: 'web', label: 'Web', icon: '🌐' },
  { key: 'nota', label: 'Nota', icon: '📝' },
  { key: 'tarea', label: 'Tarea', icon: '✅' },
];
export const interactionIcon = (k) => (INTERACTION_TYPES.find((c) => c.key === k) || { icon: '•' }).icon;
export const interactionLabel = (k) => (INTERACTION_TYPES.find((c) => c.key === k) || { label: k }).label;

export const REQUEST_STATUSES = ['nueva', 'en_proceso', 'cotizada', 'ganada', 'perdida', 'cerrada'];
export const PRIORITIES = ['baja', 'normal', 'alta', 'urgente'];

export const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const shortDate = (s) => (s ? String(s).slice(0, 10) : '—');
export const digits = (s) => String(s || '').replace(/\D/g, '');
