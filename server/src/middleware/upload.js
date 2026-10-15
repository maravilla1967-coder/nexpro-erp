const multer = require('multer');
const path = require('path');
const fs = require('fs');

// En producción (Railway), UPLOADS_DIR apunta al volumen persistente (p. ej. /data/uploads).
// Debe coincidir exactamente con el valor que usa server/src/index.js para servir /uploads,
// o los archivos se guardan en un lado y se sirven desde otro (404 aunque la subida funcione).
const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

function makeUploader(subfolder) {
  const dest = path.join(UPLOADS_ROOT, subfolder);
  fs.mkdirSync(dest, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      const base = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, base + ext);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (/^image\//.test(file.mimetype)) cb(null, true);
      else cb(new Error('Solo se permiten imágenes'));
    },
  });
}

// Para adjuntar cualquier tipo de documento (cotización del proveedor en PDF, fotos,
// etc.) sin restringir el tipo de archivo, a diferencia de makeUploader() que solo
// acepta imágenes.
function makeDocUploader(subfolder) {
  const dest = path.join(UPLOADS_ROOT, subfolder);
  fs.mkdirSync(dest, { recursive: true });
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const base = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, base + ext);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
  });
}

module.exports = { makeUploader, makeDocUploader, UPLOADS_ROOT };
