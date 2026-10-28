require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Archivos subidos (fotos de productos y vehículos). En producción (Railway) UPLOADS_DIR
// debe apuntar a un volumen persistente, p. ej. /data/uploads, para que las fotos no se
// pierdan en cada despliegue.
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Carga datos iniciales de referencia (tipos de equipo, tipos de producto, servicios de
// ejemplo) la primera vez que arranca contra una base de datos nueva. Es seguro llamarlo
// en cada arranque: no duplica nada si ya existen.
try {
  require('../db/seed').seed();
} catch (err) {
  console.error('No se pudo cargar el seed inicial:', err.message);
}

// Importa una sola vez las órdenes de compra históricas que Jorge llevaba en su Excel de
// control. Protegido por una bandera en app_settings, así que es seguro llamarlo en cada
// arranque: después de la primera vez no hace nada.
try {
  require('../db/import-historical-pos').importHistoricalPOs();
} catch (err) {
  console.error('No se pudo importar las órdenes de compra históricas:', err.message);
}
try {
  require('../db/cleanup-test-invoices').cleanupTestInvoices();
} catch (err) {
  console.error('No se pudo borrar la factura de prueba FAC-0001:', err.message);
}
try {
  require('../db/import-maxxsuite').importMaxxsuite();
} catch (err) {
  console.error('No se pudo importar el catálogo de MaxxSuite:', err.message);
}
try {
  require('./utils/receiving').backfillReceivedQty();
} catch (err) {
  console.error('No se pudo preparar la recepción por líneas:', err.message);
}
try {
  require('./utils/payments').backfillLegacyPaidInvoices();
} catch (err) {
  console.error('No se pudo preparar el registro de cobros:', err.message);
}
// Devuelve a las órdenes de compra ya importadas su número original del Excel de control
// (una sola vez; protegido por bandera).
try {
  require('../db/import-historical-pos').restoreOriginalPoNumbers();
} catch (err) {
  console.error('No se pudo restaurar la numeración original de las órdenes de compra:', err.message);
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Autenticación: login, aceptar invitación, etc. No requiere sesión previa.
app.use('/api/auth', require('./routes/auth'));
// Registro de lo que pasa en el navegador (p. ej. Safari al guardar un pago con archivo), para
// poder ver en los logs de Railway dónde falla algo que no llega a enviarse al servidor.
app.post('/api/client-log', (req, res) => {
  try { console.log('[navegador]', JSON.stringify(req.body || {}).slice(0, 3000), '|', String(req.headers['user-agent'] || '').slice(0, 160)); } catch (_) {}
  res.status(204).end();
});

// A partir de aquí, toda la API requiere una sesión válida.
const { requireAuth, requireAdmin } = require('./middleware/auth');
app.use('/api', requireAuth);
// Usuarios que no son administradores: modificar o borrar documentos requiere autorización.
app.use('/api', require('./middleware/changeControl').changeControl);

app.use('/api/users', requireAdmin, require('./routes/users'));
app.use('/api/approvals', require('./routes/approvals'));

// Rutas API de negocio
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/sales-orders', require('./routes/salesOrders'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/services', require('./routes/services'));
app.use('/api/mechanics', require('./routes/mechanics'));
app.use('/api/work-orders', require('./routes/workOrders'));
app.use('/api/warranties', require('./routes/warranties'));
app.use('/api/payables', require('./routes/payables'));
app.use('/api/service-vouchers', require('./routes/serviceVouchers'));
app.use('/api/bank', require('./routes/bank'));
app.use('/api/serials', require('./routes/serials'));

// Servir el frontend compilado (producción)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  // index.html nunca se guarda en el caché del navegador: así, después de cada publicación,
  // Safari/Chrome cargan la versión nueva del ERP sin tener que forzar la recarga. Los
  // archivos de /assets llevan un nombre único por versión y sí se pueden guardar.
  const noCache = (res) => res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) noCache(res);
      else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    noCache(res);
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Nexpro ERP API escuchando en puerto ${PORT}`);
});
