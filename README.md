# Nexpro ERP — Documentación del proyecto

ERP hecho a la medida para **Nexpro Trucks & Equipment Corp.** (upfitter de camiones en Miami):
facturación, órdenes de pedido, inventario, CRM completo, recepción de vehículos por VIN con
equipos instalados, catálogo de servicios y órdenes de trabajo por mecánico.

Este documento es la referencia completa del proyecto: qué existe, cómo está construido, cómo
se despliega y cómo continuar el trabajo si alguien más (persona o IA) retoma el desarrollo.

> Se tomó **MaxxSuite** como guía para el modelo de datos de productos/categorías, clientes,
> proveedores, facturación y órdenes de compra. El módulo "ingresar_vehiculo" de MaxxSuite es
> para un parqueadero y no aplicaba al taller de upfitting, así que la Recepción de Vehículos se
> construyó desde cero para el flujo real: VIN → equipos instalados en el chasis → mecánico →
> servicio.

---

## 1. Stack técnico

- **Backend:** Node.js + Express + SQLite nativo de Node (`node:sqlite`), sin dependencias
  nativas que compilar, cero configuración externa.
- **Frontend:** React + Vite (SPA), sin frameworks de UI pesados, estilos propios
  (`client/src/styles.css`).
- **Requisito:** Node.js **22.5 o superior** (usa el módulo nativo `node:sqlite`).
- **Hosting:** Railway, un solo servicio que sirve la API y el frontend compilado desde el
  mismo proceso/puerto. Ver sección 12.

## 2. Estructura del proyecto

```
nexpro-erp/
  package.json          orquestador raíz (build / start / seed)
  migration/             scripts usados UNA VEZ para migrar datos desde MaxxSuite (histórico,
                          no es parte de la app en ejecución — se puede archivar)
  server/
    .env                  DATABASE_URL, PORT (no se sube a git)
    db/
      schema.sql           definición de todas las tablas (CREATE TABLE IF NOT EXISTS)
      index.js             conexión + migraciones idempotentes (tryAlter) + arranque
      seed.js               datos de referencia de ejemplo (tipos de equipo, servicios, etc.)
      nexpro.db              archivo SQLite con los datos reales (en Railway vive en un volumen)
    src/
      index.js               arranque de Express, monta todas las rutas bajo /api
      modules.js              registro de los módulos/permisos (MODULE_KEYS)
      middleware/
        auth.js                requireAuth, requireAdmin, requireModuleEdit
        upload.js               subida de imágenes (multer)
      utils/
        auth.js                 hash de contraseñas, firma/verificación de tokens de sesión
        numbering.js             esquema de numeración de documentos (ver sección 9)
      routes/                  12 archivos, uno por módulo (ver sección 5)
    uploads/                 imágenes subidas (productos, vehículos)
  client/
    vite.config.js
    index.html
    public/                  logo e ícono de Nexpro
    dist/                    build compilado — se regenera solo, no se edita a mano
    src/
      main.jsx, App.jsx, api.js, auth.jsx, i18n.jsx, styles.css
      components/            piezas reutilizables (ver sección 5)
      pages/                  21 páginas, una por pantalla (ver sección 5)
```

## 3. Instalación y uso en desarrollo

```bash
# 1. Backend
cd server
npm install
npm run seed        # carga tipos de equipo, tipos de producto y servicios de ejemplo (solo 1ª vez)
npm run dev          # http://localhost:4000

# 2. Frontend (en otra terminal)
cd client
npm install
npm run dev          # http://localhost:5173 (con proxy automático al backend)
```

Abre `http://localhost:5173` durante el desarrollo. Al arrancar por primera vez sin usuarios en
la base de datos, el servidor crea automáticamente una cuenta de administrador y muestra en el
log una contraseña temporal — queda guardada en la tabla `users` con el correo que se use como
primer admin.

### Producción en un solo servidor (manual, sin Railway)

```bash
cd client && npm install && npm run build
cd ../server && npm install --omit=dev
npm start              # sirve la API y el frontend compilado en un solo puerto
```

La base de datos vive en `server/db/nexpro.db` (un solo archivo).

## 4. Autenticación, roles y permisos

- **Login:** correo + contraseña (`POST /api/auth/login`). Las contraseñas se guardan con hash
  `scrypt` + sal aleatoria (`server/src/utils/auth.js`), nunca en texto plano.
- **Sesión:** token firmado con HMAC-SHA256 (esquema propio, sin JWT ni librerías externas),
  válido 30 días. La clave de firma se genera sola la primera vez y se guarda en la tabla
  `app_settings`.
- **Cada request autenticado vuelve a consultar el usuario en la base de datos** (no confía solo
  en el token), así que si un admin desactiva a alguien, el efecto es inmediato aunque el token
  siga siendo válido.
- **Roles:** `admin` y `usuario`. Los usuarios nuevos se crean como `invitado`, reciben un enlace
  de invitación (válido 7 días) para poner su propia contraseña y activarse.
- **Permisos por módulo:** cada usuario no-admin tiene, por módulo (clientes, inventario,
  proveedores, compras, pedidos, facturas, vehículos, servicios, mecánicos,
  órdenes_trabajo), un permiso booleano de "puede editar". Ver/leer siempre está permitido para
  cualquier usuario activo; **escribir** requiere ser admin o tener ese permiso activado
  (se administra desde **Usuarios**, solo visible para admins).
- Solo se pueden crear usuarios con correo terminado en `@nexprotrucks.com`.

## 5. Módulos y funcionalidades (todo lo construido hasta ahora)

| Módulo | Pantallas | Qué hace |
|---|---|---|
| **Dashboard** | `/` | Totales (clientes, leads, productos, stock bajo, pedidos abiertos, facturas pendientes y su monto, vehículos en taller, órdenes de trabajo abiertas) + actividad reciente + vehículos recientes. |
| **CRM (Clientes)** | `/clientes`, `/clientes/:id` | Clientes/municipios, contactos, pipeline de oportunidades por etapas, actividades y tareas de seguimiento, vehículos vinculados. |
| **Inventario** | `/inventario` | Productos con foto, costo de compra, flete, margen de ganancia (precio = (costo+flete)/(1−margen%)), tipos de producto configurables, control de stock. |
| **Proveedores** | `/proveedores` | Catálogo de proveedores, con código de 2 letras (automático o manual) usado en la numeración de órdenes de compra. |
| **Compras** | `/compras` | Órdenes de compra a proveedores; al marcarlas "recibida" se suma automáticamente al stock del producto. |
| **Pedidos (órdenes de pedido)** | `/pedidos`, `/pedidos/:id/documento` | Cotizaciones/pedidos de clientes, documento imprimible, se pueden convertir en factura con un clic. |
| **Facturación** | `/facturas`, `/facturas/:id` | Facturas con impuesto, estado, vista imprimible lista para PDF. Puede generarse directo, desde un pedido, o desde una o varias órdenes de trabajo. Incluye el bloque opcional de datos de transferencia bancaria y el botón para traer líneas nuevas de la orden de trabajo (ver sección 8). |
| **Recepción de Vehículos** | `/vehiculos`, `/vehiculos/:id`, `/vehiculos/:id/documento` | Ingreso por VIN (rechaza VIN duplicado), datos del chasis, equipos instalados (grúas, compresores, bucket lifts, lift gates, etc.) con número de serie y fabricante — si el tipo de equipo no existe se crea al vuelo. Documento de recepción imprimible y firmable. |
| **Catálogo de Servicios** | `/servicios` | Servicios con nombre/descripción bilingüe, tarifa por hora o precio fijo por servicio completo. |
| **Mecánicos** | `/mecanicos` | Equipo de taller. |
| **Órdenes de Trabajo** | `/ordenes-trabajo`, `/ordenes-trabajo/:id/documento` | Se crean desde la ficha del vehículo, asignadas a un mecánico, con servicios (por hora o precio fijo) y partes/repuestos usados. Al marcarse "completada" el vehículo cambia de estado automáticamente. |
| **Aprobaciones** | `/aprobaciones` | Cuando un usuario no-admin edita o borra una factura o un pedido, el cambio queda pendiente aquí hasta que un admin lo apruebe o rechace (ver sección 8). |
| **Usuarios** | `/usuarios` | Solo admins: alta de usuarios (correo @nexprotrucks.com), rol, estado, grilla de permisos por módulo, reenvío de invitación. |

Todas las listas de referencia (tipos de equipo, tipos de producto, catálogo de servicios) se
pueden editar o ampliar libremente desde la aplicación — los datos que carga `npm run seed` son
solo un punto de partida.

### Componentes compartidos (`client/src/components/`)

- **DocumentBrand.jsx** — encabezado fijo de Nexpro (logo + dirección + teléfonos + correos) que
  aparece arriba en los cuatro documentos imprimibles (factura, pedido, recepción de vehículo,
  orden de trabajo). Si la imagen del logo no carga, muestra el nombre de la empresa en texto
  como respaldo.
- **LineItemsEditor.jsx** — editor de líneas (producto, cantidad, precio) reutilizado en
  facturas, pedidos y órdenes de compra.
- **Modal.jsx** — ventana modal genérica.
- **Pill.jsx** — etiqueta de estado con color (lead, pendiente, facturado, etc.), traducida.

## 6. Modelo de datos

Definido completo en `server/db/schema.sql`. Tablas principales:

`customers`, `contacts`, `opportunities`, `activities` — CRM
`product_types`, `products`, `suppliers` — inventario y proveedores
`purchase_orders` + `purchase_order_items` — compras
`sales_orders` + `sales_order_items` — pedidos
`invoices` + `invoice_items` — facturación (incluye `include_wire_info` e `invoice_id` enlazado desde `work_orders`)
`equipment_types`, `vehicles`, `vehicle_equipment` — vehículos y equipos instalados
`services`, `mechanics` — catálogos de taller
`work_orders` + `work_order_services` + `work_order_parts` — órdenes de trabajo
`users`, `user_permissions` — usuarios y permisos
`approval_requests` — cola de aprobación
`app_settings` — configuración interna (clave de firma de sesión)

**Cómo se agregan columnas nuevas a una base ya desplegada:** `server/db/index.js` corre el
`schema.sql` completo al arrancar (todo `CREATE TABLE IF NOT EXISTS`, no rompe nada si ya
existe) y después una lista de `tryAlter('ALTER TABLE ... ADD COLUMN ...')`, cada uno envuelto en
try/catch para que no truene si la columna ya existe. **Cualquier cambio futuro al esquema debe
seguir este mismo patrón**: editar `schema.sql` (para bases nuevas) + agregar una línea
`tryAlter` (para la base ya desplegada en producción) — no hay una herramienta de migraciones
con versiones.

## 7. Flujo de aprobaciones

Para **facturas** y **pedidos** específicamente: si un usuario no-admin con permiso de edición
en ese módulo intenta modificar o borrar un documento, el cambio **no se aplica de inmediato** —
se guarda en `approval_requests` con estado `pendiente` y el usuario recibe el mensaje "Los
cambios se enviaron para autorización del administrador." Un admin lo ve en **Aprobaciones** y
puede aprobarlo (se aplica tal cual se solicitó) o rechazarlo (con motivo opcional). El resto de
los módulos aplican los cambios de inmediato en cuanto el usuario tiene permiso de edición.

## 8. Documentos imprimibles: marca, transferencia bancaria y sincronización

- **Encabezado de marca:** los 4 documentos imprimibles (factura, pedido, recepción de vehículo,
  orden de trabajo) muestran arriba el logo y los datos de contacto de Nexpro
  (`DocumentBrand.jsx`), para que se vean profesionales y consistentes.
- **Márgenes de impresión:** el margen de página se fija por CSS propio (padding), no por
  `@page margin`, porque esa propiedad se interpreta distinto entre la vista previa en pantalla y
  la impresión/PDF real según el navegador — así el resultado es siempre el mismo. Los
  documentos largos (varias páginas) repiten el encabezado de la tabla en cada hoja y no cortan
  filas a la mitad.
- **Datos de transferencia bancaria (wire info):** en cada factura hay un botón para
  mostrar/ocultar un bloque con los datos de Truist Bank para recibir transferencias — opcional,
  no aparece a menos que se active.
- **Sincronizar factura con su orden de trabajo:** cuando una factura se generó desde una o
  varias órdenes de trabajo, aparece un botón "Agregar líneas nuevas de la orden de trabajo". Si
  después de facturar se agrega un servicio o parte nueva en la orden de trabajo (por ejemplo,
  una reparación que apareció durante el trabajo), ese botón trae esa línea nueva a la factura
  **sin tocar ni borrar** ninguna línea que ya estaba facturada — nunca se elimina nada de lo ya
  facturado, solo se agrega lo que falta (comparando por descripción, contando duplicados). Si no
  hay nada nuevo que agregar, avisa que ya está todo.

## 9. Numeración de documentos (`server/src/utils/numbering.js`)

Esquema activo: `nextDocNumber(table, typeCode)` genera `NX-<TIPO>-AAAAMMDD-NN`, por ejemplo
`NX-WO-20261009-01`. `<TIPO>` identifica el documento a simple vista: `WO` (orden de trabajo),
`QT` (pedido/cotización), `INV` (factura). El consecutivo `NN` es por día+tabla+tipo, calculado
buscando el máximo existente ese día (no es un contador guardado aparte).

- `asInvoiceNumber(quoteNumber)`: cuando una factura nace de un pedido, reutiliza la misma
  fecha+consecutivo, solo cambia `QT`→`INV` (ej. `NX-QT-20261009-01` → `NX-INV-20261009-01`), así
  se ve a simple vista qué factura viene de qué pedido.
- Las órdenes de compra usan otro esquema, `nextPoNumber(vendorCode)`: `NX-<código de 2 letras
  del proveedor>-<consecutivo de 3 dígitos>` (ej. `NX-AC-001`).
- Hay funciones heredadas (`nextNumber`, `withStageSuffix`, `stripStageSuffix`) del formato
  anterior (`NX-AAAAMMDD-NN` con sufijo `-1`/`-2`) que siguen usándose como respaldo para
  documentos viejos — no quitarlas.

## 10. Idioma (Español / Inglés)

`client/src/i18n.jsx` — diccionario con ~280 textos en español como clave y su traducción al
inglés como valor. `useI18n()` expone `lang` y `toggle()`; la función `t(texto)` devuelve el
inglés si `lang === 'en'`, o el texto en español tal cual si no. Hay un botón de idioma en la
barra lateral. Al agregar un texto nuevo a la interfaz, debe registrarse en el diccionario para
que el toggle de idioma lo traduzca.

## 11. Despliegue en producción (Railway)

El sistema corre en **Railway**, desplegado directo desde GitHub:

- **Repositorio:** `maravilla1967-coder/nexpro-erp`, rama `main`.
- **Build:** `npm install --prefix client && npm run build --prefix client && npm install --prefix server --omit=dev` (compila el frontend y deja listas las dependencias del backend).
- **Arranque:** `npm start --prefix server` — un solo proceso sirve la API y el frontend compilado.
- **Base de datos:** SQLite en archivo, montado en un volumen persistente de Railway (variable `DATABASE_FILE`) — no se necesita base de datos externa.
- **Variables de entorno en Railway:** `DATABASE_FILE`, `UPLOADS_DIR`.
- **Despliegue automático:** el servicio está conectado para desplegar solo cada vez que hay un push a `main` en GitHub — no hace falta entrar al panel de Railway para nada.
- **Flujo real de trabajo hasta ahora:** los cambios se desarrollan y prueban, se preparan como commit en la copia del repositorio en la Mac de Jorge, y **Jorge hace el `git push origin main` manualmente** (por seguridad, nadie más tiene las credenciales de GitHub de Jorge) — ese es el único paso manual; Railway toma el push y despliega solo.
- **URL de producción actual:** `https://nexpro-erp-production.up.railway.app`
- **Dominio propio:** se está configurando `erp.nexprotrucks.com` (ver sección 12) para que la dirección se vea profesional en vez de la URL genérica de Railway.

## 12. Dominio propio — erp.nexprotrucks.com (en progreso)

El DNS de `nexprotrucks.com` está en **GoDaddy** (nameservers `ns07`/`ns08.domaincontrol.com`),
administrado por otra persona (no Jorge), lo cual ha sido un cuello de botella también para
publicar el sitio web de la empresa. Para activar `erp.nexprotrucks.com` faltan agregar estos dos
registros DNS ahí (ya generados desde Railway, quedan fijos mientras no se borre el dominio en
Railway):

| Tipo | Nombre | Valor |
|---|---|---|
| CNAME | `erp` | `payg6u6y.up.railway.app` |
| TXT | `_railway-verify.erp` | `railway-verify=7cf0fff6d56208c41a5a79222b4aab1211f4591e4d02a32574edbf5485eed84c` |

En cuanto estén esos registros, Railway emite el certificado solo y la dirección queda activa.

## 13. Cómo se ha trabajado en este proyecto (para quien continúe)

- El desarrollo se ha hecho con ayuda de Claude: se prueba cada cambio de extremo a extremo
  (pruebas automáticas contra un servidor local + verificación visual con un navegador real)
  antes de entregarlo.
- No hay un framework de migraciones de base de datos — cualquier cambio de esquema sigue el
  patrón `tryAlter` descrito en la sección 6.
- No hay suite de tests automatizados permanente en el repositorio; la verificación de cada
  cambio se hace de forma manual/ad-hoc (levantar el servidor local, probar los endpoints, probar
  en el navegador) antes de cada entrega. **Si alguien retoma el proyecto formalmente, valdría la
  pena agregar un set de pruebas automatizadas real** (hoy no existe).
- `client/dist/` es un artefacto compilado que queda versionado en el repo — se regenera solo con
  el script `build`, no se edita a mano.
- La carpeta `migration/` es historial de la migración de datos desde MaxxSuite, no es parte de
  la aplicación en ejecución — se puede archivar o quitar del árbol principal cuando ya no haga
  falta como referencia.

## 14. Historial de cambios importantes (más reciente primero)

- **Sincronizar factura con orden de trabajo:** botón para traer a una factura ya generada las
  líneas nuevas que se agreguen después en su orden de trabajo, sin tocar lo ya facturado. De
  paso se corrigió un error donde actualizar una factura (por ejemplo con el botón de
  transferencia) sin recargar la página dejaba en blanco la sección de datos del cliente en
  pantalla.
- **Corrección de márgenes de impresión:** el margen se veía bien en pantalla pero se corría al
  imprimir/generar PDF — se fijó por CSS propio en vez de depender de `@page margin`.
- **Datos de contacto en todos los documentos:** correo, dirección y teléfonos de Nexpro arriba
  en los 4 documentos imprimibles, centralizados en `DocumentBrand.jsx`.
- **Datos de transferencia bancaria opcionales en la factura:** botón para mostrar/ocultar el
  bloque de Truist Bank.

## 15. Pendientes / ideas a futuro

- Agregar pruebas automatizadas permanentes al repositorio (hoy la verificación es manual en
  cada entrega).
- Terminar de activar `erp.nexprotrucks.com` en cuanto se agreguen los registros DNS en GoDaddy
  (sección 12).
- Evaluar si vale la pena mover el acceso de GoDaddy a alguien con más disponibilidad, ya que ha
  frenado tanto la publicación del sitio web como el dominio propio del ERP.
- Si el volumen de datos crece mucho o se necesita acceso concurrente pesado, el modelo de datos
  ya está listo para migrar de SQLite a Postgres si hace falta más adelante.
