// Procedimientos de Nexpro: los flujos completos de la empresa, paso a paso, en español e inglés.
// Cada proceso tiene nodos (pasos) y conexiones; la página /procedimientos dibuja el diagrama con
// Mermaid y muestra al lado el paso a paso: quién lo hace, en qué pantalla y qué hacer.
// `route` lleva a la pantalla del ERP; `help` enlaza con la sección del Manual de usuario.
// Tipos de nodo: start / end (inicio y fin), step (paso), dec (decisión), doc (documento que
// genera el ERP), admin (solo el administrador). Al cambiar un proceso en el ERP, actualizar aquí.

const L = (es, en) => ({ es, en });

const W = {
  ventas: L('Ventas', 'Sales'),
  recepcion: L('Recepción', 'Front desk'),
  ventasRec: L('Ventas / Recepción', 'Sales / Front desk'),
  jefe: L('Jefe de taller', 'Shop manager'),
  mecanico: L('Mecánico', 'Mechanic'),
  compras: L('Compras', 'Purchasing'),
  bodega: L('Bodega', 'Warehouse'),
  admin: L('Administración', 'Accounting'),
  jorge: L('Administrador (Jorge)', 'Administrator (Jorge)'),
  todos: L('Cualquier usuario', 'Any user'),
  sistema: L('El ERP (automático)', 'The ERP (automatic)'),
};

export const PROCESOS = [
  // ───────────────────────────── 1. Taller ─────────────────────────────
  {
    id: 'taller', icon: '🚚',
    title: L('Vehículo al taller: recepción → servicio → factura', 'Vehicle to the shop: intake → service → invoice'),
    summary: L(
      'Desde que el cliente llama o llega con el camión hasta que se entrega reparado, facturado y cobrado. Todo queda ligado al cliente, al VIN y a los seriales de los equipos.',
      'From the moment the customer calls or arrives with the truck until it is delivered repaired, invoiced and paid. Everything stays tied to the customer, the VIN and the equipment serials.'),
    nodes: [
      { id: 'T1', kind: 'start', label: L('Cliente llama o llega', 'Customer calls or arrives'), who: W.ventasRec, route: '/crm/llamada', help: 'clientes',
        desc: L('CRM → "Atender llamada". Busca por teléfono, nombre, VIN, placa o serial: aparece todo lo del cliente (saldo, vehículos, último servicio).', 'CRM → "Take a call". Search by phone, name, VIN, plate or serial: everything about the customer appears (balance, vehicles, last service).') },
      { id: 'T2', kind: 'dec', label: L('¿El cliente ya existe?', 'Does the customer exist?'), who: W.ventasRec, route: '/clientes', help: 'clientes',
        desc: L('Mientras escribes el ERP muestra clientes parecidos (nombre, siglas, teléfono, correo, Tax ID). Si es uno de ellos, usa ese: no dupliques.', 'As you type the ERP shows similar customers (name, acronym, phone, email, Tax ID). If it is one of them, use it: do not duplicate.') },
      { id: 'T3', kind: 'step', label: L('Crear cliente y persona que llama', 'Create customer and caller'), who: W.ventasRec, route: '/clientes', help: 'clientes',
        desc: L('Nombre completo, tipo (cliente, potencial, proveedor, dealer), otros nombres / siglas y la persona con su cargo (dueño, gerente, mecánico…).', 'Full name, type (customer, prospect, supplier, dealer), other names / acronyms and the person with their role (owner, manager, mechanic…).') },
      { id: 'T4', kind: 'doc', label: L('Solicitud en el CRM', 'CRM request'), who: W.ventasRec, route: '/crm/solicitudes', help: 'clientes',
        desc: L('Marca qué necesita (equipo, servicio o producto), adjunta fotos o documentos y escribe el problema. "Guardar solicitud y preparar correo" envía el acuse al cliente.', 'Mark what they need (equipment, service or product), attach photos or documents and describe the problem. "Save request and prepare email" sends the acknowledgement.') },
      { id: 'T5', kind: 'step', label: L('Recibir el vehículo por VIN', 'Receive the vehicle by VIN'), who: W.recepcion, route: '/vehiculos', help: 'vehiculos',
        desc: L('Recepción de Vehículos → "+ Recibir vehículo". El VIN es obligatorio y único; el resto se completa después. La llamada del CRM se enlaza sola si coincide teléfono, cliente y producto, VIN o serial.', 'Vehicle Intake → "+ Receive vehicle". The VIN is required and unique; the rest can be completed later. The CRM call links automatically when phone, customer and product, VIN or serial match.') },
      { id: 'T6', kind: 'step', label: L('Registrar equipos instalados con serial', 'Record installed equipment with serials'), who: W.recepcion, route: '/vehiculos', help: 'vehiculos',
        desc: L('En la ficha del vehículo → "+ Agregar equipo": tipo (grúa, compresor, bucket, liftgate…; si es nuevo se agrega a la lista), serial, fabricante y modelo. Toma foto de cómo llega.', 'On the vehicle record → "+ Add equipment": type (crane, compressor, bucket, liftgate…; new types are added to the list), serial, manufacturer and model. Take a photo of how it arrives.') },
      { id: 'T7', kind: 'doc', label: L('Documento de recepción firmado', 'Signed intake document'), who: W.recepcion, route: '/vehiculos', help: 'vehiculos',
        desc: L('"Imprimir recepción" genera el documento de entrada para que el cliente lo firme.', '"Print intake" generates the check-in document for the customer to sign.') },
      { id: 'T8', kind: 'doc', label: L('Orden de trabajo', 'Work order'), who: W.jefe, route: '/ordenes-trabajo', help: 'ordenes-trabajo',
        desc: L('Desde el vehículo → "+ Nueva orden de trabajo": mecánico, servicios del catálogo (por hora o precio fijo), partes y el problema reportado.', 'From the vehicle → "+ New work order": mechanic, catalog services (hourly or flat), parts and the reported problem.') },
      { id: 'T9', kind: 'step', label: L('Mecánico trabaja y registra', 'Mechanic works and records'), who: W.mecanico, route: '/ordenes-trabajo', help: 'ordenes-trabajo',
        desc: L('Estado Pendiente → En proceso. Escribe diagnóstico y solución, y las partes reemplazadas, reparadas o suministradas por el cliente.', 'Status Pending → In progress. Write diagnosis and resolution, and the parts replaced, repaired or supplied by the customer.') },
      { id: 'T10', kind: 'dec', label: L('¿Aparece trabajo no cotizado?', 'Unquoted work found?'), who: W.jefe, help: 'ordenes-trabajo',
        desc: L('Si aparece algo que no se había hablado con el cliente, se detiene y se le avisa antes de hacerlo.', 'If something comes up that was not agreed with the customer, stop and tell them before doing it.') },
      { id: 'T11', kind: 'step', label: L('Avisar al cliente y agregarlo a la orden', 'Tell the customer and add it to the order'), who: W.jefe, route: '/ordenes-trabajo', help: 'ordenes-trabajo',
        desc: L('Con la aprobación del cliente, agrega el servicio o las partes a la orden de trabajo y regístralo como interacción en el CRM.', 'With the customer\'s approval, add the service or parts to the work order and log it as a CRM interaction.') },
      { id: 'T12', kind: 'dec', label: L('¿Trabajó un tercero sin factura?', 'Did a third party work without invoice?'), who: W.jefe, help: 'pagos-sin-factura',
        desc: L('Soldador, pintor o técnico externo que no expide factura.', 'Welder, painter or outside technician who does not issue invoices.') },
      { id: 'T13', kind: 'doc', label: L('Pago sin factura NX-PS', 'Payment w/o invoice NX-PS'), who: W.admin, route: '/pagos-sin-factura', help: 'pagos-sin-factura',
        desc: L('Desde el vehículo o la orden → "Pago sin factura": a quién, qué se hizo y monto. Se imprime para que firme que recibió el pago.', 'From the vehicle or order → "Payment w/o invoice": who, what was done and amount. Print it so they sign they were paid.') },
      { id: 'T14', kind: 'step', label: L('Orden completada', 'Order completed'), who: W.jefe, route: '/ordenes-trabajo', help: 'ordenes-trabajo',
        desc: L('Revisa el trabajo, toma fotos finales y cambia el estado a Completado.', 'Check the work, take final photos and set the status to Completed.') },
      { id: 'T15', kind: 'doc', label: L('Factura NX-INV', 'Invoice NX-INV'), who: W.admin, route: '/facturas', help: 'facturas',
        desc: L('En la ficha del vehículo marca las órdenes completadas → "Facturar seleccionadas". La factura sale con servicios, partes e impuesto.', 'On the vehicle record tick the completed orders → "Invoice selected". The invoice includes services, parts and tax.') },
      { id: 'T16', kind: 'dec', label: L('¿Paga al recoger?', 'Pays at pickup?'), who: W.admin, help: 'facturas',
        desc: L('Según los términos de crédito del cliente.', 'According to the customer\'s credit terms.') },
      { id: 'T17', kind: 'step', label: L('Registrar pago y entregar', 'Record payment and deliver'), who: W.admin, route: '/facturas', help: 'facturas',
        desc: L('"Registrar pago": forma de pago, banco donde entró y comprobante. Con tarjeta: botón 3% de recargo y comisión de Square.', '"Record payment": method, bank account it went into and proof. With card: 3% surcharge button and Square fee.') },
      { id: 'T18', kind: 'step', label: L('Queda en Cartera para cobrar', 'Goes to Receivables'), who: W.admin, route: '/cartera', help: 'cartera',
        desc: L('La factura queda en Cartera por antigüedad hasta que se registre el pago.', 'The invoice stays in Receivables by age until the payment is recorded.') },
      { id: 'T19', kind: 'end', label: L('Historial completo en el cliente', 'Full history on the customer'), who: W.sistema, route: '/clientes', help: 'clientes',
        desc: L('Llamada, vehículo, equipos con serial, órdenes, factura y pago quedan en el "Historial completo" del cliente.', 'Call, vehicle, serialized equipment, orders, invoice and payment are all in the customer\'s "Full history".') },
    ],
    edges: [
      ['T1', 'T2'], ['T2', 'T3', L('No', 'No')], ['T2', 'T4', L('Sí', 'Yes')], ['T3', 'T4'], ['T4', 'T5'], ['T5', 'T6'], ['T6', 'T7'],
      ['T7', 'T8'], ['T8', 'T9'], ['T9', 'T10'], ['T10', 'T11', L('Sí', 'Yes')], ['T11', 'T9'], ['T10', 'T12', L('No', 'No')],
      ['T12', 'T13', L('Sí', 'Yes')], ['T13', 'T14'], ['T12', 'T14', L('No', 'No')], ['T14', 'T15'], ['T15', 'T16'],
      ['T16', 'T17', L('Sí', 'Yes')], ['T16', 'T18', L('Crédito', 'Credit')], ['T18', 'T17', L('Al pagar', 'When paid')], ['T17', 'T19'],
    ],
    rules: [
      L('Ningún vehículo entra sin VIN ni foto de cómo llegó.', 'No vehicle comes in without a VIN and an arrival photo.'),
      L('Las órdenes de trabajo siempre se crean desde el vehículo.', 'Work orders are always created from the vehicle.'),
      L('Trabajo adicional: primero la aprobación del cliente, después se hace.', 'Extra work: customer approval first, then do it.'),
      L('Horas, partes y terceros se registran en la orden el mismo día.', 'Hours, parts and third parties are recorded on the order the same day.'),
    ],
  },

  // ───────────────────────────── 2. Venta ─────────────────────────────
  {
    id: 'venta', icon: '🧾',
    title: L('Venta de unidad: solicitud → cotización → pedido → factura', 'Unit sale: request → quote → order → invoice'),
    summary: L(
      'Venta de un camión carrozado o de un equipo, desde la solicitud del cliente hasta la entrega y el cobro. La cotización se crea solo cuando alguien decide cotizar.',
      'Sale of an upfitted truck or a piece of equipment, from the customer\'s request to delivery and payment. The quote is created only when someone decides to quote.'),
    nodes: [
      { id: 'V1', kind: 'start', label: L('Solicitud del cliente', 'Customer request'), who: W.ventas, route: '/crm/llamada', help: 'clientes',
        desc: L('Llega por teléfono, correo, texto, licitación municipal o dealer. Se atiende en CRM → "Atender llamada".', 'It comes by phone, email, text, municipal bid or dealer. Handle it in CRM → "Take a call".') },
      { id: 'V2', kind: 'doc', label: L('Solicitud guardada: solo info para cotizar', 'Request saved: quoting info only'), who: W.ventas, route: '/crm/solicitudes', help: 'clientes',
        desc: L('Equipos, servicios o productos que busca, especificaciones y documentos del cliente. La solicitud NO crea cotización.', 'Equipment, services or products wanted, specs and customer documents. The request does NOT create a quote.') },
      { id: 'V3', kind: 'dec', label: L('¿Se decide cotizar?', 'Decide to quote?'), who: W.ventas, route: '/crm/solicitudes', help: 'clientes',
        desc: L('Mientras no se cotice, la solicitud queda "en proceso" para seguimiento.', 'Until it is quoted, the request stays "in progress" for follow-up.') },
      { id: 'V4', kind: 'step', label: L('Seguimiento en el CRM', 'Follow up in CRM'), who: W.ventas, route: '/clientes', help: 'clientes',
        desc: L('Registra cada llamada, correo o visita en "Interacciones" del cliente. Si no se da, estado "perdida" o "cerrada".', 'Log every call, email or visit under the customer\'s "Interactions". If it does not happen, status "lost" or "closed".') },
      { id: 'V5', kind: 'doc', label: L('Cotización (orden de pedido)', 'Quote (sales order)'), who: W.ventas, route: '/pedidos', help: 'pedidos',
        desc: L('En la solicitud → "📝 Crear cotización" → "Revisar precios". Productos y servicios vienen con precio de lista; lo general viene "por cotizar" en $0.', 'On the request → "📝 Create quote" → "Review prices". Products and services come with list price; general items come "por cotizar" at $0.') },
      { id: 'V6', kind: 'step', label: L('Enviar cotización en PDF', 'Send quote PDF'), who: W.ventas, route: '/pedidos', help: 'clientes',
        desc: L('"PDF de la cotización" → Guardar PDF, luego "Enviar cotización" por el mismo medio por donde pidió el cliente. Estado de la solicitud: cotizada.', '"Quote PDF" → Save PDF, then "Send quote" through the same channel the customer used. Request status: quoted.') },
      { id: 'V7', kind: 'dec', label: L('¿El cliente aprueba?', 'Customer approves?'), who: W.ventas, help: 'pedidos',
        desc: L('Guarda la orden de compra del cliente o su aprobación por escrito en la solicitud.', 'Save the customer\'s PO or written approval on the request.') },
      { id: 'V8', kind: 'step', label: L('Ajustar o marcar perdida', 'Adjust or mark lost'), who: W.ventas, route: '/crm/solicitudes', help: 'clientes',
        desc: L('Revisa precios y vuelve a enviar, o marca la solicitud como perdida con el motivo.', 'Revise prices and resend, or mark the request as lost with the reason.') },
      { id: 'V9', kind: 'step', label: L('Ganada: pedido aprobado', 'Won: order approved'), who: W.ventas, route: '/pedidos', help: 'pedidos',
        desc: L('Solicitud en "ganada" (el cliente potencial pasa a cliente) y el pedido en "aprobado" → "en proceso".', 'Request "won" (the prospect becomes a customer) and the order "approved" → "in progress".') },
      { id: 'V10', kind: 'dec', label: L('¿Hay stock de carrocería y equipos?', 'Body and equipment in stock?'), who: W.compras, route: '/inventario', help: 'inventario',
        desc: L('Revisa Inventario y Números de serie disponibles.', 'Check Inventory and available Serial numbers.') },
      { id: 'V11', kind: 'doc', label: L('Orden de compra al proveedor', 'Purchase order to supplier'), who: W.compras, route: '/compras', help: 'compras',
        desc: L('Reading, Serco, Versalift / Load King, Dakota, Vanair, Venturo, Masterack… Ver el proceso "Compras e inventario".', 'Reading, Serco, Versalift / Load King, Dakota, Vanair, Venturo, Masterack… See the "Purchasing and inventory" process.') },
      { id: 'V12', kind: 'step', label: L('Recibir el chasis por VIN', 'Receive the chassis by VIN'), who: W.recepcion, route: '/vehiculos', help: 'vehiculos',
        desc: L('El chasis se recibe como vehículo (a veces lo suministra el cliente, por ejemplo un dealer).', 'The chassis is received as a vehicle (sometimes supplied by the customer, e.g. a dealer).') },
      { id: 'V13', kind: 'doc', label: L('Orden de trabajo de montaje', 'Upfit work order'), who: W.jefe, route: '/ordenes-trabajo', help: 'ordenes-trabajo',
        desc: L('Montaje de carrocería y equipos. Cada equipo instalado se agrega al vehículo con su serial (el serial pasa a "instalado").', 'Body and equipment upfit. Each installed item is added to the vehicle with its serial (the serial becomes "installed").') },
      { id: 'V14', kind: 'step', label: L('Trabajos externos', 'Outside work'), who: W.jefe, route: '/cuentas-por-pagar', help: 'cuentas-por-pagar',
        desc: L('PTO, bombas hidráulicas, pintura… Con factura del proveedor: Cuentas por pagar. Sin factura: Pago sin factura NX-PS.', 'PTO, hydraulic pumps, paint… With supplier invoice: Accounts payable. Without invoice: Payment w/o invoice NX-PS.') },
      { id: 'V15', kind: 'step', label: L('Control de calidad y fotos finales', 'Quality check and final photos'), who: W.jefe, route: '/ordenes-trabajo', help: 'ordenes-trabajo',
        desc: L('Prueba de funcionamiento y verificar que todos los seriales estén registrados. Orden → Completado.', 'Function test and check all serials are recorded. Order → Completed.') },
      { id: 'V16', kind: 'doc', label: L('Factura del pedido', 'Order invoice'), who: W.admin, route: '/facturas', help: 'facturas',
        desc: L('En el pedido → "Facturar". En la factura asigna los seriales vendidos.', 'On the order → "Invoice". Assign the sold serials on the invoice.') },
      { id: 'V17', kind: 'doc', label: L('Entrega con ticket firmado', 'Delivery with signed ticket'), who: W.ventas, route: '/facturas', help: 'facturas',
        desc: L('Imprime el ticket de entrega desde la factura. Si se factura a un cliente y la unidad va a otro (cliente final), anótalo en la factura.', 'Print the delivery ticket from the invoice. If billed to one customer and delivered to another (end customer), note it on the invoice.') },
      { id: 'V18', kind: 'step', label: L('Cobro y cartera', 'Collection and receivables'), who: W.admin, route: '/cartera', help: 'cartera',
        desc: L('Registrar el pago o hacer seguimiento en Cartera hasta que se pague.', 'Record the payment or follow up in Receivables until paid.') },
      { id: 'V19', kind: 'end', label: L('Unidad entregada', 'Unit delivered'), who: W.sistema, route: '/seriales', help: 'seriales',
        desc: L('La unidad, sus equipos y seriales quedan en el historial del cliente y en Números de serie.', 'The unit, its equipment and serials stay in the customer history and in Serial numbers.') },
    ],
    edges: [
      ['V1', 'V2'], ['V2', 'V3'], ['V3', 'V4', L('Todavía no', 'Not yet')], ['V4', 'V3'], ['V3', 'V5', L('Sí: Crear cotización', 'Yes: Create quote')],
      ['V5', 'V6'], ['V6', 'V7'], ['V7', 'V8', L('No', 'No')], ['V8', 'V6'], ['V7', 'V9', L('Sí', 'Yes')], ['V9', 'V10'],
      ['V10', 'V11', L('No', 'No')], ['V11', 'V12'], ['V10', 'V12', L('Sí', 'Yes')], ['V12', 'V13'], ['V13', 'V14'], ['V14', 'V15'],
      ['V15', 'V16'], ['V16', 'V17'], ['V17', 'V18'], ['V18', 'V19'],
    ],
    rules: [
      L('No se crean cotizaciones automáticas: solo con "Crear cotización" o "Facturar".', 'No automatic quotes: only with "Create quote" or "Invoice".'),
      L('Toda unidad entregada tiene VIN y los seriales de sus equipos registrados.', 'Every delivered unit has its VIN and equipment serials recorded.'),
      L('Cambiar un pedido o factura ya creado lo aprueba el administrador (ver "Cambios y aprobaciones").', 'Changing an existing order or invoice is approved by the administrator (see "Changes and approvals").'),
    ],
  },

  // ───────────────────────────── 3. Compras ─────────────────────────────
  {
    id: 'compras', icon: '🛒',
    title: L('Compras e inventario', 'Purchasing and inventory'),
    summary: L(
      'El ciclo de compra completo: orden → envío → recepción con seriales (entra al inventario) → cuenta por pagar → pago, incluyendo faltantes y garantías.',
      'The full purchasing cycle: order → send → receipt with serials (into inventory) → payable → payment, including shortages and warranties.'),
    nodes: [
      { id: 'C1', kind: 'start', label: L('Necesidad de compra', 'Purchase need'), who: W.compras, route: '/inventario', help: 'inventario',
        desc: L('Por un pedido de cliente, una orden de trabajo o stock bajo.', 'For a customer order, a work order or low stock.') },
      { id: 'C2', kind: 'dec', label: L('¿El producto existe en el catálogo?', 'Is the product in the catalog?'), who: W.compras, route: '/productos', help: 'inventario',
        desc: L('Busca por nombre, SKU o número del fabricante.', 'Search by name, SKU or manufacturer number.') },
      { id: 'C3', kind: 'step', label: L('Crear producto', 'Create product'), who: W.compras, route: '/productos', help: 'inventario',
        desc: L('Nombre, SKU, tipo, proveedor y foto. Costo + flete + margen % = precio de venta. Carrocerías Reading: SKU NX-RD-<código de configuración>. Marca "Maneja números de serie" si cada unidad tiene serial.', 'Name, SKU, type, supplier and photo. Cost + freight + margin % = selling price. Reading bodies: SKU NX-RD-<config code>. Tick "Tracks serial numbers" if each unit has a serial.') },
      { id: 'C4', kind: 'doc', label: L('Orden de compra', 'Purchase order'), who: W.compras, route: '/compras', help: 'compras',
        desc: L('"+ Nueva orden de compra": proveedor, condiciones de pago, líneas con cantidad y costo, e instrucciones. Adjunta la cotización del proveedor.', '"+ New purchase order": supplier, payment terms, lines with quantity and cost, and instructions. Attach the supplier\'s quote.') },
      { id: 'C5', kind: 'step', label: L('Imprimir, enviar y marcar enviada', 'Print, send and mark sent'), who: W.compras, route: '/compras', help: 'compras',
        desc: L('"Imprimir" genera la orden para el proveedor; luego "Marcar enviada".', '"Print" generates the order for the supplier; then "Mark sent".') },
      { id: 'C6', kind: 'step', label: L('Recibir mercancía y seriales', 'Receive goods and serials'), who: W.bodega, route: '/compras', help: 'compras',
        desc: L('"Recibir": cuánto llegó por línea y, si tiene serial, un serial por unidad (sirve el lector de código de barras).', '"Receive": how much arrived per line and, if serialized, one serial per unit (barcode scanner works).') },
      { id: 'C7', kind: 'dec', label: L('¿Llegó todo?', 'Did everything arrive?'), who: W.bodega, route: '/compras', help: 'compras',
        desc: L('Compara contra la orden de compra.', 'Compare against the purchase order.') },
      { id: 'C8', kind: 'step', label: L('Parcial: recibir resto o cerrar faltante', 'Partial: receive rest or close shortage'), who: W.compras, route: '/compras', help: 'compras',
        desc: L('La orden queda "parcial". Cuando llegue: "Recibir resto". Si ya no va a llegar: "Cerrar faltante" con el motivo.', 'The order stays "partial". When it arrives: "Receive rest". If it will not arrive: "Close shortage" with the reason.') },
      { id: 'C9', kind: 'doc', label: L('Recepción NX-GR: sube el inventario', 'Receipt NX-GR: inventory goes up'), who: W.sistema, route: '/inventario', help: 'compras',
        desc: L('"Registrar recepción": el stock sube solo por lo que llegó y los seriales quedan disponibles.', '"Register receipt": stock goes up only by what arrived and the serials become available.') },
      { id: 'C10', kind: 'doc', label: L('Cuenta por pagar', 'Payable'), who: W.admin, route: '/cuentas-por-pagar', help: 'cuentas-por-pagar',
        desc: L('Al recibir: "A crédito" (vence según el proveedor), "Ya está pagada" o "No crear ahora". Pon el número de factura del proveedor.', 'When receiving: "On credit" (due per supplier terms), "Already paid" or "Do not create now". Enter the supplier invoice number.') },
      { id: 'C11', kind: 'step', label: L('Registrar garantía del equipo', 'Register equipment warranty'), who: W.compras, route: '/garantias', help: 'garantias',
        desc: L('Si el equipo trae garantía: en la orden → "Registrar garantía" con serial, fechas y documentos.', 'If the equipment has a warranty: on the order → "Register warranty" with serial, dates and documents.') },
      { id: 'C12', kind: 'step', label: L('Pagar al proveedor', 'Pay the supplier'), who: W.admin, route: '/cuentas-por-pagar', help: 'cuentas-por-pagar',
        desc: L('"Registrar pago": fecha, monto, forma, banco de donde salió y comprobante. El banco se actualiza solo.', '"Record payment": date, amount, method, bank account it came from and proof. The bank updates automatically.') },
      { id: 'C13', kind: 'end', label: L('Disponible para vender o instalar', 'Ready to sell or install'), who: W.sistema, route: '/seriales', help: 'seriales',
        desc: L('El inventario baja cuando se factura o se instala en un vehículo.', 'Inventory goes down when invoiced or installed on a vehicle.') },
    ],
    edges: [
      ['C1', 'C2'], ['C2', 'C3', L('No', 'No')], ['C3', 'C4'], ['C2', 'C4', L('Sí', 'Yes')], ['C4', 'C5'], ['C5', 'C6'], ['C6', 'C7'],
      ['C7', 'C8', L('No', 'No')], ['C8', 'C6', L('Llega el resto', 'Rest arrives')], ['C7', 'C9', L('Sí', 'Yes')], ['C8', 'C9', L('Cerrar faltante', 'Close shortage')],
      ['C9', 'C10'], ['C10', 'C11'], ['C11', 'C12'], ['C12', 'C13'],
    ],
    rules: [
      L('No se recibe nada sin orden de compra (excepción: "+ Agregar seriales" para unidades sin OC).', 'Nothing is received without a purchase order (exception: "+ Add serials" for units without a PO).'),
      L('Si la orden ya tiene mercancía recibida, sus líneas quedan bloqueadas.', 'Once goods are received, the order lines are locked.'),
      L('Toda recepción debe terminar en una cuenta por pagar o en un pago registrado.', 'Every receipt must end in a payable or a recorded payment.'),
    ],
  },

  // ───────────────────────────── 4. Cobros y bancos ─────────────────────────────
  {
    id: 'cobros', icon: '💵',
    title: L('Cobros, pagos y bancos', 'Collections, payments and banks'),
    summary: L(
      'Qué pasa después de facturar: Cartera, registro del pago, cómo llega al banco y la conciliación con el extracto. Incluye los préstamos.',
      'What happens after invoicing: Receivables, recording the payment, how it reaches the bank and reconciliation with the statement. Includes loans.'),
    nodes: [
      { id: 'F1', kind: 'start', label: L('Factura emitida', 'Invoice issued'), who: W.admin, route: '/facturas', help: 'facturas',
        desc: L('Viene de una orden de trabajo, de un pedido o se hace a mano.', 'It comes from a work order, a sales order or is made by hand.') },
      { id: 'F2', kind: 'step', label: L('Cartera por antigüedad', 'Receivables by age'), who: W.admin, route: '/cartera', help: 'cartera',
        desc: L('Corriente, 1–30, 31–60, 61–90 y más de 90 días. "Por cliente" muestra el estado de cuenta de cada uno.', 'Current, 1–30, 31–60, 61–90 and over 90 days. "By customer" shows each one\'s statement.') },
      { id: 'F3', kind: 'dec', label: L('¿Pagó a tiempo?', 'Paid on time?'), who: W.admin, route: '/cartera', help: 'cartera',
        desc: L('Revisa la cartera vencida cada semana.', 'Review overdue receivables every week.') },
      { id: 'F4', kind: 'step', label: L('Recordatorio y estado de cuenta', 'Reminder and statement'), who: W.admin, route: '/cartera', help: 'cartera',
        desc: L('"Imprimir listado" del cliente saca el estado de cuenta para enviarlo. Registra el contacto como interacción en el CRM.', '"Print list" for the customer produces the statement to send. Log the contact as a CRM interaction.') },
      { id: 'F5', kind: 'admin', label: L('Cuentas difíciles: decide Jorge', 'Hard accounts: Jorge decides'), who: W.jorge, route: '/cartera', help: 'cartera',
        desc: L('Facturas de más de 90 días o clientes que no responden pasan al administrador.', 'Invoices over 90 days or unresponsive customers go to the administrator.') },
      { id: 'F6', kind: 'step', label: L('Registrar pago con comprobante', 'Record payment with proof'), who: W.admin, route: '/facturas', help: 'facturas',
        desc: L('Fecha, monto, forma (cheque, transferencia, ACH, tarjeta / Square, efectivo), referencia, banco donde entró y comprobante adjunto.', 'Date, amount, method (check, transfer, ACH, card / Square, cash), reference, bank account it went into and attached proof.') },
      { id: 'F7', kind: 'doc', label: L('Movimiento en el banco', 'Bank transaction'), who: W.sistema, route: '/finanzas', help: 'finanzas',
        desc: L('Entra el neto al banco: abono + recargo − comisión de Square. Cada movimiento tiene enlace a su documento.', 'The net goes into the bank: amount + surcharge − Square fee. Each transaction links to its document.') },
      { id: 'F8', kind: 'step', label: L('Conciliar con el extracto', 'Reconcile with statement'), who: W.admin, route: '/finanzas', help: 'finanzas',
        desc: L('Abre la cuenta y marca ✓ cada movimiento del extracto; el "Saldo conciliado" debe coincidir con el banco.', 'Open the account and tick ✓ each statement transaction; the "Reconciled balance" must match the bank.') },
      { id: 'F9', kind: 'end', label: L('Factura saldada y banco cuadrado', 'Invoice paid and bank balanced'), who: W.sistema, route: '/finanzas', help: 'finanzas', desc: L('', '') },
      { id: 'P1', kind: 'start', label: L('Préstamo recibido', 'Loan received'), who: W.jorge, route: '/finanzas/prestamos', help: 'finanzas',
        desc: L('Finanzas → "Préstamo recibido": quién prestó (socio, tercero o banco), monto, cuenta, interés y vencimiento.', 'Finance → "Loan received": lender (partner, third party or bank), amount, account, interest and due date.') },
      { id: 'P2', kind: 'doc', label: L('Préstamo NX-PR', 'Loan NX-PR'), who: W.sistema, route: '/finanzas/prestamos', help: 'finanzas',
        desc: L('Interés simple día a día sobre el saldo de capital.', 'Simple interest day by day on the principal balance.') },
      { id: 'P3', kind: 'admin', label: L('Abonos a capital e intereses', 'Principal and interest repayments'), who: W.jorge, route: '/finanzas/prestamos', help: 'finanzas',
        desc: L('"Registrar abono": capital e intereses por separado; baja el saldo del préstamo y sale del banco.', '"Record repayment": principal and interest separately; lowers the loan balance and goes out of the bank.') },
    ],
    edges: [
      ['F1', 'F2'], ['F2', 'F3'], ['F3', 'F6', L('Sí', 'Yes')], ['F3', 'F4', L('No', 'No')], ['F4', 'F6', L('Paga', 'Pays')],
      ['F4', 'F5', L('No responde', 'No response')], ['F6', 'F7'], ['F7', 'F8'], ['F8', 'F9'],
      ['P1', 'P2'], ['P2', 'P3'], ['P3', 'F7'],
    ],
    rules: [
      L('Todo pago queda ligado a su factura, al cliente y a la cuenta bancaria.', 'Every payment is tied to its invoice, the customer and the bank account.'),
      L('Un cobro de factura se corrige en la factura, no en el banco.', 'An invoice collection is fixed on the invoice, not in the bank.'),
      L('Préstamos y sus abonos: solo el administrador.', 'Loans and their repayments: administrator only.'),
      L('Editar o borrar pagos y borrar facturas: solo el administrador.', 'Editing or deleting payments and deleting invoices: administrator only.'),
    ],
  },

  // ───────────────────────────── 5. Cambios ─────────────────────────────
  {
    id: 'cambios', icon: '✅',
    title: L('Cambios y aprobaciones', 'Changes and approvals'),
    summary: L(
      'Qué hacer cuando un documento ya creado (pedido, factura, orden de compra o de trabajo, vehículo, producto…) necesita un cambio.',
      'What to do when an existing document (order, invoice, purchase or work order, vehicle, product…) needs a change.'),
    nodes: [
      { id: 'A1', kind: 'start', label: L('Un documento necesita un cambio', 'A document needs a change'), who: W.todos, help: 'aprobaciones',
        desc: L('Un dato está mal o el cliente pidió un ajuste.', 'A detail is wrong or the customer asked for an adjustment.') },
      { id: 'A2', kind: 'dec', label: L('¿Es un movimiento normal?', 'Is it a normal movement?'), who: W.todos, help: 'aprobaciones',
        desc: L('Registrar, recibir, cobrar, pagar o cambiar el estado se hace directo. Modificar un documento ya creado, no.', 'Recording, receiving, collecting, paying or changing status is done directly. Modifying an existing document is not.') },
      { id: 'A3', kind: 'step', label: L('Se hace directo', 'Done directly'), who: W.todos, desc: L('Por ejemplo: pasar una orden de trabajo de Pendiente a En proceso.', 'For example: moving a work order from Pending to In progress.') },
      { id: 'A4', kind: 'dec', label: L('¿Es anular o borrar?', 'Is it void or delete?'), who: W.todos, help: 'aprobaciones',
        desc: L('Anular, cancelar o borrar equivale a eliminar el documento.', 'Voiding, cancelling or deleting is the same as removing the document.') },
      { id: 'A5', kind: 'admin', label: L('Solo el administrador', 'Administrator only'), who: W.jorge, help: 'aprobaciones',
        desc: L('Los botones de anular y borrar no aparecen para los demás usuarios. Avísale a Jorge con el número del documento y el motivo.', 'Void and delete buttons are hidden for other users. Tell Jorge the document number and the reason.') },
      { id: 'A6', kind: 'step', label: L('Editar: queda como solicitud', 'Edit: becomes a request'), who: W.todos, route: '/aprobaciones', help: 'aprobaciones',
        desc: L('Haz el cambio normalmente; al guardar, el ERP lo deja pendiente en Aprobaciones en vez de aplicarlo.', 'Make the change normally; on save, the ERP leaves it pending in Approvals instead of applying it.') },
      { id: 'A7', kind: 'admin', label: L('Jorge revisa', 'Jorge reviews'), who: W.jorge, route: '/aprobaciones', help: 'aprobaciones',
        desc: L('Aprobaciones → Pendientes: ve qué cambia, quién lo pidió y por qué.', 'Approvals → Pending: see what changes, who asked and why.') },
      { id: 'A8', kind: 'dec', label: L('¿Aprueba?', 'Approve?'), who: W.jorge, route: '/aprobaciones', help: 'aprobaciones', desc: L('', '') },
      { id: 'A9', kind: 'doc', label: L('Cambio aplicado y registrado', 'Change applied and logged'), who: W.sistema, route: '/aprobaciones', help: 'aprobaciones',
        desc: L('Queda registro de quién pidió, quién aprobó y cuándo.', 'Who asked, who approved and when are logged.') },
      { id: 'A10', kind: 'step', label: L('Rechazado con motivo', 'Rejected with reason'), who: W.todos, route: '/aprobaciones', help: 'aprobaciones',
        desc: L('El usuario ve en Aprobaciones el estado y el motivo.', 'The user sees the status and reason in Approvals.') },
      { id: 'A11', kind: 'end', label: L('Fin', 'End'), who: W.sistema, desc: L('', '') },
    ],
    edges: [
      ['A1', 'A2'], ['A2', 'A3', L('Sí', 'Yes')], ['A3', 'A11'], ['A2', 'A4', L('No', 'No')], ['A4', 'A5', L('Sí', 'Yes')], ['A5', 'A11'],
      ['A4', 'A6', L('No, editar', 'No, edit')], ['A6', 'A7'], ['A7', 'A8'], ['A8', 'A9', L('Sí', 'Yes')], ['A8', 'A10', L('No', 'No')],
      ['A9', 'A11'], ['A10', 'A11'],
    ],
    rules: [
      L('Los usuarios crean documentos y hacen los movimientos del día; no modifican documentos ya creados.', 'Users create documents and do daily movements; they do not modify existing documents.'),
      L('Toda modificación pasa por Aprobaciones y la autoriza Jorge.', 'Every modification goes through Approvals and Jorge authorizes it.'),
      L('Anular o borrar: exclusivo del administrador.', 'Void or delete: administrator only.'),
    ],
  },
];

// Procesos donde aparece una sección del manual (para el botón "Ver procedimiento").
export function procesosForHelp(helpId) {
  return PROCESOS.filter((p) => p.nodes.some((n) => n.help === helpId));
}

// Texto Mermaid del diagrama en el idioma pedido.
const SHAPE = {
  start: (t) => `(["${t}"])`, end: (t) => `(["${t}"])`, dec: (t) => `{"${t}"}`,
  step: (t) => `["${t}"]`, doc: (t) => `[/"${t}"/]`, admin: (t) => `["${t}"]`,
};
const clean = (s) => String(s || '').replace(/"/g, "'").replace(/[<>]/g, '');

export function mermaidFor(proc, lang) {
  const T = (o) => clean(o ? o[lang] || o.es : '');
  const lines = ['flowchart TD'];
  proc.nodes.forEach((n, i) => lines.push(`${n.id}${SHAPE[n.kind](`${i + 1}. ${T(n.label)}`)}:::k${n.kind === "end" ? "fin" : n.kind}`));
  proc.edges.forEach(([a, b, lbl]) => lines.push(lbl ? `${a} -->|"${T(lbl)}"| ${b}` : `${a} --> ${b}`));
  lines.push(
    'classDef kstart fill:#0f2742,stroke:#0f2742,color:#ffffff;',
    'classDef kfin fill:#0f2742,stroke:#0f2742,color:#ffffff;',
    'classDef kstep fill:#e8eef6,stroke:#1c3a5e,color:#1e293b;',
    'classDef kdec fill:#fef3c7,stroke:#d97706,color:#1e293b;',
    'classDef kdoc fill:#dcfce7,stroke:#16a34a,color:#1e293b;',
    'classDef kadmin fill:#fee2e2,stroke:#dc2626,color:#1e293b;',
  );
  return lines.join('\n');
}
