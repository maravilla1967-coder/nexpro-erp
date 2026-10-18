const { all, get, run } = require('../../db');
const { makeDocUploader } = require('../middleware/upload');

// Comprobantes adjuntos a un pago (cobro de factura o pago a proveedor).
const upload = makeDocUploader('payment-docs');
const TABLE = { invoice: 'invoice_payments', bill: 'supplier_bill_payments' };
const PARENT = { invoice: 'invoice_id', bill: 'bill_id' };

function attachFiles(payments, kind) {
  for (const p of payments) {
    p.files = all('SELECT * FROM payment_files WHERE kind = ? AND payment_id = ? ORDER BY id', [kind, p.id]);
  }
  return payments;
}

// Rutas: POST /:id/payments/:paymentId/files (varios archivos) y DELETE …/files/:fileId.
// parentKey es el id de la factura o de la factura del proveedor; getFull devuelve el
// documento completo actualizado.
function mountPaymentFileRoutes(router, kind, getFull) {
  router.post('/:id/payments/:paymentId/files', upload.array('files', 10), (req, res) => {
    const pay = get(`SELECT id FROM ${TABLE[kind]} WHERE id = ? AND ${PARENT[kind]} = ?`, [req.params.paymentId, req.params.id]);
    if (!pay) return res.status(404).json({ error: 'Pago no encontrado' });
    for (const f of req.files || []) {
      run('INSERT INTO payment_files (kind, payment_id, file_url, original_name) VALUES (?,?,?,?)',
        [kind, pay.id, `/uploads/payment-docs/${f.filename}`, f.originalname]);
    }
    res.status(201).json(getFull(req.params.id));
  });
  router.delete('/:id/payments/:paymentId/files/:fileId', (req, res) => {
    run('DELETE FROM payment_files WHERE id = ? AND kind = ? AND payment_id = ?', [req.params.fileId, kind, req.params.paymentId]);
    res.json(getFull(req.params.id));
  });
}

// Para recibir el pago y sus comprobantes en UNA sola petición (multipart): así Safari no se
// queda a mitad de camino entre guardar el pago y subir el archivo.
const paymentUpload = upload.array('files', 10);
function saveFilesForPayment(kind, paymentId, files) {
  for (const f of files || []) {
    run('INSERT INTO payment_files (kind, payment_id, file_url, original_name) VALUES (?,?,?,?)',
      [kind, paymentId, `/uploads/payment-docs/${f.filename}`, f.originalname]);
  }
}

function deleteFilesOfPayment(kind, paymentId) {
  run('DELETE FROM payment_files WHERE kind = ? AND payment_id = ?', [kind, paymentId]);
}

module.exports = { attachFiles, mountPaymentFileRoutes, deleteFilesOfPayment, paymentUpload, saveFilesForPayment };
