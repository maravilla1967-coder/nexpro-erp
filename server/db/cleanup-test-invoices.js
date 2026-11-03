// Limpieza única pedida por Jorge (2026-10-16): la factura FAC-0001 de "Nextran Truck
// Centers" por $9,434.29 fue una prueba hecha antes de definir la numeración NX-INV y no es
// real. Se borra solo si coincide exactamente (número, cliente y total) y no tiene pagos, con
// la misma limpieza que el botón "Eliminar factura". Protegido por bandera.
const { get } = require('./index');

function cleanupTestInvoices() {
  if (get("SELECT value FROM app_settings WHERE key = 'cleanup_fac0001_v1'")) return;
  const { run } = require('./index');
  const inv = get(`SELECT i.id FROM invoices i JOIN customers c ON c.id = i.customer_id
                   WHERE i.number = 'FAC-0001' AND c.name = 'Nextran Truck Centers' AND ABS(i.total - 9434.29) < 0.01
                     AND NOT EXISTS (SELECT 1 FROM invoice_payments p WHERE p.invoice_id = i.id)`);
  let result = 'no encontrada';
  if (inv) {
    require('../src/routes/invoices').service.applyDelete(inv.id);
    result = `eliminada (id ${inv.id})`;
  }
  run("INSERT INTO app_settings (key, value) VALUES ('cleanup_fac0001_v1', ?)", [result]);
  console.log('Factura de prueba FAC-0001:', result);
}

module.exports = { cleanupTestInvoices };
