// Datos iniciales de referencia para que el ERP no arranque vacío.
// Todo esto es editable/borrable desde la aplicación. Se puede llamar muchas veces sin duplicar nada.
const crypto = require('crypto');
const { run, get } = require('./index');

function upsert(table, name) {
  const existing = get(`SELECT id FROM ${table} WHERE name = ?`, [name]);
  if (!existing) run(`INSERT INTO ${table} (name) VALUES (?)`, [name]);
}

// Crea la primera cuenta de administrador si todavía no existe ninguna. Esta cuenta NO
// pasa por la restricción de dominio @nexprotrucks.com (esa restricción aplica solo a los
// usuarios que el administrador invita desde "Usuarios" dentro de la app). Se imprime la
// contraseña temporal en los logs del despliegue una sola vez, al crearla.
function seedAdmin() {
  const existingAdmin = get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (existingAdmin) return;

  const { hashPassword } = require('../src/utils/auth');
  const email = process.env.ADMIN_EMAIL || 'maravilla1967@gmail.com';
  const tempPassword = crypto.randomBytes(9).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
  run(
    `INSERT INTO users (name, email, password_hash, role, status, activated_at) VALUES (?,?,?,'admin','activo', datetime('now'))`,
    ['Jorge Ramirez', email, hashPassword(tempPassword)]
  );
  console.log('========================================');
  console.log('Cuenta de administrador creada:');
  console.log(`  Correo:               ${email}`);
  console.log(`  Contraseña temporal:  ${tempPassword}`);
  console.log('  Cámbiala después de iniciar sesión (menú de tu cuenta > Cambiar contraseña).');
  console.log('========================================');
}

function seed() {
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

  seedAdmin();
}

module.exports = { seed };

if (require.main === module) {
  seed();
}
