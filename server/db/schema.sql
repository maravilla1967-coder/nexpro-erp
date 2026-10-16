-- Nexpro ERP - esquema SQLite
PRAGMA foreign_keys = ON;

-- ===================== CRM =====================
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'empresa',
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  zip TEXT,
  industry TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  source TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opportunities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'nuevo',
  value REAL,
  probability INTEGER,
  expected_close TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  notes TEXT,
  due_date TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== INVENTARIO =====================
CREATE TABLE IF NOT EXISTS product_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  zip TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  photo_url TEXT,
  product_type_id INTEGER REFERENCES product_types(id),
  purchase_cost REAL NOT NULL DEFAULT 0,
  freight_cost REAL NOT NULL DEFAULT 0,
  margin_percent REAL NOT NULL DEFAULT 30,
  selling_price REAL NOT NULL DEFAULT 0,
  stock_qty REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unidad',
  supplier_id INTEGER REFERENCES suppliers(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== COMPRAS =====================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT NOT NULL DEFAULT 'borrador', -- 'borrador' (editable) -> 'enviada' (colocada con el proveedor) -> 'recibida'
  order_date TEXT, -- fecha real de la orden (AAAA-MM-DD); puede ser distinta de created_at en órdenes importadas
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL
);

-- Documentos adjuntos a una orden de compra (cotización del proveedor, factura final,
-- etc.). Cualquier tipo de archivo, no solo imágenes.
CREATE TABLE IF NOT EXISTS purchase_order_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  original_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== PEDIDOS DE VENTA =====================
CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'pendiente',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL
);

-- ===================== FACTURACION =====================
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  sales_order_id INTEGER UNIQUE REFERENCES sales_orders(id),
  status TEXT NOT NULL DEFAULT 'pendiente',
  issue_date TEXT NOT NULL DEFAULT (datetime('now')),
  due_date TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  include_wire_info INTEGER NOT NULL DEFAULT 0, -- si se incluye el bloque de datos de transferencia bancaria al imprimir
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL
);

-- ===================== RECEPCION DE VEHICULOS =====================
CREATE TABLE IF NOT EXISTS equipment_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vin TEXT NOT NULL UNIQUE,
  make TEXT,
  model TEXT,
  year INTEGER,
  chassis_type TEXT,
  plate TEXT,
  customer_id INTEGER REFERENCES customers(id),
  photo_url TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'recibido',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS vehicle_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  equipment_type_id INTEGER REFERENCES equipment_types(id),
  custom_type_name TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== SERVICIOS / MECANICOS / ORDENES DE TRABAJO =====================
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  name_en TEXT,
  description_en TEXT,
  pricing_type TEXT NOT NULL DEFAULT 'hora',
  hourly_rate REAL DEFAULT 0,
  flat_price REAL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mechanics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialty TEXT,
  phone TEXT,
  email TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id),
  mechanic_id INTEGER REFERENCES mechanics(id),
  status TEXT NOT NULL DEFAULT 'pendiente',
  notes TEXT,
  diagnosis TEXT,
  resolution TEXT,
  invoice_id INTEGER REFERENCES invoices(id), -- se marca al facturar (ver /invoices/from-work-orders); una
                                               -- factura puede cubrir varias órdenes de trabajo del mismo vehículo
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS work_order_services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  description TEXT NOT NULL,
  pricing_type TEXT NOT NULL DEFAULT 'hora',
  hours REAL DEFAULT 0,
  hourly_rate REAL DEFAULT 0,
  flat_price REAL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0
);

-- Partes reemplazadas o reparadas en una orden de trabajo (para el documento de servicio)
CREATE TABLE IF NOT EXISTS work_order_parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'reemplazada', -- 'reemplazada' | 'reparada' | 'garantia' | 'cliente'
  quantity REAL NOT NULL DEFAULT 1,
  unit_cost REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT
);

-- Fotos adjuntas a una orden de trabajo (evidencia del daño, del repuesto, del trabajo
-- terminado, etc.). Una orden puede tener varias.
CREATE TABLE IF NOT EXISTS work_order_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== USUARIOS / PERMISOS / APROBACIONES =====================
-- Configuración interna de la app (p. ej. la clave para firmar sesiones).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'usuario', -- 'admin' | 'usuario'
  status TEXT NOT NULL DEFAULT 'invitado', -- 'invitado' | 'activo' | 'desactivado'
  invite_token TEXT,
  invite_expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at TEXT
);

-- Permiso de edición por módulo para usuarios no-administradores.
-- Si no hay fila para (user_id, module), el usuario solo puede ver ese módulo, no editarlo.
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_edit INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, module)
);

-- Cola de cambios pendientes de autorización del administrador (facturas y pedidos).
CREATE TABLE IF NOT EXISTS approval_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- 'invoice' | 'sales_order'
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'update' | 'delete'
  payload TEXT, -- JSON con los cambios propuestos (para 'update')
  summary TEXT,
  requested_by INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'aprobado' | 'rechazado'
  resolved_by INTEGER REFERENCES users(id),
  resolved_at TEXT,
  reject_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== GARANTÍAS =====================
-- Un solo módulo para dos usos:
--   kind = 'reclamo'  → reclamo de garantía al fabricante (equipo/camión que falló).
--   kind = 'registro' → registro de la garantía de un equipo recién comprado (constancia).
-- Ningún dato es obligatorio: VIN, modelo, año, fecha de compra, etc. se llenan si se tienen.
CREATE TABLE IF NOT EXISTS warranties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'reclamo', -- 'reclamo' | 'registro'
  status TEXT NOT NULL DEFAULT 'abierta', -- reclamo: abierta/enviada/aprobada/rechazada/cerrada; registro: registrada
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_equipment_id INTEGER REFERENCES vehicle_equipment(id) ON DELETE SET NULL,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  item_description TEXT,
  vin TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  model TEXT,
  year INTEGER,
  purchase_date TEXT,
  warranty_start TEXT,
  warranty_end TEXT,
  claim_date TEXT,
  manufacturer_claim_number TEXT,
  problem_description TEXT,
  resolution TEXT,
  claim_amount REAL,
  approved_amount REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Archivos de constancia: registro de garantía del fabricante, fotos de la falla, facturas, etc.
CREATE TABLE IF NOT EXISTS warranty_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warranty_id INTEGER NOT NULL REFERENCES warranties(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  original_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== COBROS (pagos de clientes a facturas) =====================
-- Una factura puede recibir varios abonos. El estado de la factura se recalcula solo:
-- pendiente (sin pagos) → parcial (pagó una parte) → pagada (saldo en cero).
CREATE TABLE IF NOT EXISTS invoice_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT, -- cheque, transferencia (ACH/wire), tarjeta, efectivo, otro
  reference TEXT, -- no. de cheque, confirmación de la transferencia…
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== RECEPCIÓN DE MERCANCÍA (contra orden de compra) =====================
-- Cada recepción registra cuánto llegó de cada línea; la orden queda "parcial" hasta que
-- se recibe todo. El inventario sube solo por lo que realmente llegó.
CREATE TABLE IF NOT EXISTS goods_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  receipt_date TEXT NOT NULL,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goods_receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id INTEGER REFERENCES purchase_order_items(id) ON DELETE SET NULL,
  product_id INTEGER REFERENCES products(id),
  description TEXT,
  quantity REAL NOT NULL
);

-- ===================== CUENTAS POR PAGAR (facturas de proveedores) =====================
CREATE TABLE IF NOT EXISTS supplier_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  bill_number TEXT, -- número de la factura del proveedor
  bill_date TEXT,
  due_date TEXT,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendiente', -- pendiente / parcial / pagada / anulada
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS supplier_bill_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES supplier_bills(id) ON DELETE CASCADE,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS supplier_bill_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL REFERENCES supplier_bills(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  original_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ===================== NÚMEROS DE SERIE POR UNIDAD =====================
-- Para productos con "Maneja seriales": cada unidad física (grúa, compresor, bucket…) es un
-- registro con su número de serie, de qué compra vino y a dónde fue (factura/cliente o
-- vehículo donde quedó instalada). serial_events guarda la historia completa.
CREATE TABLE IF NOT EXISTS product_serials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  serial TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponible', -- disponible / vendido / instalado / dado_de_baja
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  goods_receipt_id INTEGER REFERENCES goods_receipts(id) ON DELETE SET NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  received_date TEXT,
  unit_cost REAL,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  status_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, serial)
);
CREATE TABLE IF NOT EXISTS serial_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_id INTEGER NOT NULL REFERENCES product_serials(id) ON DELETE CASCADE,
  event TEXT NOT NULL, -- recibido / alta_manual / vendido / instalado / dado_de_baja / disponible
  reference TEXT,
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
