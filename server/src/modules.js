// Lista fija de módulos del ERP para el sistema de permisos.
// La clave (key) se usa en la base de datos y en las rutas; label es el nombre visible.
const MODULES = [
  { key: 'clientes', label: 'Clientes (CRM)' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'compras', label: 'Órdenes de Compra' },
  { key: 'pedidos', label: 'Órdenes de Pedido' },
  { key: 'facturas', label: 'Facturación' },
  { key: 'vehiculos', label: 'Recepción de Vehículos' },
  { key: 'servicios', label: 'Catálogo de Servicios' },
  { key: 'mecanicos', label: 'Mecánicos' },
  { key: 'ordenes_trabajo', label: 'Órdenes de Trabajo' },
];

const MODULE_KEYS = MODULES.map((m) => m.key);

module.exports = { MODULES, MODULE_KEYS };
