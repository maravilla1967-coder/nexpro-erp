import React, { createContext, useCallback, useContext, useState } from 'react';

// Diccionario Español -> Inglés.
// El español es el idioma "fuente": el código usa literales en español como
// clave de traducción, y t() devuelve el inglés cuando el idioma activo es 'en'.
const DICT = {
  // Navegación / shell
  Clientes: 'Customers',
  Taller: 'Shop',
  Ventas: 'Sales',
  'Inventario y Compras': 'Inventory & Purchasing',

  // Comunes / acciones
  'Cargando…': 'Loading…',
  Cancelar: 'Cancel',
  Guardar: 'Save',
  Eliminar: 'Delete',
  Editar: 'Edit',
  Agregar: 'Add',
  'Buscar…': 'Search…',
  '← Volver': '← Back',
  'Todos los estados': 'All statuses',
  'Todos los tipos': 'All types',
  '— Seleccionar —': '— Select —',
  '— Sin asignar —': '— Unassigned —',
  '— Sin tipo —': '— No type —',
  '— Sin proveedor —': '— No supplier —',

  // Campos comunes
  Nombre: 'Name',
  'Nombre *': 'Name *',
  Email: 'Email',
  Teléfono: 'Phone',
  'Teléfono:': 'Phone:',
  Dirección: 'Address',
  'Dirección:': 'Address:',
  Notas: 'Notes',
  'Notas:': 'Notes:',
  Estado: 'Status',
  'Estado:': 'Status:',
  Fecha: 'Date',
  'Fecha:': 'Date:',
  Descripción: 'Description',
  'Cant.': 'Qty.',
  'Precio unit.': 'Unit price',
  'Costo unit.': 'Unit cost',
  Subtotal: 'Subtotal',
  Tipo: 'Type',
  Cliente: 'Customer',
  'Cliente *': 'Customer *',
  'Cliente:': 'Customer:',
  Proveedor: 'Supplier',
  'Proveedor *': 'Supplier *',
  'Proveedor:': 'Supplier:',
  Contacto: 'Contact',
  Ciudad: 'City',
  'Código postal': 'ZIP code',
  'Código postal:': 'ZIP code:',
  Producto: 'Product',
  'Agregar línea': 'Add line',

  // Estados / Pill (minúsculas, con espacio en vez de guion bajo)
  lead: 'lead',
  prospecto: 'prospect',
  cliente: 'customer',
  inactivo: 'inactive',
  pendiente: 'pending',
  aprobado: 'approved',
  'en proceso': 'in progress',
  facturado: 'invoiced',
  cancelado: 'cancelled',
  pagada: 'paid',
  vencida: 'overdue',
  borrador: 'draft',
  enviada: 'sent',
  recibido: 'received',
  'en servicio': 'in service',
  completado: 'completed',
  entregado: 'delivered',
  nuevo: 'new',
  calificado: 'qualified',
  propuesta: 'proposal',
  negociacion: 'negotiation',
  ganado: 'won',
  perdido: 'lost',
  activo: 'active',

  // Dashboard
  'Resumen general de Nexpro': 'General overview of Nexpro',
  'Clientes / Leads': 'Customers / Leads',
  'leads activos': 'active leads',
  'Vehículos en taller': 'Vehicles in the shop',
  'órdenes de trabajo abiertas': 'open work orders',
  'Pedidos abiertos': 'Open sales orders',
  'Facturas pendientes': 'Pending invoices',
  facturas: 'invoices',
  'Vehículos recibidos recientemente': 'Recently received vehicles',
  'Aún no se han recibido vehículos.': 'No vehicles received yet.',
  Vehículo: 'Vehicle',
  'Tareas y seguimientos pendientes (CRM)': 'Pending tasks & follow-ups (CRM)',
  'No hay tareas pendientes.': 'No pending tasks.',
  Asunto: 'Subject',

  // Clientes (CRM)
  'Clientes (CRM)': 'Customers (CRM)',
  'Empresas, municipios y contactos': 'Companies, municipalities and contacts',
  '+ Nuevo cliente': '+ New customer',
  'Buscar por nombre, email, teléfono…': 'Search by name, email, phone…',
  Lead: 'Lead',
  Prospecto: 'Prospect',
  Inactivo: 'Inactive',
  'No hay clientes todavía. Crea el primero con "+ Nuevo cliente".':
    'No customers yet. Create the first one with "+ New customer".',
  Industria: 'Industry',
  'Nuevo cliente': 'New customer',
  'Nombre / Empresa *': 'Name / Company *',
  'Empresa / Municipio': 'Company / Municipality',
  Persona: 'Individual',
  'NIT / Identificación': 'Tax ID',
  Fuente: 'Source',
  'referido, web, llamada...': 'referral, web, call...',

  // Detalle de cliente
  'Sin industria': 'No industry',
  '¿Eliminar este cliente y todo su historial?': 'Delete this customer and all its history?',
  'Editar cliente': 'Edit customer',
  Info: 'Info',
  Contactos: 'Contacts',
  Oportunidades: 'Opportunities',
  Actividades: 'Activities',
  Vehiculos: 'Vehicles',
  'Email:': 'Email:',
  'NIT / ID:': 'Tax ID:',
  'Fuente:': 'Source:',
  '+ Agregar': '+ Add',
  'Sin contactos.': 'No contacts.',
  Cargo: 'Role',
  'Sin oportunidades.': 'No opportunities.',
  Título: 'Title',
  Valor: 'Value',
  'Prob.': 'Prob.',
  'Cierre esperado': 'Expected close',
  Etapa: 'Stage',
  'Sin actividades.': 'No activities.',
  'Vehículos de este cliente': 'Vehicles for this customer',
  'Sin vehículos recibidos.': 'No vehicles received.',
  'Nuevo contacto': 'New contact',
  'Nueva oportunidad': 'New opportunity',
  'Nueva actividad': 'New activity',
  'Título *': 'Title *',
  'Valor estimado ($)': 'Estimated value ($)',
  'Probabilidad (%)': 'Probability (%)',
  'Tipo *': 'Type *',
  'Fecha límite': 'Due date',
  'Asunto *': 'Subject *',
  Llamada: 'Call',
  Reunión: 'Meeting',
  Nota: 'Note',
  Tarea: 'Task',

  // Inventario / Productos
  Inventario: 'Inventory',
  'Productos, costos y precios de venta': 'Products, costs and selling prices',
  'Tipos de producto': 'Product types',
  '+ Nuevo producto': '+ New product',
  'Buscar por nombre o SKU…': 'Search by name or SKU…',
  'No hay productos todavía. Crea el primero con "+ Nuevo producto".':
    'No products yet. Create the first one with "+ New product".',
  'Costo+Flete': 'Cost+Freight',
  Margen: 'Margin',
  'Precio venta': 'Selling price',
  Stock: 'Stock',
  'Editar producto': 'Edit product',
  'Nuevo producto': 'New product',
  SKU: 'SKU',
  'Tipo de producto': 'Product type',
  'Foto del artículo': 'Item photo',
  'Precio de compra ($)': 'Purchase price ($)',
  'Flete ($)': 'Freight ($)',
  'Margen de ganancia (%)': 'Profit margin (%)',
  'Precio de venta = (Costo + Flete) / (1 − margen). Con 30%, equivale a Costo/.70.':
    'Selling price = (Cost + Freight) / (1 − margin). At 30%, that equals Cost/.70.',
  'Fijar precio de venta manualmente': 'Set selling price manually',
  'Cantidad en stock': 'Stock quantity',
  Unidad: 'Unit',
  'Nombre del tipo': 'Type name',
  '¿Eliminar este producto?': 'Delete this product?',
  '¿Eliminar este tipo de producto?': 'Delete this product type?',

  // Proveedores
  Proveedores: 'Suppliers',
  'Fuentes de compra para inventario': 'Purchasing sources for inventory',
  '+ Nuevo proveedor': '+ New supplier',
  'No hay proveedores todavía.': 'No suppliers yet.',
  NIT: 'Tax ID',
  'Editar proveedor': 'Edit supplier',
  'Nuevo proveedor': 'New supplier',
  '¿Eliminar este proveedor?': 'Delete this supplier?',
  Código: 'Code',
  'Código (2 letras)': 'Code (2 letters)',
  Auto: 'Auto',
  'Se usa en el número de las órdenes de compra: NX-XX-001. Si se deja vacío, se toma de las primeras letras del nombre.':
    'Used in purchase order numbers: NX-XX-001. If left blank, it is taken from the first letters of the name.',

  // Facturas
  Factura: 'Invoice',
  FACTURA: 'INVOICE',
  'Imprimir / Guardar PDF': 'Print / Save PDF',
  'Facturar a': 'Bill to',
  'NIT/ID:': 'Tax ID:',
  'Vence:': 'Due:',
  Impuesto: 'Tax',
  Facturación: 'Invoicing',
  'Facturas a clientes': 'Customer invoices',
  '+ Nueva factura': '+ New invoice',
  'No hay facturas todavía.': 'No invoices yet.',
  Número: 'Number',
  Total: 'Total',
  'Ver / Imprimir': 'View / Print',
  'Marcar pagada': 'Mark as paid',
  'Nueva factura': 'New invoice',
  'Impuesto (%)': 'Tax (%)',

  // Órdenes de compra
  'Órdenes de Compra': 'Purchase Orders',
  'Compras a proveedores': 'Purchases from suppliers',
  '+ Nueva orden de compra': '+ New purchase order',
  'No hay órdenes de compra todavía.': 'No purchase orders yet.',
  'Marcar recibida': 'Mark as received',
  'Nueva orden de compra': 'New purchase order',
  'Orden de compra': 'Purchase order',

  // Órdenes de pedido (ventas)
  'Órdenes de Pedido': 'Sales Orders',
  'Pedidos de clientes, previos a la factura': 'Customer orders, prior to invoicing',
  'Pedidos / cotizaciones de clientes, previos a la factura': 'Customer orders / quotes, prior to invoicing',
  '+ Nuevo pedido': '+ New order',
  'No hay pedidos todavía.': 'No orders yet.',
  en_proceso: 'in progress',
  Facturar: 'Invoice',
  'Generar factura a partir del pedido': 'Generate an invoice from order',
  'Nuevo pedido': 'New order',
  Pedido: 'Order',
  'Editar pedido': 'Edit order',
  Imprimir: 'Print',
  'ORDEN DE PEDIDO': 'SALES ORDER',
  'Firma del cliente — Acepta el pedido': 'Client signature — Accepts the order',
  'Los cambios se enviaron para autorización del administrador.': 'The changes were sent for administrator approval.',
  'La eliminación se envió para autorización del administrador.': 'The deletion was sent for administrator approval.',

  // Vehículos
  'Recepción de Vehículos': 'Vehicle Reception',
  'Ingreso por VIN y equipos instalados en el chasis': 'VIN intake and equipment installed on the chassis',
  '+ Recibir vehículo': '+ Receive vehicle',
  'Buscar por VIN, marca, modelo, placa…': 'Search by VIN, make, model, plate…',
  Recibido: 'Received',
  'En servicio': 'In service',
  Completado: 'Completed',
  Entregado: 'Delivered',
  'No se han recibido vehículos todavía.': 'No vehicles received yet.',
  'Recibir vehículo por VIN': 'Receive vehicle by VIN',
  'VIN *': 'VIN *',
  Marca: 'Make',
  Modelo: 'Model',
  Año: 'Year',
  'Tipo de chasis': 'Chassis type',
  Placa: 'Plate',
  'Foto del vehículo': 'Vehicle photo',
  'Recibir vehículo': 'Receive vehicle',
  'Datos del cliente': 'Customer details',
  'Imprimir recepción': 'Print reception',
  'RECEPCIÓN DE VEHÍCULO': 'VEHICLE RECEPTION',
  'Sin notas registradas.': 'No notes recorded.',
  'Aún no se ha creado una orden de trabajo para este vehículo. Este documento se puede imprimir y firmar ahora, en la recepción; el diagnóstico y el trabajo realizado se agregarán aquí una vez que se registre la orden de trabajo.':
    'No work order has been created for this vehicle yet. This document can be printed and signed now, at reception; the diagnosis and work performed will be added here once a work order is recorded.',
  'Al firmar, el cliente confirma haber entregado el vehículo con la información descrita en este documento.':
    'By signing, the client confirms having dropped off the vehicle with the information described in this document.',
  'Diagnóstico y trabajo realizado': 'Diagnosis and work performed',

  // Detalle de vehículo
  '¿Eliminar este vehículo y todo su historial?': 'Delete this vehicle and all its history?',
  'Datos del vehículo': 'Vehicle details',
  'Placa:': 'Plate:',
  'Recibido:': 'Received:',
  'Equipos instalados en el chasis': 'Equipment installed on the chassis',
  '+ Agregar equipo': '+ Add equipment',
  'Sin equipos registrados aún.': 'No equipment registered yet.',
  Serie: 'Serial',
  Fabricante: 'Manufacturer',
  Chasis: 'Chassis',
  'Órdenes de trabajo': 'Work orders',
  '+ Nueva orden de trabajo': '+ New work order',
  'Sin órdenes de trabajo todavía.': 'No work orders yet.',
  Mecánico: 'Mechanic',
  'Gestiona el detalle de horas/servicios de cada orden en':
    'Manage the hours/services detail for each order in',
  'Órdenes de Trabajo': 'Work Orders',
  'Agregar equipo instalado': 'Add installed equipment',
  'Tipo de equipo *': 'Equipment type *',
  '— Seleccionar de la lista —': '— Select from list —',
  'No está en la lista, crear uno nuevo': 'Not in the list, create a new one',
  'Nombre del nuevo tipo de equipo': 'New equipment type name',
  'Usar la lista existente': 'Use existing list',
  'Número de serie': 'Serial number',
  'Guardar equipo': 'Save equipment',
  '¿Eliminar este equipo del vehículo?': 'Delete this equipment from the vehicle?',
  'Nueva orden de trabajo': 'New work order',
  'Editar orden de trabajo': 'Edit work order',
  'Guardar cambios': 'Save changes',
  'Mecánico asignado': 'Assigned mechanic',
  'Servicios a realizar': 'Services to perform',
  Servicio: 'Service',
  Horas: 'Hours',
  '$/hora': '$/hour',
  '$ fijo': 'Flat $',
  'Por hora': 'Per hour',
  'Servicio completo': 'Full service',
  '+ Agregar servicio': '+ Add service',
  'Total estimado:': 'Estimated total:',
  'Crear orden de trabajo': 'Create work order',

  // Servicios
  'Catálogo de Servicios': 'Service Catalog',
  'Servicios del taller: por hora o por servicio completo': 'Shop services: hourly or flat-rate',
  '+ Nuevo servicio': '+ New service',
  'No hay servicios todavía.': 'No services yet.',
  Tarifa: 'Rate',
  '/hora': '/hour',
  'Editar servicio': 'Edit service',
  'Nuevo servicio': 'New service',
  'Tipo de tarifa': 'Rate type',
  'Costo por hora ($)': 'Hourly cost ($)',
  'Precio del servicio completo ($)': 'Flat service price ($)',
  Activo: 'Active',
  '¿Eliminar este servicio?': 'Delete this service?',
  'Nombre (inglés)': 'Name (English)',
  'Descripción (inglés)': 'Description (English)',
  'Se muestra cuando el idioma de la app está en inglés. Si se deja vacío, se usa el nombre en español.':
    'Shown when the app language is set to English. If left blank, the Spanish name is used instead.',

  // Mecánicos
  Mecánicos: 'Mechanics',
  'Equipo del taller': 'Shop team',
  '+ Nuevo mecánico': '+ New mechanic',
  'No hay mecánicos registrados todavía.': 'No mechanics registered yet.',
  Especialidad: 'Specialty',
  'Editar mecánico': 'Edit mechanic',
  'Nuevo mecánico': 'New mechanic',
  'Hidráulica, eléctrica, general...': 'Hydraulics, electrical, general...',
  '¿Eliminar este mecánico?': 'Delete this mechanic?',

  // Órdenes de trabajo (lista)
  'Servicios asignados a mecánicos por vehículo': 'Services assigned to mechanics by vehicle',
  Pendiente: 'Pending',
  'En proceso': 'In progress',
  Facturado: 'Invoiced',
  'No hay órdenes de trabajo todavía. Se crean desde la ficha del vehículo.':
    'No work orders yet. They are created from the vehicle record.',
  'Orden de trabajo': 'Work order',
  Documento: 'Document',
  'Facturar seleccionadas': 'Invoice selected',
  'Generando…': 'Generating…',
  'Ver factura': 'View invoice',
  '¿Generar una factura con estas órdenes de trabajo?': 'Generate an invoice with these work orders?',
  '¿Generar una factura a partir de la orden de trabajo': 'Generate an invoice from work order',
  'Las órdenes marcadas como "completado" pueden facturarse: selecciónalas con la casilla y haz clic en "Facturar seleccionadas".':
    'Orders marked "completed" can be invoiced: select them with the checkbox and click "Invoice selected".',

  // Documento de orden de trabajo (recepción de vehículo)
  'DOCUMENTO DE SERVICIO': 'SERVICE DOCUMENT',
  'No.': 'No.',
  'VIN:': 'VIN:',
  'Equipos instalados': 'Installed equipment',
  'Sin equipos registrados.': 'No equipment registered.',
  'Marca / Fabricante': 'Brand / Manufacturer',
  'Problema reportado / Síntomas': 'Reported issue / Symptoms',
  Diagnóstico: 'Diagnosis',
  'Sin diagnóstico registrado.': 'No diagnosis recorded.',
  'Solución / Reparación realizada': 'Solution / Repair performed',
  'Sin solución registrada.': 'No solution recorded.',
  'Partes reemplazadas o reparadas': 'Parts replaced or repaired',
  'No se reemplazaron ni repararon partes.': 'No parts were replaced or repaired.',
  Acción: 'Action',
  Reemplazada: 'Replaced',
  Reparada: 'Repaired',
  Garantía: 'Warranty',
  'Suministrada por el cliente': 'Client-supplied',
  'Nota (opcional)': 'Note (optional)',
  'Nota sobre la parte (ej. garantía, quién la suministró, etc.)': 'Note about the part (e.g. warranty, who supplied it, etc.)',
  'Guardar en catálogo': 'Save to catalog',
  '✓ En catálogo': '✓ In catalog',
  'Servicio guardado en el catálogo.': 'Service saved to the catalog.',
  '+ Agregar parte': '+ Add part',
  'Mano de obra y servicios': 'Labor & services',
  'Sin servicios registrados.': 'No services recorded.',
  'Mano de obra / servicios': 'Labor / services',
  'Conformidad del cliente': 'Client acknowledgment',
  'Al firmar, el cliente confirma haber recibido el vehículo y aceptar el trabajo realizado y descrito en este documento.':
    'By signing, the client confirms having received the vehicle and accepts the work performed as described in this document.',
  'Firma del cliente': "Client's signature",
  'Recibido por (técnico/asesor)': 'Received by (technician/advisor)',
  Partes: 'Parts',

  // Usuarios / permisos / aprobaciones
  Correo: 'Email',
  Contraseña: 'Password',
  'Ingresando…': 'Signing in…',
  'Iniciar sesión': 'Sign in',
  'Las contraseñas no coinciden': 'Passwords do not match',
  'La contraseña debe tener al menos 6 caracteres': 'Password must be at least 6 characters',
  'Crea tu contraseña para activar tu cuenta.': 'Create your password to activate your account.',
  'Nueva contraseña': 'New password',
  'Confirmar contraseña': 'Confirm password',
  'Guardando…': 'Saving…',
  'Activar cuenta': 'Activate account',
  Usuarios: 'Users',
  'Da acceso a tu equipo y controla qué puede editar cada uno': 'Give your team access and control what each person can edit',
  '+ Nuevo usuario': '+ New user',
  'No hay usuarios todavía.': 'No users yet.',
  Rol: 'Role',
  'Módulos con edición': 'Edit access to',
  'Todos (administrador)': 'All (administrator)',
  'Solo lectura': 'View only',
  'Reenviar invitación': 'Resend invitation',
  Activar: 'Activate',
  Desactivar: 'Deactivate',
  'Editar usuario': 'Edit user',
  'Nuevo usuario': 'New user',
  'Debe ser un correo de la empresa (@nexprotrucks.com)': 'Must be a company email (@nexprotrucks.com)',
  Usuario: 'User',
  Administrador: 'Administrator',
  'El administrador puede editar todo y aprobar los cambios de facturas y pedidos.':
    'The administrator can edit everything and approve changes to invoices and orders.',
  'Puede editar en estos módulos': 'Can edit in these modules',
  'Puede ver todos los módulos; solo podrá crear o modificar en los que marques aquí.':
    'Can view all modules; will only be able to create or modify in the ones you check here.',
  'Invitación creada': 'Invitation created',
  'Comparte este enlace con': 'Share this link with',
  'para que cree su contraseña. Vence en 7 días.': 'so they can create their password. Expires in 7 days.',
  Cerrar: 'Close',
  'Copiar enlace': 'Copy link',
  '¡Copiado!': 'Copied!',
  '¿Eliminar este usuario?': 'Delete this user?',
  admin: 'admin',
  usuario: 'user',
  invitado: 'invited',
  desactivado: 'deactivated',
  rechazado: 'rejected',

  // Aprobaciones (facturas y pedidos)
  Aprobaciones: 'Approvals',
  'Cambios en facturas y pedidos que esperan tu autorización': 'Changes to invoices and orders waiting for your approval',
  'Tus solicitudes de cambio enviadas para autorización': 'Your change requests sent for approval',
  Pendientes: 'Pending',
  Aprobadas: 'Approved',
  Rechazadas: 'Rejected',
  Todas: 'All',
  'No hay solicitudes aquí.': 'No requests here.',
  Detalle: 'Detail',
  'Solicitado por': 'Requested by',
  'Motivo del rechazo (opcional):': 'Reason for rejection (optional):',
  Aprobar: 'Approve',
  Rechazar: 'Reject',

  // Menú de cuenta
  Administración: 'Administration',
  'Cambiar contraseña': 'Change password',
  'Cerrar sesión': 'Log out',
  'Contraseña actual': 'Current password',
  'Contraseña actualizada.': 'Password updated.',

  // Toggle de idioma
  ES: 'ES',
  EN: 'EN',
};

const LanguageContext = createContext(null);

function readStoredLang() {
  try {
    const stored = localStorage.getItem('nexpro_lang');
    return stored === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readStoredLang);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'es' ? 'en' : 'es';
      try {
        localStorage.setItem('nexpro_lang', next);
      } catch {
        /* ignore storage errors (private mode, etc.) */
      }
      return next;
    });
  }, []);

  const t = useCallback(
    (str) => {
      if (lang === 'en') return DICT[str] !== undefined ? DICT[str] : str;
      return str;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useI18n debe usarse dentro de <LanguageProvider>');
  return ctx;
}

// Para datos bilingües guardados por el usuario (p. ej. nombre/descripción de un
// servicio): devuelve la versión en inglés si el idioma activo es 'en' y existe
// una traducción guardada; si no, siempre cae de vuelta al texto en español.
export function pickLang(es, en, lang) {
  if (lang === 'en' && en) return en;
  return es;
}
