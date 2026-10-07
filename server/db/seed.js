// Datos iniciales de referencia para que el ERP no arranque vacío.
// Todo esto es editable/borrable desde la aplicación.
const { run, get } = require('./index');

function upsert(table, name) {
  const existing = get(`SELECT id FROM ${table} WHERE name = ?`, [name]);
  if (!existing) run(`INSERT INTO ${table} (name) VALUES (?)`, [name]);
}

// Tipos de equipo instalado en el chasis (ajustables)
[
  'Grúa (Crane)',
  'Compresor',
  'Bucket Lift (Canasta Aérea)',
  'Lift Gate',
  'Grapple Loader',
  'Malacate (Winch)',
  'Generador',
].forEach((n) => upsert('equipment_types', n));

// Tipos de producto para agrupar el inventario (ajustables)
[
  'Crane Bodies',
  'Grapple Loaders',
  'Equipo Aéreo (Aerial)',
  'Carrocerías Especiales',
  'Accesorios y Herrajes',
  'Partes y Repuestos',
  'Consumibles',
].forEach((n) => upsert('product_types', n));

// Catálogo de servicios de ejemplo (editar/borrar según necesidad real del taller)
const serviceExamples = [
  { name: 'Diagnóstico general', pricingType: 'hora', hourlyRate: 85 },
  { name: 'Instalación de grúa', pricingType: 'servicio_completo', flatPrice: 1800 },
  { name: 'Instalación de bucket lift', pricingType: 'servicio_completo', flatPrice: 2200 },
  { name: 'Instalación de lift gate', pricingType: 'servicio_completo', flatPrice: 950 },
  { name: 'Mantenimiento preventivo', pricingType: 'hora', hourlyRate: 75 },
];
serviceExamples.forEach((s) => {
  const existing = get('SELECT id FROM services WHERE name = ?', [s.name]);
  if (!existing) {
    run(
      'INSERT INTO services (name, pricing_type, hourly_rate, flat_price) VALUES (?,?,?,?)',
      [s.name, s.pricingType, s.hourlyRate || 0, s.flatPrice || 0]
    );
  }
});

console.log('Datos iniciales de referencia cargados (tipos de equipo, tipos de producto, servicios de ejemplo).');
