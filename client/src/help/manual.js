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
    id: 'clientes', icon: '🤝', routes: ['/clientes', '/crm/llamada', '/crm/solicitudes'],
    title: L('CRM: llamadas, solicitudes y clientes', 'CRM: calls, requests and customers'),
    summary: L(
      'Todo lo de cada cliente en un solo lugar: sus personas (dueño, gerente, mecánico…), cada llamada o correo, lo que ha pedido, sus cotizaciones, facturas, pagos, vehículos y equipos con número de serie y todo el servicio que se les ha hecho. Maneja clientes, clientes potenciales, proveedores y dealers.',
      'Everything about each customer in one place: their people (owner, manager, mechanic…), every call or email, what they asked for, their quotes, invoices, payments, vehicles and serialized equipment and all the service done. Handles customers, prospects, suppliers and dealers.'),
    tasks: [
      { title: L('Atender una llamada (o un correo / texto)', 'Take a call (or an email / text)'), steps: [
        L('CRM → "Atender llamada". Escribe el teléfono (en cualquier formato), el nombre de la empresa o de la persona, un VIN, una placa o un número de serie.', 'CRM → "Take a call". Type the phone (any format), the company or person name, a VIN, a plate or a serial number.'),
        L('Escoge el resultado: a la izquierda aparece todo lo del cliente — saldo por cobrar, personas, solicitudes abiertas, vehículos y equipos, último servicio y últimas conversaciones.', 'Pick the result: on the left you see everything about the customer — balance due, people, open requests, vehicles and equipment, last service and latest conversations.'),
        L('Marca quién está llamando (o "＋ Persona nueva" si es alguien que no estaba) y por dónde llegó (llamada, email, texto, WhatsApp…).', 'Mark who is calling (or "＋ New person" if they were not on file) and how it came in (call, email, text, WhatsApp…).'),
        L('En "¿Qué está buscando?" escoge con clics: Equipos (grúa, bucket lift, compresor…), Servicios, o Productos por categoría. "Buscar" va directo a un producto; "Otra cosa" para lo que no esté en la lista.', 'Under "What are they looking for?" pick with clicks: Equipment (crane, bucket lift, compressor…), Services, or Products by category. "Search" goes straight to a product; "Something else" for anything not listed.'),
        L('¿No está en la lista? Escríbelo abajo y escoge "Agregar a la lista de Equipos / Servicios / Productos": queda guardado para escogerlo con un clic la próxima vez (los servicios y productos nuevos se crean en $0 para completar su precio después). "Solo para esta solicitud" no lo guarda en la lista.', 'Not on the list? Type it below and choose "Add to the Equipment / Services / Products list": it is saved so you can pick it with one click next time (new services and products are created at $0 to complete their price later). "Only for this request" does not save it to the list.'),
        L('En "Documentos y fotos del cliente" arrastra o escoge los archivos que mandó (requerimientos, especificaciones, fotos). También se pueden agregar después desde el detalle de la solicitud.', 'Under "Customer documents & photos" drag or choose the files they sent (requirements, specs, photos). You can also add them later from the request detail.'),
        L('Escribe los detalles de la conversación. La solicitud guarda toda la información para cotizar, pero NO crea la cotización: así no quedan cotizaciones de negocios que no se van a dar.', 'Write the conversation details. The request saves all the quoting information but does NOT create a quote, so you do not end up with quotes for deals that will not happen.'),
        L('"Guardar solicitud y preparar correo": se abre el correo de acuse ya escrito (inglés o español, correo, SMS o WhatsApp) diciendo que ya estamos buscando la solución. "📧 Abrir en Outlook" lo abre listo en tu Outlook de Nexpro (outlook.office.com) para que pulses Enviar, y queda registrado en el historial.', '"Save request and prepare email": the acknowledgement is already written (English or Spanish, email, SMS or WhatsApp) saying we are already working on a solution. "📧 Open in Outlook" opens it ready in your Nexpro Outlook (outlook.office.com) so you just press Send, and it is logged in the history.'),
      ] },
      { title: L('Cotizar una solicitud', 'Quote a request'), steps: [
        L('CRM → Solicitudes (o la pestaña Solicitudes del cliente) → abre la solicitud y pulsa "📝 Crear cotización" cuando decidas cotizar, o "💵 Facturar" para facturar directo.', 'CRM → Requests (or the customer\'s Requests tab) → open the request and click "📝 Create quote" when you decide to quote, or "💵 Invoice" to invoice directly.'),
        L('"Revisar precios" abre la orden de pedido: los productos y servicios vienen con su precio de lista; lo que es una categoría o un equipo general viene "por cotizar" en $0 para ponerle el precio exacto.', '"Review prices" opens the sales order: products and services come with their list price; general categories or equipment come "por cotizar" at $0 so you can set the exact price.'),
        L('"PDF de la cotización" → Imprimir / Guardar PDF. Luego "Enviar cotización": el mensaje sale por el mismo medio (correo o texto) por donde el cliente pidió; adjunta el PDF.', '"Quote PDF" → Print / Save PDF. Then "Send quote": the message goes out by the same channel (email or text) the customer used; attach the PDF.'),
        L('Cambia el estado de la solicitud (en proceso, cotizada, ganada, perdida, cerrada). Ganada convierte al cliente potencial en cliente.', 'Change the request status (in progress, quoted, won, lost, closed). Won turns a prospect into a customer.'),
      ] },
      { title: L('Crear un cliente sin duplicarlo', 'Create a customer without duplicates'), steps: [
        L('Clientes → "+ Nuevo cliente" (o desde Atender llamada cuando no aparece). Escribe el nombre COMPLETO.', 'Customers → "+ New customer" (or from Take a call when not found). Type the FULL name.'),
        L('Mientras escribes, el ERP muestra los clientes parecidos que ya existen (por nombre, siglas, teléfono, correo o Tax ID). Si es uno de ellos, pulsa "Usar este".', 'As you type, the ERP shows similar customers that already exist (by name, acronym, phone, email or Tax ID). If it is one of them, press "Use this one".'),
        L('Marca qué es para Nexpro: Cliente, Cliente potencial, Proveedor y/o Dealer (puede ser varias). Si es Proveedor queda enlazado a su ficha de Proveedores.', 'Mark what it is to Nexpro: Customer, Prospect, Supplier and/or Dealer (several allowed). If Supplier, it is linked to its Suppliers record.'),
        L('En "Otros nombres / siglas" pon cómo lo llaman (WASD, MDWASD…) para encontrarlo aunque escriban solo una parte. Agrega de una vez la persona que llamó y su cargo.', 'In "Other names / acronyms" add what people call it (WASD, MDWASD…) so it is found even with partial names. Add the caller and their role right away.'),
      ] },
      { title: L('Ficha del cliente (todo junto)', 'Customer record (everything together)'), steps: [
        L('Arriba: facturado, pagado, saldo por cobrar (y vencido), solicitudes abiertas, vehículos/equipos y última interacción.', 'Top: invoiced, paid, balance due (and overdue), open requests, vehicles/equipment and last interaction.'),
        L('"Historial completo": todo en orden de fecha — llamadas, correos, solicitudes, cotizaciones, facturas, pagos, vehículos recibidos, órdenes de trabajo y garantías.', '"Full history": everything by date — calls, emails, requests, quotes, invoices, payments, vehicles received, work orders and warranties.'),
        L('"Personas": cada persona con su cargo (dueño, gerente, mecánico, operador…), teléfonos y correo; cada una puede tener sus propios vehículos y solicitudes.', '"People": each person with their role (owner, manager, mechanic, operator…), phones and email; each can have their own vehicles and requests.'),
        L('"Vehículos y equipos": cada camión con sus equipos y número de serie y todo el historial de servicio. Asigna la persona responsable de cada vehículo.', '"Vehicles & equipment": each truck with its equipment and serial numbers and all its service history. Assign the person responsible for each vehicle.'),
        L('"Interacciones": registra llamadas, correos, visitas, notas o tareas con fecha, persona y tema. "🖨️ Informe del cliente" imprime todo en PDF.', '"Interactions": log calls, emails, visits, notes or tasks with date, person and topic. "🖨️ Customer report" prints everything to PDF.'),
      ] },
    ],
    problems: [
      { q: L('"Abrir en Outlook" abre otra app (Mail) o abre Outlook con otra cuenta', '"Open in Outlook" opens another app (Mail) or Outlook with another account'), a: L('Una sola vez en el Mac: 1) Abre la app Mail → Mail → Ajustes → General → "Aplicación de correo predeterminada" → Microsoft Outlook. 2) En Outlook → Ajustes → Cuentas, selecciona je.ramirez@nexprotrucks.com y márcala como predeterminada. Desde ahí el correo sale de esa cuenta.', 'Once on the Mac: 1) Open the Mail app → Mail → Settings → General → "Default email reader" → Microsoft Outlook. 2) In Outlook → Settings → Accounts, select je.ramirez@nexprotrucks.com and set it as default. From then on emails go out from that account.') },
      { q: L('El vehículo no aparece en la ficha del cliente', 'The vehicle does not appear in the customer record'), a: L('El vehículo se recibió sin cliente. Abre el vehículo → "Editar recepción" y escribe o elige el cliente.', 'The vehicle was received without a customer. Open the vehicle → "Edit intake" and type or pick the customer.') },
      { q: L('"Abrir en mi correo" no abre nada', '"Open in my email" does nothing'), a: L('El computador no tiene un programa de correo predeterminado. Usa "📋 Copiar texto", pégalo en Outlook/Gmail y luego "Ya lo envié" para dejarlo registrado.', 'The computer has no default email app. Use "📋 Copy text", paste it into Outlook/Gmail, then "I already sent it" to log it.') },
      { q: L('Encontré un cliente duplicado que ya existía', 'I found a duplicate customer that already existed'), a: L('Agrega el nombre corto en "Otros nombres" del cliente correcto para que la próxima vez aparezca, y pide al administrador borrar el duplicado.', 'Add the short name under "Other names" on the correct customer so it shows next time, and ask the administrator to delete the duplicate.') },
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
        L('Orden por garantía: en Condiciones de pago elige "🛡️ Por garantía". Escoge el VIN del equipo y el reclamo de garantía (NX-WC) o "Crear reclamo nuevo". La orden y el reclamo quedan cruzados: desde la orden abres el reclamo y desde el reclamo ves sus órdenes. Al recibir no se crea cuenta por pagar (la cubre el fabricante). En la lista, filtra por "🛡️ Por garantía".', 'Warranty order: in Payment terms choose "🛡️ Warranty". Pick the unit VIN and the warranty claim (NX-WC) or "Create a new claim". The order and the claim are cross-linked: open the claim from the order and see its orders from the claim. Receiving creates no payable (the manufacturer covers it). In the list, filter by "🛡️ Warranty".'),
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
