const multer = require('multer');
const path = require('path');
const fs = require('fs');

function makeUploader(subfolder) {
  const dest = path.join(__dirname, '..', '..', 'uploads', subfolder);
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

module.exports = { makeUploader };
