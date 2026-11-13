const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_FILE || path.join(__dirname, 'nexpro.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Migraciones idempotentes para bases de datos ya existentes (CREATE TABLE IF NOT EXISTS
// no agrega columnas nuevas a una tabla que ya existe con datos).
function tryAlter(sql) {
  try {
    db.exec(sql);
  } catch (e) {
    // La columna ya existe; no hacer nada.
  }
}
tryAlter('ALTER TABLE work_orders ADD COLUMN diagnosis TEXT');
tryAlter('ALTER TABLE work_orders ADD COLUMN resolution TEXT');
tryAlter('ALTER TABLE services ADD COLUMN name_en TEXT');
tryAlter('ALTER TABLE services ADD COLUMN description_en TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN code TEXT');
tryAlter('ALTER TABLE work_order_parts ADD COLUMN notes TEXT');
tryAlter('ALTER TABLE work_order_parts ADD COLUMN product_id INTEGER REFERENCES products(id)');
// Orden de trabajo asignada a un proveedor externo (ej. Florida Power Train instala bombas y PTO)
// en lugar de un mecánico propio; y número de serie de cada parte (libre o ligado a inventario).
tryAlter('ALTER TABLE work_orders ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id)');
tryAlter('ALTER TABLE work_order_parts ADD COLUMN serial TEXT');
tryAlter('ALTER TABLE work_order_parts ADD COLUMN product_serial_id INTEGER REFERENCES product_serials(id)');
tryAlter('ALTER TABLE customers ADD COLUMN zip TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN city TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN zip TEXT');
tryAlter('ALTER TABLE work_orders ADD COLUMN invoice_id INTEGER REFERENCES invoices(id)');
tryAlter('ALTER TABLE invoices ADD COLUMN include_wire_info INTEGER NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE purchase_orders ADD COLUMN order_date TEXT');
// Datos bancarios del proveedor (ACH/wire) para bases de datos ya existentes.
tryAlter('ALTER TABLE suppliers ADD COLUMN beneficiary_name TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN beneficiary_address TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN bank_name TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN bank_address TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN aba_routing_number TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN account_number TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN account_type TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN swift_bic TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN bank_contact_name TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN bank_contact_phone TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN bank_contact_email TEXT');
tryAlter('ALTER TABLE suppliers ADD COLUMN bank_notes TEXT');
tryAlter('ALTER TABLE purchase_order_items ADD COLUMN received_qty REAL NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE products ADD COLUMN track_serials INTEGER NOT NULL DEFAULT 0');
// Datos del fabricante para carrocerías / equipos (listas de precios Reading, etc.):
// Item # del fabricante, CA del chasis (pulgadas), GVWR del chasis (lb), peso de la carrocería (lb),
// costo de instalación y si es configuración en stock del fabricante (✓ en la lista).
tryAlter('ALTER TABLE products ADD COLUMN vendor_item_number TEXT');
tryAlter('ALTER TABLE products ADD COLUMN chassis_ca REAL');
tryAlter('ALTER TABLE products ADD COLUMN gvwr REAL');
tryAlter('ALTER TABLE products ADD COLUMN body_weight REAL');
tryAlter('ALTER TABLE products ADD COLUMN installation_cost REAL NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE products ADD COLUMN vendor_stocked INTEGER NOT NULL DEFAULT 0');
// Boleta de entrega (Delivery Ticket) de la factura: número NX-DT-…, fecha, quién entrega,
// quién recibe y notas. Se crea desde la factura y lista todo lo facturado (sin precios).
tryAlter('ALTER TABLE invoices ADD COLUMN delivery_number TEXT');
tryAlter('ALTER TABLE invoices ADD COLUMN delivery_date TEXT');
tryAlter('ALTER TABLE invoices ADD COLUMN delivery_delivered_by TEXT');
tryAlter('ALTER TABLE invoices ADD COLUMN delivery_received_by TEXT');
tryAlter('ALTER TABLE invoices ADD COLUMN delivery_notes TEXT');
// Recargo cobrado al cliente aparte del abono (p. ej. 3% por pagar con tarjeta en Square).
// No reduce el saldo de la factura: el total cobrado = amount + surcharge.
tryAlter('ALTER TABLE invoice_payments ADD COLUMN surcharge REAL NOT NULL DEFAULT 0');
// Comisión que cobra el procesador (Square: 3.5% + $0.15). Neto recibido = amount + surcharge - processor_fee.
tryAlter('ALTER TABLE invoice_payments ADD COLUMN processor_fee REAL NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE warranties ADD COLUMN product_serial_id INTEGER REFERENCES product_serials(id)');
// Cadena de compras enlazada: condiciones de pago del proveedor, cuenta por pagar creada desde
// la recepción, y faltantes cerrados (lo que ya no va a llegar de una línea).
tryAlter('ALTER TABLE suppliers ADD COLUMN payment_terms_days INTEGER');
tryAlter('ALTER TABLE supplier_bills ADD COLUMN goods_receipt_id INTEGER REFERENCES goods_receipts(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE purchase_order_items ADD COLUMN short_qty REAL NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE purchase_orders ADD COLUMN short_note TEXT');
tryAlter('ALTER TABLE purchase_orders ADD COLUMN payment_terms_days INTEGER'); // vacío = las del proveedor
// Orden de compra por garantía: la cubre el fabricante/vendedor y va amarrada a un reclamo de
// garantía y al vehículo (VIN) del equipo.
tryAlter('ALTER TABLE purchase_orders ADD COLUMN is_warranty INTEGER NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE purchase_orders ADD COLUMN warranty_id INTEGER REFERENCES warranties(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE purchase_orders ADD COLUMN vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL');
// Finanzas: cada cobro / pago puede quedar en una cuenta bancaria (y conciliado).
// Cuenta especial sin banco: pagos que un socio hizo directamente por Nexpro (no pasan por ningún banco).
tryAlter('ALTER TABLE bank_accounts ADD COLUMN is_direct INTEGER NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE invoice_payments ADD COLUMN bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE invoice_payments ADD COLUMN bank_cleared INTEGER NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE supplier_bill_payments ADD COLUMN bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE supplier_bill_payments ADD COLUMN bank_cleared INTEGER NOT NULL DEFAULT 0');
// Préstamos: base de días para el interés (365 = actual/365, 360 = comercial).
tryAlter('ALTER TABLE loans ADD COLUMN day_basis INTEGER NOT NULL DEFAULT 365');

// ===== CRM completo =====
// Clientes: a qué se dedica la relación (cliente, potencial, proveedor, dealer — puede ser varias,
// separadas por coma), otros nombres con los que se le conoce (para encontrarlo aunque escriban
// solo una parte), enlace a su ficha de proveedor, idioma preferido para correos, etc.
tryAlter("ALTER TABLE customers ADD COLUMN roles TEXT");
tryAlter('ALTER TABLE customers ADD COLUMN aliases TEXT');
tryAlter('ALTER TABLE customers ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE customers ADD COLUMN state TEXT');
tryAlter('ALTER TABLE customers ADD COLUMN phone2 TEXT');
tryAlter('ALTER TABLE customers ADD COLUMN website TEXT');
tryAlter("ALTER TABLE customers ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'en'");
// Contactos: tipo de cargo (dueño, gerente, mecánico…), cargo exacto, celular, contacto principal.
tryAlter('ALTER TABLE contacts ADD COLUMN contact_type TEXT');
tryAlter('ALTER TABLE contacts ADD COLUMN mobile TEXT');
tryAlter('ALTER TABLE contacts ADD COLUMN is_primary INTEGER NOT NULL DEFAULT 0');
tryAlter('ALTER TABLE contacts ADD COLUMN preferred_channel TEXT');
tryAlter('ALTER TABLE contacts ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
// Interacciones (tabla activities): con quién se habló, de qué solicitud, por qué medio y quién la registró.
tryAlter('ALTER TABLE activities ADD COLUMN contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE activities ADD COLUMN request_id INTEGER REFERENCES crm_requests(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE activities ADD COLUMN direction TEXT');
tryAlter('ALTER TABLE activities ADD COLUMN created_by INTEGER REFERENCES users(id)');
tryAlter('ALTER TABLE activities ADD COLUMN occurred_at TEXT');
// Mensajes enviados al cliente: a quién, asunto y texto exactos (para poder reenviarlos).
tryAlter('ALTER TABLE activities ADD COLUMN msg_to TEXT');
tryAlter('ALTER TABLE activities ADD COLUMN msg_subject TEXT');
tryAlter('ALTER TABLE activities ADD COLUMN msg_body TEXT');
// Cada vehículo (y sus equipos) puede pertenecer a una persona concreta del cliente.
tryAlter('ALTER TABLE vehicles ADD COLUMN contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL');
// Orden de pedido nacida de una solicitud del CRM, a la atención de un contacto.
tryAlter('ALTER TABLE sales_orders ADD COLUMN contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL');
tryAlter('ALTER TABLE sales_orders ADD COLUMN request_id INTEGER REFERENCES crm_requests(id) ON DELETE SET NULL');
// Orden de trabajo (servicio) nacida de una llamada / solicitud del CRM.
tryAlter('ALTER TABLE work_orders ADD COLUMN request_id INTEGER REFERENCES crm_requests(id) ON DELETE SET NULL');
try {
  db.exec("UPDATE customers SET roles = CASE WHEN status IN ('lead','prospecto') THEN 'potencial' ELSE 'cliente' END WHERE roles IS NULL OR roles = ''");
} catch (e) { console.error('CRM roles:', e.message); }
// Reparación: todo pedido con una factura vigente queda "facturado" (se habían devuelto a mano a
// otro estado y volvían a aparecer como pendientes de facturar). Se corre en cada arranque.
try {
  db.exec(`UPDATE sales_orders SET status = 'facturado'
           WHERE status != 'facturado' AND EXISTS (SELECT 1 FROM invoices i WHERE i.sales_order_id = sales_orders.id AND i.status NOT IN ('anulada','cancelado'))`);
} catch (e) { console.error('Reparación de pedidos facturados:', e.message); }
try { db.exec('CREATE INDEX IF NOT EXISTS idx_activities_customer ON activities(customer_id)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_requests_customer ON crm_requests(customer_id)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_requests_vehicle ON crm_requests(vehicle_id)'); } catch (e) {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts(customer_id)'); } catch (e) {}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  return { lastInsertRowid: Number(result.lastInsertRowid), changes: Number(result.changes) };
}

function nowIso() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = { db, all, get, run, nowIso };

// Migración única: los equipos instalados con un tipo "nuevo" escrito a mano pasan a usar la
// lista maestra de tipos (se crea el tipo si no existía).
try {
  const flag = get("SELECT value FROM app_settings WHERE key = 'equipment_types_master_v1'");
  if (!flag) {
    const rows = all("SELECT id, custom_type_name FROM vehicle_equipment WHERE equipment_type_id IS NULL AND custom_type_name IS NOT NULL AND trim(custom_type_name) != ''");
    for (const r of rows) {
      const name = r.custom_type_name.trim();
      let t = get('SELECT id FROM equipment_types WHERE lower(name) = lower(?)', [name]);
      const tid = t ? t.id : run('INSERT INTO equipment_types (name) VALUES (?)', [name]).lastInsertRowid;
      run('UPDATE vehicle_equipment SET equipment_type_id = ?, custom_type_name = NULL WHERE id = ?', [tid, r.id]);
    }
    run("INSERT INTO app_settings (key, value) VALUES ('equipment_types_master_v1', ?)", [String(rows.length)]);
  }
} catch (e) { console.error('Migración de tipos de equipo:', e.message); }

// Enlace orden de compra ↔ reclamo de garantía (se corre en cada arranque, es idempotente):
// todo reclamo que ya apunta a una orden de compra marca esa orden como "por garantía".
try {
  db.exec(`UPDATE purchase_orders SET is_warranty = 1,
             warranty_id = (SELECT w.id FROM warranties w WHERE w.purchase_order_id = purchase_orders.id AND w.kind = 'reclamo' ORDER BY w.id LIMIT 1)
           WHERE warranty_id IS NULL AND EXISTS (SELECT 1 FROM warranties w WHERE w.purchase_order_id = purchase_orders.id AND w.kind = 'reclamo')`);
  db.exec(`UPDATE purchase_orders SET vehicle_id = (SELECT w.vehicle_id FROM warranties w WHERE w.id = purchase_orders.warranty_id)
           WHERE vehicle_id IS NULL AND warranty_id IS NOT NULL`);
} catch (e) { console.error('Enlace OC-garantía:', e.message); }
// Migración única pedida por Jorge: la orden de compra 273 es la del reclamo NX-WC-20261113-01.
try {
  if (!get("SELECT value FROM app_settings WHERE key = 'po273_warranty_link_v1'")) {
    const w = get("SELECT id FROM warranties WHERE number = 'NX-WC-20261113-01'");
    const pos = all("SELECT id FROM purchase_orders WHERE number = '273' OR number LIKE '%-273' OR number LIKE '% 273'");
    if (w && pos.length === 1) {
      require('../src/utils/warrantyLink').linkPoWarranty(pos[0].id, w.id);
      run("INSERT INTO app_settings (key, value) VALUES ('po273_warranty_link_v1', ?)", [String(pos[0].id)]);
    }
  }
} catch (e) { console.error('Enlace OC 273:', e.message); }
