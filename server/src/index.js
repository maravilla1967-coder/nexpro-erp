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

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Autenticación: login, aceptar invitación, etc. No requiere sesión previa.
app.use('/api/auth', require('./routes/auth'));

// A partir de aquí, toda la API requiere una sesión válida.
const { requireAuth, requireAdmin } = require('./middleware/auth');
app.use('/api', requireAuth);

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

// Servir el frontend compilado (producción)
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
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
