// Manual de usuario del ERP de Nexpro, en español e inglés. Cada sección explica un módulo:
// para qué sirve, cómo hacer las tareas paso a paso, consejos y problemas frecuentes.
// `routes` enlaza la sección con las pantallas: el botón "? Ayuda" de cada pantalla abre la
// sección que corresponde. Al cambiar algo en el ERP, actualizar aquí también.

const L = (es, en) => ({ es, en });

export const MANUAL = [
  {
    id: 'inicio', icon: '🚀', routes: [],
    title: L('Primeros pasos', 'Getting started'),
    summary: L(
      'Cómo entrar al ERP, moverse por el menú, cambiar el idioma y lo que conviene saber antes de empezar.',
      'How to sign in, move around the menu, change the language, and what to know before you start.'),
    tasks: [
      { title: L('Entrar al ERP', 'Sign in'), steps: [
        L('Abre el enlace del ERP en Chrome o Safari.', 'Open the ERP link in Chrome or Safari.'),
        L('Escribe tu correo de la empresa (@nexprotrucks.com) y tu contraseña.', 'Enter your company email (@nexprotrucks.com) and your password.'),
        L('Si eres nuevo, el administrador te envía un enlace de invitación para crear tu contraseña (vence en 7 días).', 'If you are new, the administrator sends you an invitation link to create your password (it expires in 7 days).'),
      ] },
      { title: L('Moverse por el ERP', 'Moving around'), steps: [
        L('El menú de la izquierda está agrupado: CRM, Taller, Ventas, Inventario y Compras, Administración.', 'The left menu is grouped: CRM, Shop, Sales, Inventory & Purchasing, Administration.'),
        L('El botón ES / EN arriba del menú cambia el idioma de toda la aplicación.', 'The ES / EN button above the menu switches the language of the whole app.'),
        L('En cada pantalla, el botón "? Ayuda" (abajo a la derecha) abre la parte de este manual que explica esa pantalla.', 'On every screen, the "? Help" button (bottom right) opens the part of this manual that explains that screen.'),
      ] },
      { title: L('Listados: buscar, exportar e imprimir', 'Lists: search, export and print'), steps: [
        L('En los listados puedes filtrar por número (desde / hasta) y por fecha.', 'In lists you can filter by number (from / to) and by date.'),
        L('Marca casillas para elegir solo algunas filas; si no marcas ninguna se usan todas las visibles.', 'Tick boxes to pick only some rows; if none are ticked, all visible rows are used.'),
        L('"Excel" y "CSV" descargan el listado; "Imprimir listado" lo imprime o lo guarda en PDF.', '"Excel" and "CSV" download the list; "Print list" prints it or saves it as PDF.'),
      ] },
    ],
    tips: [
      L('Todos los documentos (factura, orden de compra, recepción, comprobantes) tienen "Imprimir / Guardar PDF": en la ventana de impresión elige "Guardar como PDF".', 'Every document (invoice, purchase order, intake, vouchers) has "Print / Save PDF": in the print window choose "Save as PDF".'),
      L('Si no tienes permiso de edición en un módulo, lo puedes ver pero no modificar. Pídelo al administrador.', 'If you do not have edit permission for a module, you can view it but not change it. Ask the administrator.'),
    ],
    problems: [
      { q: L('No veo un cambio que se acaba de publicar', 'I do not see a change that was just published'), a: L('Refresca la página (Cmd + R en Mac). Si sigue igual, cierra la pestaña y vuelve a abrir el ERP.', 'Refresh the page (Cmd + R on Mac). If it is still the same, close the tab and open the ERP again.') },
      { q: L('No veo el botón Guardar en una ventana', 'I cannot see the Save button in a window'), a: L('Los botones Guardar / Cancelar quedan fijos abajo de cada ventana; desplázate dentro de la ventana. Si la pantalla es pequeña, reduce el zoom del navegador (Cmd + -).', 'The Save / Cancel buttons stay fixed at the bottom of each window; scroll inside the window. On a small screen, zoom out the browser (Cmd + -).') },
      { q: L('Me salió un mensaje en rojo', 'I got a red message'), a: L('Los mensajes en rojo explican qué falta o qué está mal (por ejemplo, un campo obligatorio). Corrige lo que dice y vuelve a guardar.', 'Red messages explain what is missing or wrong (for example, a required field). Fix what it says and save again.') },
    ],
  },
  {
    id: 'dashboard', icon: '📊', routes: ['/'],
    title: L('Dashboard', 'Dashboard'),
    summary: L('Resumen del día: vehículos en el taller, órdenes de trabajo abiertas, pedidos abiertos, facturas pendientes y tareas del CRM.', 'Daily summary: vehicles in the shop, open work orders, open sales orders, pending invoices and CRM tasks.'),
    tasks: [
      { title: L('Usar el resumen', 'Using the summary'), steps: [
        L('Revisa las tarjetas de arriba para ver cuántos vehículos, órdenes y facturas hay abiertos.', 'Check the cards at the top to see how many vehicles, orders and invoices are open.'),
        L('En "Tareas y seguimientos pendientes" están las actividades del CRM por hacer.', '"Pending tasks and follow-ups" lists the CRM activities to do.'),
        L('Haz clic en un vehículo reciente para abrir su ficha.', 'Click a recent vehicle to open its record.'),
      ] },
    ],
  },
  {
    id: 'clientes', icon: '🤝', routes: ['/clientes'],
    title: L('Clientes (CRM)', 'Customers (CRM)'),
    summary: L('Empresas, municipios y personas: sus datos, contactos, oportunidades de venta, actividades (llamadas, visitas, correos) y los vehículos que han traído.', 'Companies, municipalities and people: their details, contacts, sales opportunities, activities (calls, visits, emails) and the vehicles they have brought in.'),
    tasks: [
      { title: L('Crear un cliente', 'Create a customer'), steps: [
        L('Clientes → "+ Nuevo cliente".', 'Customers → "+ New customer".'),
        L('Elige si es Empresa / Municipio o Persona y escribe el nombre (obligatorio).', 'Choose Company / Municipality or Person and enter the name (required).'),
        L('Llena NIT/ID, email, teléfono, dirección, industria y la fuente (referido, web, llamada…).', 'Fill in tax ID, email, phone, address, industry and the source (referral, web, call…).'),
        L('Estado: Lead (contacto nuevo), Prospecto (interesado), Cliente (ya compró) o Inactivo. Guarda.', 'Status: Lead (new contact), Prospect (interested), Customer (has bought) or Inactive. Save.'),
      ] },
      { title: L('Registrar contactos, oportunidades y actividades', 'Add contacts, opportunities and activities'), steps: [
        L('Abre el cliente y usa las pestañas Contactos, Oportunidades y Actividades.', 'Open the customer and use the Contacts, Opportunities and Activities tabs.'),
        L('Actividad: elige el tipo (llamada, visita, correo, tarea), el asunto y la fecha; las pendientes aparecen en el Dashboard.', 'Activity: choose the type (call, visit, email, task), subject and date; pending ones show on the Dashboard.'),
        L('La pestaña Vehículos muestra los camiones de ese cliente recibidos en el taller.', 'The Vehicles tab shows that customer\'s trucks received in the shop.'),
      ] },
    ],
    problems: [
      { q: L('El vehículo no aparece en la pestaña Vehículos del cliente', 'The vehicle does not appear in the customer\'s Vehicles tab'), a: L('El vehículo se recibió sin cliente. Abre el vehículo → "Editar recepción" y escribe o elige el cliente.', 'The vehicle was received without a customer. Open the vehicle → "Edit intake" and type or pick the customer.') },
    ],
  },
  {
    id: 'vehiculos', icon: '🚚', routes: ['/vehiculos'],
    title: L('Recepción de vehículos', 'Vehicle intake'),
    summary: L('Registrar cada camión que llega por su VIN, con el equipo instalado (grúa, compresor, bucket…), el cliente y la foto; desde aquí se crean las órdenes de trabajo.', 'Register each truck that arrives by its VIN, with the installed equipment (crane, compressor, bucket…), the customer and a photo; work orders are created from here.'),
    tasks: [
      { title: L('Recibir un vehículo', 'Receive a vehicle'), steps: [
        L('Recepción de Vehículos → "+ Recibir vehículo".', 'Vehicle Intake → "+ Receive vehicle".'),
        L('Escribe el VIN (obligatorio y único). Marca, modelo, año, chasis y placa se pueden completar después.', 'Enter the VIN (required and unique). Make, model, year, chassis and plate can be completed later.'),
        L('Cliente: escríbelo o elígelo de la lista. Si no existe, se crea solo en Clientes al guardar.', 'Customer: type it or pick it from the list. If it does not exist, it is created in Customers when you save.'),
        L('Opcional: agrega foto, notas y una orden de trabajo inicial con mecánico y servicios. Guarda.', 'Optional: add a photo, notes and an initial work order with mechanic and services. Save.'),
      ] },
      { title: L('Editar la recepción (completar datos después)', 'Edit the intake (complete details later)'), steps: [
        L('Abre el vehículo → "✏️ Editar recepción".', 'Open the vehicle → "✏️ Edit intake".'),
        L('Corrige o completa VIN, marca, modelo, año, chasis, placa, cliente, estado, fecha, foto y notas. Guarda.', 'Fix or complete VIN, make, model, year, chassis, plate, customer, status, date, photo and notes. Save.'),
      ] },
      { title: L('Equipo instalado en el chasis', 'Equipment installed on the chassis'), steps: [
        L('En la ficha del vehículo → "+ Agregar equipo".', 'On the vehicle record → "+ Add equipment".'),
        L('Tipo de equipo: escríbelo o elígelo. Si es nuevo, se agrega solo a la lista de equipos.', 'Equipment type: type it or pick it. If it is new, it is added to the equipment list automatically.'),
        L('Agrega número de serie, fabricante y modelo. Cada equipo tiene "Editar" y "Eliminar".', 'Add serial number, manufacturer and model. Each item has "Edit" and "Delete".'),
        L('"Lista de equipos" permite agregar, renombrar o borrar (si no está en uso) los tipos de equipo.', '"Equipment list" lets you add, rename or delete (if unused) equipment types.'),
      ] },
      { title: L('Imprimir la recepción y otras acciones', 'Print the intake and other actions'), steps: [
        L('"Imprimir recepción" genera el documento de entrada del vehículo para firmar.', '"Print intake" generates the vehicle check-in document to sign.'),
        L('"Reclamar garantía" abre una garantía ya llena con el VIN del vehículo.', '"Claim warranty" opens a warranty pre-filled with the vehicle\'s VIN.'),
        L('"+ Pago sin factura" registra el pago a un tercero que trabajó en el vehículo.', '"+ Payment w/o invoice" records a payment to a third party who worked on the vehicle.'),
      ] },
    ],
    problems: [
      { q: L('Dice que ya existe un vehículo con ese VIN', 'It says a vehicle with that VIN already exists'), a: L('Ese camión ya fue recibido. Búscalo en la lista por el VIN y ábrelo; no hace falta recibirlo de nuevo.', 'That truck was already received. Find it in the list by VIN and open it; no need to receive it again.') },
    ],
  },
  {
    id: 'ordenes-trabajo', icon: '🔧', routes: ['/ordenes-trabajo'],
    title: L('Órdenes de trabajo', 'Work orders'),
    summary: L('El trabajo que se le hace a un vehículo: mecánico, diagnóstico, servicios (por hora o completos), partes y la solución. Las completadas se facturan.', 'The work done on a vehicle: mechanic, diagnosis, services (hourly or flat), parts and the resolution. Completed ones are invoiced.'),
    tasks: [
      { title: L('Crear una orden de trabajo', 'Create a work order'), steps: [
        L('Abre el vehículo → "+ Nueva orden de trabajo" (las órdenes siempre se crean desde el vehículo).', 'Open the vehicle → "+ New work order" (orders are always created from the vehicle).'),
        L('Elige el mecánico y agrega servicios del catálogo o escritos a mano (por hora: horas × tarifa; completo: precio fijo).', 'Pick the mechanic and add services from the catalog or typed in (hourly: hours × rate; flat: fixed price).'),
        L('Agrega las partes: reemplazadas, reparadas o suministradas por el cliente, con cantidad y costo.', 'Add the parts: replaced, repaired or supplied by the customer, with quantity and cost.'),
        L('Escribe el problema reportado, el diagnóstico y la solución. Guarda.', 'Write the reported problem, diagnosis and resolution. Save.'),
      ] },
      { title: L('Avanzar y facturar', 'Move forward and invoice'), steps: [
        L('Cambia el estado: Pendiente → En proceso → Completado.', 'Change the status: Pending → In progress → Completed.'),
        L('Para facturar: en la ficha del vehículo marca las órdenes completadas y pulsa "Facturar seleccionadas" (o "Facturar" en la lista de órdenes).', 'To invoice: on the vehicle record tick the completed orders and press "Invoice selected" (or "Invoice" in the orders list).'),
        L('"Documento" imprime la orden de trabajo.', '"Document" prints the work order.'),
      ] },
    ],
  },
  {
    id: 'servicios', icon: '📋', routes: ['/servicios'],
    title: L('Catálogo de servicios', 'Service catalog'),
    summary: L('Lista de servicios del taller con su tarifa, para usarlos rápido en las órdenes de trabajo.', 'List of shop services with their rate, to use them quickly in work orders.'),
    tasks: [
      { title: L('Crear un servicio', 'Create a service'), steps: [
        L('Catálogo de Servicios → "+ Nuevo servicio".', 'Service Catalog → "+ New service".'),
        L('Nombre (y nombre en inglés si quieres), tipo de tarifa: por hora (costo por hora) o servicio completo (precio fijo). Guarda.', 'Name (and English name if you want), rate type: hourly (cost per hour) or flat (fixed price). Save.'),
        L('En una orden de trabajo puedes usar "Guardar en catálogo" para agregar un servicio escrito a mano.', 'In a work order you can use "Save to catalog" to add a typed-in service.'),
      ] },
    ],
  },
  {
    id: 'mecanicos', icon: '👷', routes: ['/mecanicos'],
    title: L('Mecánicos', 'Mechanics'),
    summary: L('El equipo del taller: nombre, especialidad y contacto. Se asignan a las órdenes de trabajo.', 'The shop team: name, specialty and contact. They are assigned to work orders.'),
    tasks: [
      { title: L('Agregar un mecánico', 'Add a mechanic'), steps: [
        L('Mecánicos → "+ Nuevo mecánico", escribe nombre, especialidad (hidráulica, eléctrica…), teléfono y email. Guarda.', 'Mechanics → "+ New mechanic", enter name, specialty (hydraulics, electrical…), phone and email. Save.'),
        L('Si alguien deja de trabajar, desmárcalo como Activo en lugar de borrarlo, para conservar su historial.', 'If someone leaves, untick Active instead of deleting them, to keep their history.'),
      ] },
    ],
  },
  {
    id: 'garantias', icon: '🛡️', routes: ['/garantias'],
    title: L('Garantías', 'Warranties'),
    summary: L('Dos tipos: Reclamos al fabricante (algo falló) y Registros de garantía (constancia de la garantía de un equipo comprado, con sus documentos).', 'Two kinds: Claims to the manufacturer (something failed) and Warranty registrations (record of a purchased equipment\'s warranty, with its documents).'),
    tasks: [
      { title: L('Reclamar una garantía', 'File a warranty claim'), steps: [
        L('Desde el vehículo ("Reclamar garantía"), desde un número de serie, o en Garantías → nuevo reclamo.', 'From the vehicle ("Claim warranty"), from a serial number, or in Warranties → new claim.'),
        L('Completa VIN o serial, modelo, año, fecha de compra (nada es obligatorio), el problema y el responsable.', 'Complete VIN or serial, model, year, purchase date (nothing is required), the problem and the person responsible.'),
        L('Actualiza el estado: abierta → enviada → aprobada / rechazada → cerrada, y el monto aprobado.', 'Update the status: open → sent → approved / rejected → closed, and the approved amount.'),
      ] },
      { title: L('Registrar la garantía de un equipo comprado', 'Register a purchased equipment\'s warranty'), steps: [
        L('Desde la orden de compra ("Registrar garantía") o Garantías → nuevo registro.', 'From the purchase order ("Register warranty") or Warranties → new registration.'),
        L('Llena equipo, serial, fechas de inicio y fin de garantía, y adjunta los documentos que la respaldan.', 'Fill in equipment, serial, warranty start and end dates, and attach the supporting documents.'),
      ] },
    ],
  },
  {
    id: 'pedidos', icon: '🧾', routes: ['/pedidos'],
    title: L('Órdenes de pedido', 'Sales orders'),
    summary: L('Pedidos o cotizaciones de clientes antes de facturar. Un pedido aprobado se convierte en factura.', 'Customer orders or quotes before invoicing. An approved order is turned into an invoice.'),
    tasks: [
      { title: L('Crear y facturar un pedido', 'Create and invoice an order'), steps: [
        L('Órdenes de Pedido → "+ Nuevo pedido", elige el cliente y agrega las líneas (producto del inventario o descripción libre, cantidad y precio).', 'Sales Orders → "+ New order", pick the customer and add the lines (inventory product or free text, quantity and price).'),
        L('Estados: pendiente → aprobado → en proceso. "Imprimir" genera la cotización.', 'Statuses: pending → approved → in progress. "Print" generates the quote.'),
        L('"Facturar" crea la factura con las líneas del pedido.', '"Invoice" creates the invoice with the order\'s lines.'),
      ] },
    ],
    tips: [L('Si no eres administrador, los cambios a un pedido ya creado quedan esperando aprobación (ver Aprobaciones).', 'If you are not an administrator, changes to an existing order wait for approval (see Approvals).')],
  },
  {
    id: 'facturas', icon: '💵', routes: ['/facturas'],
    title: L('Facturación y pagos de clientes', 'Invoicing and customer payments'),
    summary: L('Facturas a clientes (NX-INV-…): se crean desde órdenes de trabajo, pedidos o a mano. Aquí se registran los pagos, el recargo por tarjeta, la comisión de Square y los comprobantes.', 'Customer invoices (NX-INV-…): created from work orders, sales orders or by hand. Payments, card surcharge, Square fee and proofs are recorded here.'),
    tasks: [
      { title: L('Crear una factura', 'Create an invoice'), steps: [
        L('Lo normal: desde el vehículo ("Facturar seleccionadas") o desde un pedido ("Facturar").', 'Usually: from the vehicle ("Invoice selected") or from a sales order ("Invoice").'),
        L('A mano: Facturación → "+ Nueva factura", elige cliente, agrega líneas y el impuesto (%). Guarda.', 'By hand: Invoicing → "+ New invoice", pick the customer, add lines and tax (%). Save.'),
        L('"Ver / Imprimir" muestra la factura con el logo de Nexpro para imprimir o guardar en PDF.', '"View / Print" shows the invoice with the Nexpro logo to print or save as PDF.'),
      ] },
      { title: L('Registrar un pago del cliente', 'Record a customer payment'), steps: [
        L('Abre la factura (o en Cartera) → "Registrar pago".', 'Open the invoice (or in Receivables) → "Record payment".'),
        L('Fecha, monto abonado a la factura, forma de pago (cheque, transferencia, ACH, tarjeta / Square, efectivo) y referencia.', 'Date, amount applied to the invoice, method (check, transfer, ACH, card / Square, cash) and reference.'),
        L('Pago con tarjeta: botón "3%" para el recargo al cliente (no reduce el saldo) y botón "Square 3.5% + $0.15" para la comisión que nos cobran. Se ve el neto que llega al banco.', 'Card payment: "3%" button for the customer surcharge (does not reduce the balance) and "Square 3.5% + $0.15" button for the fee we are charged. The net reaching the bank is shown.'),
        L('Adjunta el comprobante (recibo de Square, transferencia, cheque) y pulsa "Registrar pago".', 'Attach the proof (Square receipt, transfer, check) and press "Record payment".'),
      ] },
      { title: L('Corregir un pago o sus comprobantes', 'Fix a payment or its proofs'), steps: [
        L('En la tabla de pagos de la factura: "Editar" cambia los datos; la ✕ junto a "Comprobante de pago" lo quita (pide confirmar en la misma pantalla).', 'In the invoice\'s payments table: "Edit" changes the details; the ✕ next to "Payment record" removes it (asks to confirm on screen).'),
        L('"+ comprobante" agrega otro documento a un pago ya registrado.', '"+ proof" adds another document to an existing payment.'),
        L('Solo el administrador puede editar o borrar pagos y borrar facturas.', 'Only the administrator can edit or delete payments and delete invoices.'),
      ] },
    ],
    problems: [
      { q: L('No aparece el botón "Registrar pago"', 'The "Record payment" button does not appear'), a: L('La factura ya está pagada (saldo $0). Para agregar documentos usa "+ comprobante" o "Editar" en el pago.', 'The invoice is already paid ($0 balance). To add documents use "+ proof" or "Edit" on the payment.') },
      { q: L('Adjunto el archivo y no se guarda (Safari)', 'I attach the file and it does not save (Safari)'), a: L('Después de elegir el archivo debe decir "✓ 1 archivo(s) listo(s)". Si no, guarda el archivo primero en el Escritorio (no en iCloud) y vuelve a elegirlo. El pago siempre se guarda aunque el archivo falle.', 'After choosing the file it must say "✓ 1 file(s) ready". If not, save the file to the Desktop first (not iCloud) and pick it again. The payment always saves even if the file fails.') },
    ],
  },
  {
    id: 'cartera', icon: '📒', routes: ['/cartera'],
    title: L('Cartera (cuentas por cobrar)', 'Receivables'),
    summary: L('Quién nos debe, cuánto y desde cuándo, por antigüedad (corriente, 1–30, 31–60, 61–90, más de 90 días).', 'Who owes us, how much and since when, by age (current, 1–30, 31–60, 61–90, over 90 days).'),
    tasks: [
      { title: L('Revisar la cartera y cobrar', 'Review receivables and collect'), steps: [
        L('Las tarjetas de arriba suman lo que se debe por rango; haz clic en una para filtrar.', 'The cards at the top add up what is owed per range; click one to filter.'),
        L('"Por cliente" muestra el total de cada cliente; haz clic para ver solo sus facturas (estado de cuenta).', '"By customer" shows each customer\'s total; click to see only their invoices (statement).'),
        L('La casilla "Incluir facturas pagadas" muestra también las ya pagadas.', 'The "Include paid invoices" box also shows paid ones.'),
        L('"Registrar pago" en cada fila; "Imprimir listado" saca el estado de cuenta.', '"Record payment" on each row; "Print list" produces the statement.'),
      ] },
    ],
    tips: [L('Si una factura no tiene fecha de vencimiento, se calcula con los "días de crédito" de arriba.', 'If an invoice has no due date, it is calculated with the "credit days" at the top.')],
  },
  {
    id: 'inventario', icon: '📦', routes: ['/inventario', '/productos'],
    title: L('Inventario y productos', 'Inventory and products'),
    summary: L('Productos con costo, flete, margen y precio de venta, stock y, si aplica, números de serie por unidad.', 'Products with cost, freight, margin and selling price, stock and, when applicable, serial numbers per unit.'),
    tasks: [
      { title: L('Crear un producto', 'Create a product'), steps: [
        L('Inventario → "Nuevo producto". Nombre (obligatorio), SKU, tipo, proveedor, foto.', 'Inventory → "New product". Name (required), SKU, type, supplier, photo.'),
        L('Costo de compra + flete + margen % = precio de venta (se calcula solo; puedes fijarlo a mano).', 'Purchase cost + freight + margin % = selling price (calculated automatically; you can set it by hand).'),
        L('Stock y unidad. Si cada unidad tiene serial (grúas, compresores, buckets…), marca "Maneja números de serie" y escribe los seriales de las unidades que ya tienes, uno por línea.', 'Stock and unit. If each unit has a serial (cranes, compressors, buckets…), tick "Tracks serial numbers" and enter the serials of the units you already have, one per line.'),
      ] },
      { title: L('Cómo sube y baja el stock', 'How stock goes up and down'), steps: [
        L('Sube al recibir una orden de compra (solo por lo que llegó).', 'It goes up when receiving a purchase order (only what arrived).'),
        L('Los productos con serial muestran cuántos seriales hay disponibles; el enlace abre Números de serie.', 'Serialized products show how many serials are available; the link opens Serial numbers.'),
      ] },
    ],
  },
  {
    id: 'proveedores', icon: '🏭', routes: ['/proveedores'],
    title: L('Proveedores', 'Suppliers'),
    summary: L('Datos de cada proveedor y sus condiciones de pago, que se usan para las cuentas por pagar.', 'Each supplier\'s details and payment terms, used for payables.'),
    tasks: [
      { title: L('Crear o editar un proveedor', 'Create or edit a supplier'), steps: [
        L('Proveedores → "+ Nuevo proveedor": nombre, código corto (opcional), NIT, contacto y dirección.', 'Suppliers → "+ New supplier": name, short code (optional), tax ID, contact and address.'),
        L('Condiciones de pago: Contado / prepago o Crédito 15, 30, 45, 60 o 90 días. Sin definir = 30 días.', 'Payment terms: Cash / prepaid or Credit 15, 30, 45, 60 or 90 days. Not set = 30 days.'),
      ] },
    ],
  },
  {
    id: 'compras', icon: '🛒', routes: ['/compras'],
    title: L('Órdenes de compra', 'Purchase orders'),
    summary: L('Todo el ciclo de compra enlazado: orden → envío al proveedor → recepción (entra al inventario, con seriales) → cuenta por pagar → pago, incluyendo faltantes.', 'The whole purchasing cycle linked: order → sent to supplier → receipt (goes into inventory, with serials) → payable → payment, including shortages.'),
    tasks: [
      { title: L('Crear una orden de compra', 'Create a purchase order'), steps: [
        L('Órdenes de Compra → "+ Nueva orden de compra". El número es el consecutivo de la empresa.', 'Purchase Orders → "+ New purchase order". The number is the company\'s next consecutive.'),
        L('Proveedor, fecha y condiciones de pago (por defecto las del proveedor).', 'Supplier, date and payment terms (by default the supplier\'s).'),
        L('Líneas: producto del inventario o descripción libre, cantidad y costo unitario.', 'Lines: inventory product or free text, quantity and unit cost.'),
        L('Comentarios e instrucciones para el proveedor (entrega, especificaciones…): salen en la orden impresa.', 'Comments and instructions for the supplier (delivery, specs…): shown on the printed order.'),
        L('Guarda; después puedes adjuntar la cotización del proveedor con "+ Adjuntar archivo".', 'Save; then you can attach the supplier\'s quote with "+ Attach file".'),
      ] },
      { title: L('Enviar y recibir la mercancía', 'Send and receive the goods'), steps: [
        L('"Imprimir" genera la orden para enviarla; luego "Marcar enviada".', '"Print" generates the order to send it; then "Mark sent".'),
        L('Cuando llega: "Recibir". Por cada línea escribe cuánto llegó.', 'When it arrives: "Receive". For each line enter how much arrived.'),
        L('Cada línea pregunta "¿Tiene número de serie?". Si sí, escribe un serial por unidad (sirve un lector de código de barras) y sigue con las demás.', 'Each line asks "Does it have a serial number?". If yes, enter one serial per unit (a barcode scanner works) and continue with the rest.'),
        L('Cuenta por pagar: "A crédito" (vence según el proveedor), "Ya está pagada" (registra el pago) o "No crear ahora". Puedes poner el número de factura del proveedor.', 'Payable: "On credit" (due per supplier terms), "Already paid" (records the payment) or "Do not create now". You can enter the supplier invoice number.'),
        L('"Registrar recepción": el inventario sube y queda el número de recepción NX-GR-….', '"Register receipt": inventory goes up and the receipt number NX-GR-… is recorded.'),
      ] },
      { title: L('Faltantes', 'Shortages'), steps: [
        L('Si no llegó todo, la orden queda "parcial" y luego se usa "Recibir resto".', 'If not everything arrived, the order stays "partial" and later you use "Receive rest".'),
        L('Si lo que falta ya no va a llegar: marca "cerrar faltante" al recibir, o en la orden "Cerrar faltante", con el motivo. La orden queda "cerrada".', 'If the missing items will not arrive: tick "close shortage" when receiving, or on the order "Close shortage", with the reason. The order becomes "closed".'),
        L('"Reabrir faltante" la devuelve a pendiente si al final sí llega.', '"Reopen shortage" returns it to pending if it does arrive after all.'),
      ] },
      { title: L('Buscar una orden y ver su historial', 'Find an order and see its history'), steps: [
        L('La casilla de búsqueda encuentra por número, proveedor, producto, SKU, serial, comentario, factura del proveedor o monto. Puedes filtrar por proveedor y estado.', 'The search box finds by number, supplier, product, SKU, serial, comment, supplier invoice or amount. You can filter by supplier and status.'),
        L('Clic en el número abre la orden: resumen Pedido · Recibido · Pendiente · Faltante · Facturado · Pagado, las recepciones y las cuentas por pagar.', 'Clicking the number opens the order: summary Ordered · Received · Pending · Shortage · Billed · Paid, the receipts and the payables.'),
      ] },
    ],
    problems: [
      { q: L('No puedo cambiar las líneas de una orden', 'I cannot change an order\'s lines'), a: L('Ya tiene mercancía recibida (ya entró al inventario). Puedes cambiar fecha, comentarios, condiciones y adjuntos; las líneas quedan bloqueadas.', 'It already has goods received (they are in inventory). You can change date, comments, terms and attachments; lines are locked.') },
      { q: L('No me deja registrar la recepción', 'It will not let me register the receipt'), a: L('Lee el mensaje rojo: falta responder "¿Tiene número de serie?" en alguna línea, o faltan seriales (debe haber uno por unidad).', 'Read the red message: a line is missing the "Does it have a serial number?" answer, or serials are missing (one per unit).') },
      { q: L('Aparece "Recibido sin factura del proveedor"', '"Received without a supplier invoice" appears'), a: L('Se recibió mercancía sin crear la cuenta por pagar. Usa "Registrar la factura" en ese aviso.', 'Goods were received without creating the payable. Use "Register the invoice" in that notice.') },
    ],
  },
  {
    id: 'cuentas-por-pagar', icon: '🧾', routes: ['/cuentas-por-pagar'],
    title: L('Cuentas por pagar', 'Accounts payable'),
    summary: L('Lo que le debemos a los proveedores, por antigüedad. Se crean al recibir órdenes de compra, desde Pagos sin factura, o a mano.', 'What we owe suppliers, by age. Created when receiving purchase orders, from Payments without invoice, or by hand.'),
    tasks: [
      { title: L('Registrar y pagar una factura de proveedor', 'Record and pay a supplier invoice'), steps: [
        L('Normalmente se crea sola al recibir la orden. A mano: "+ Factura de proveedor" con proveedor, número de factura, fechas y monto (y la orden de compra si aplica).', 'Usually created automatically when receiving the order. By hand: "+ Supplier invoice" with supplier, invoice number, dates and amount (and the purchase order if any).'),
        L('"Registrar pago": fecha, monto, forma de pago, referencia y comprobante adjunto.', '"Record payment": date, amount, method, reference and attached proof.'),
        L('La columna de orden muestra la OC y la recepción (NX-GR-…) o el enlace al comprobante sin factura.', 'The order column shows the PO and receipt (NX-GR-…) or the link to the no-invoice voucher.'),
        L('"Mostrar pagadas y anuladas" muestra el historial completo.', '"Show paid and voided" shows the full history.'),
      ] },
    ],
  },
  {
    id: 'pagos-sin-factura', icon: '🧰', routes: ['/pagos-sin-factura'],
    title: L('Pagos sin factura', 'Payments without invoice'),
    summary: L('Comprobante (NX-PS-…) para pagarle a un proveedor de servicios que no expide factura (soldador, pintor, técnico), enlazado al vehículo y a la orden de trabajo.', 'Voucher (NX-PS-…) to pay a service provider who does not issue invoices (welder, painter, technician), linked to the vehicle and work order.'),
    tasks: [
      { title: L('Crear un comprobante', 'Create a voucher'), steps: [
        L('Pagos sin factura → "+ Nuevo comprobante", o desde el vehículo / la orden de trabajo ("Pago sin factura").', 'Payments without invoice → "+ New voucher", or from the vehicle / work order ("Payment w/o invoice").'),
        L('Quién hizo el trabajo: proveedor registrado o persona nueva (se guarda en Proveedores).', 'Who did the work: registered supplier or a new person (saved in Suppliers).'),
        L('Qué se hizo: fecha, tipo de servicio, vehículo, orden de trabajo y descripción.', 'What was done: date, service type, vehicle, work order and description.'),
        L('Pago: si aún no se paga, deja "No todavía — guardar y pagar después". Solo es obligatorio saber a quién se le paga.', 'Payment: if not paid yet, leave "Not yet — save and pay later". Only who is being paid is required.'),
      ] },
      { title: L('Completar y pagar después', 'Complete and pay later'), steps: [
        L('El comprobante dice "Borrador — falta…" hasta que tenga monto y descripción: complétalo con "✏️ Editar".', 'The voucher shows "Draft — missing…" until it has amount and description: complete it with "✏️ Edit".'),
        L('"💵 Registrar pago" (en el comprobante) registra el pago total o parcial con su soporte.', '"💵 Record payment" (on the voucher) records full or partial payment with its proof.'),
        L('Imprime el comprobante para que el proveedor firme que recibió el pago.', 'Print the voucher so the provider signs that they received the payment.'),
      ] },
    ],
  },
  {
    id: 'seriales', icon: '🔢', routes: ['/seriales'],
    title: L('Números de serie', 'Serial numbers'),
    summary: L('La historia de cada unidad con serial: de qué compra vino, a qué cliente se vendió o en qué camión quedó instalada, y sus garantías.', 'The history of each serialized unit: which purchase it came from, which customer it was sold to or which truck it was installed on, and its warranties.'),
    tasks: [
      { title: L('Consultar y mover un serial', 'Look up and move a serial'), steps: [
        L('Busca por serial, producto o SKU, o filtra por producto y estado.', 'Search by serial, product or SKU, or filter by product and status.'),
        L('Abre un serial para ver su historia; cámbialo a vendido (factura / cliente), instalado (vehículo), dado de baja o de vuelta a disponible.', 'Open a serial to see its history; change it to sold (invoice / customer), installed (vehicle), written off or back to available.'),
        L('En la factura también se pueden asignar seriales vendidos.', 'Sold serials can also be assigned on the invoice.'),
      ] },
      { title: L('Agregar seriales sin orden de compra', 'Add serials without a purchase order'), steps: [
        L('"+ Agregar seriales" para unidades que ya estaban en inventario o llegaron sin OC. Lo normal es capturarlos al recibir la orden.', '"+ Add serials" for units already in stock or that arrived without a PO. Normally they are captured when receiving the order.'),
      ] },
    ],
  },
  {
    id: 'finanzas', icon: '🏦', routes: ['/finanzas'],
    title: L('Bancos y finanzas', 'Banks and finance'),
    summary: L('Saldo de cada cuenta bancaria y todos sus movimientos, como una chequera (estilo Microsoft Money). Los cobros de facturas, pagos a proveedores y pagos sin factura entran solos; aquí se registran además préstamos, nómina, transferencias y otros movimientos.', 'Balance of each bank account and all its transactions, like a checkbook (Microsoft Money style). Invoice collections, supplier payments and payments without invoice come in automatically; loans, payroll, transfers and other transactions are recorded here too.'),
    tasks: [
      { title: L('Crear una cuenta bancaria', 'Create a bank account'), steps: [
        L('Finanzas → Bancos → "+ Cuenta".', 'Finance → Banks → "+ Account".'),
        L('Nombre (ej. Chase Operativa), banco, tipo (corriente, ahorros, tarjeta, caja), número de cuenta y routing.', 'Name (e.g. Chase Operating), bank, type (checking, savings, card, cash), account number and routing.'),
        L('Saldo inicial y su fecha, tal como aparece en el extracto del banco. Desde ahí el ERP suma y resta.', 'Opening balance and its date, as shown on the bank statement. From there the ERP adds and subtracts.'),
        L('Marca "Cuenta principal" en la que más usas: se propone en todos los pagos.', 'Tick "Main account" on the one you use most: it is suggested on every payment.'),
      ] },
      { title: L('Cómo entran los cobros y pagos', 'How collections and payments come in'), steps: [
        L('Al registrar un pago en una factura, elige "Cuenta bancaria donde entró el dinero". Entra el neto: abono + recargo − comisión de Square.', 'When recording a payment on an invoice, choose "Bank account the money went into". The net goes in: amount + surcharge − Square fee.'),
        L('Al pagar una factura de proveedor, al recibir una orden "ya pagada" o en un pago sin factura, elige la cuenta de donde salió.', 'When paying a supplier invoice, receiving an order as "already paid" or on a payment without invoice, choose the account it came from.'),
        L('Si corriges el pago en su documento, el banco se actualiza solo. Cada movimiento tiene el enlace a su documento.', 'If you fix the payment on its document, the bank updates automatically. Each transaction links to its document.'),
        L('"Cobros y pagos sin cuenta bancaria" (abajo en Bancos) lista los pagos registrados sin cuenta: asígnales el banco.', '"Collections and payments without a bank account" (bottom of Banks) lists payments recorded without an account: assign them the bank.'),
      ] },
      { title: L('Nómina, transferencias y otros movimientos', 'Payroll, transfers and other transactions'), steps: [
        L('"Nómina": cuenta, fecha, periodo y una línea por empleado con su monto y referencia.', '"Payroll": account, date, period and one line per employee with amount and reference.'),
        L('"Transferencia": mueve dinero entre tus cuentas (sale de una y entra a la otra).', '"Transfer": moves money between your accounts (out of one, into the other).'),
        L('"+ Ingreso" / "+ Egreso": aportes de capital, intereses, reembolsos, comisiones bancarias, impuestos, gastos, retiros de socio. Puedes adjuntar el soporte.', '"+ Income" / "+ Expense": capital contributions, interest, refunds, bank fees, taxes, expenses, partner withdrawals. You can attach the support.'),
      ] },
      { title: L('Préstamos de socios y terceros', 'Loans from partners and third parties'), steps: [
        L('"Préstamo recibido": quién prestó (socio, tercero o banco), monto, cuenta donde entró, interés y vencimiento. Queda un préstamo NX-PR-… y el ingreso en el banco.', '"Loan received": lender (partner, third party or bank), amount, account it went into, interest and due date. A loan NX-PR-… and the bank income are created.'),
        L('Finanzas → Préstamos → "Registrar abono": abono a capital e intereses aparte; baja el saldo del préstamo y sale del banco.', 'Finance → Loans → "Record repayment": principal and interest separately; it lowers the loan balance and goes out of the bank.'),
        L('Intereses por días: con la tasa anual del préstamo, el ERP calcula el interés simple día a día sobre el saldo de capital (año de 365 días o comercial de 360). Al registrar un abono muestra los intereses pendientes a esa fecha y "Usar este valor" los llena.', 'Daily interest: with the loan\'s annual rate, the ERP computes simple interest day by day on the principal balance (365-day or 360-day year). When recording a repayment it shows the interest due to that date and "Use this amount" fills it in.'),
        L('En el préstamo se ven los intereses causados, pagados y pendientes a hoy, el interés por día y el cálculo por tramos. "✏️ Condiciones / interés" cambia la tasa, la base de días o la fecha.', 'The loan shows accrued, paid and pending interest to date, the daily interest and the calculation by period. "✏️ Terms / interest" changes the rate, day basis or date.'),
      ] },
      { title: L('Conciliar con el extracto del banco', 'Reconcile with the bank statement'), steps: [
        L('Abre la cuenta (clic en su tarjeta). Marca ✓ cada movimiento que aparece en el extracto.', 'Open the account (click its card). Tick ✓ each transaction that appears on the statement.'),
        L('"Saldo conciliado" debe coincidir con el saldo del extracto; la diferencia son los movimientos sin ✓.', '"Reconciled balance" should match the statement balance; the difference is the unticked transactions.'),
        L('Busca por beneficiario, documento o monto; filtra por categoría o fechas; exporta a Excel o imprime.', 'Search by payee, document or amount; filter by category or dates; export to Excel or print.'),
      ] },
    ],
    tips: [L('Solo el administrador y quien tenga el permiso "Bancos y finanzas" ven este módulo.', 'Only the administrator and people with the "Banks and finance" permission see this module.')],
    problems: [
      { q: L('El saldo no coincide con el banco', 'The balance does not match the bank'), a: L('Revisa el saldo inicial y su fecha, los "Cobros y pagos sin cuenta bancaria" y los movimientos sin ✓ en el registro.', 'Check the opening balance and its date, the "Collections and payments without a bank account", and the unticked transactions in the register.') },
      { q: L('No puedo editar un cobro desde el banco', 'I cannot edit a collection from the bank'), a: L('Los que vienen de una factura o de un proveedor se corrigen en su documento (enlace en "Documento"); así quedan iguales en los dos lados.', 'Those that come from an invoice or a supplier are fixed on their document (link under "Document"); that way both sides stay the same.') },
    ],
  },
  {
    id: 'aprobaciones', icon: '✅', routes: ['/aprobaciones'],
    title: L('Aprobaciones', 'Approvals'),
    summary: L('Los cambios que un usuario (no administrador) hace a facturas y pedidos ya creados quedan esperando que el administrador los apruebe.', 'Changes a user (not administrator) makes to existing invoices and orders wait for the administrator\'s approval.'),
    tasks: [
      { title: L('Aprobar o rechazar', 'Approve or reject'), steps: [
        L('Regla general: los usuarios que no son administradores crean documentos y hacen los movimientos del día (registrar, recibir, cobrar, pagar, cambiar el estado), pero modificar o borrar un documento ya creado (órdenes de compra y de trabajo, garantías, cuentas por pagar, pagos sin factura, vehículos, productos, bancos y préstamos) o borrar cualquier registro queda como solicitud aquí.', 'General rule: non-admin users create documents and do the daily movements (record, receive, collect, pay, change status), but editing or deleting an existing document (purchase and work orders, warranties, bills, payments without invoice, vehicles, products, banks and loans) or deleting any record becomes a request here.'),
        L('Administrador: Aprobaciones → Pendientes, revisa el detalle y pulsa "Aprobar" o "Rechazar" (con motivo opcional).', 'Administrator: Approvals → Pending, review the detail and press "Approve" or "Reject" (optional reason).'),
        L('Usuarios: aquí ven el estado de sus solicitudes.', 'Users: see the status of their requests here.'),
      ] },
    ],
  },
  {
    id: 'usuarios', icon: '🔐', routes: ['/usuarios'],
    title: L('Usuarios y permisos', 'Users and permissions'),
    summary: L('Solo el administrador: dar acceso al equipo y decidir en qué módulos puede editar cada uno.', 'Administrator only: give the team access and decide which modules each person can edit.'),
    tasks: [
      { title: L('Invitar a un usuario', 'Invite a user'), steps: [
        L('Usuarios → "+ Nuevo usuario": nombre y correo de la empresa (@nexprotrucks.com).', 'Users → "+ New user": name and company email (@nexprotrucks.com).'),
        L('Rol: Administrador (todo) o Usuario. Para un Usuario marca los módulos donde puede crear y modificar; el resto los ve en solo lectura.', 'Role: Administrator (everything) or User. For a User tick the modules where they can create and edit; the rest are read-only.'),
        L('Copia el enlace de invitación y envíaselo (vence en 7 días; "Reenviar invitación" genera otro).', 'Copy the invitation link and send it (expires in 7 days; "Resend invitation" creates a new one).'),
        L('"Desactivar" quita el acceso sin borrar su historial.', '"Deactivate" removes access without deleting their history.'),
      ] },
    ],
  },
];

// Busca la sección que corresponde a una ruta (la más específica).
export function sectionForPath(pathname) {
  let best = null; let len = -1;
  for (const s of MANUAL) for (const r of s.routes) {
    const match = r === '/' ? pathname === '/' : (pathname === r || pathname.startsWith(r + '/'));
    if (match && r.length > len) { best = s; len = r.length; }
  }
  return best;
}
