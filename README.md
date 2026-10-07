# Nexpro ERP

ERP simple hecho a la medida de Nexpro Trucks & Equipment Corp.: facturación, órdenes de pedido,
inventario, CRM completo, recepción de vehículos por VIN con equipos instalados, catálogo de
servicios y órdenes de trabajo por mecánico.

Se tomó **MaxxSuite** como guía para el modelo de datos de productos/categorías, clientes,
proveedores, facturación y órdenes de compra (campos como costo, margen, categoría, código interno,
etc. siguen esa misma lógica). El módulo "ingresar_vehiculo" de MaxxSuite es para un parqueadero y
no aplicaba a tu caso de taller de upfitting, así que la Recepción de Vehículos se construyó desde
cero para tu flujo real: VIN → equipos instalados en el chasis → mecánico → servicio.

## Stack técnico

- **Backend:** Node.js + Express + SQLite nativo de Node (`node:sqlite`, sin dependencias nativas
  que compilar, cero configuración).
- **Frontend:** React + Vite (SPA), sin frameworks pesados, estilos propios.
- **Requisito:** Node.js 22.5 o superior (usa el módulo `node:sqlite`).

## Estructura

```
nexpro-erp/
  server/     API REST (Express) + base de datos SQLite
  client/     Interfaz web (React)
```

## Instalación y uso en desarrollo

```bash
# 1. Backend
cd server
npm install
npm run seed        # carga tipos de equipo, tipos de producto y servicios de ejemplo
npm run dev          # http://localhost:4000

# 2. Frontend (en otra terminal)
cd client
npm install
npm run dev          # http://localhost:5173 (con proxy automático al backend)
```

Abre `http://localhost:5173` durante el desarrollo.

## Uso en producción (un solo servidor)

```bash
cd client && npm install && npm run build
cd ../server && npm install
npm run seed          # solo la primera vez
npm start              # sirve la API y el frontend compilado en un solo puerto
```

Por defecto corre en el puerto 4000 (configurable con la variable `PORT`). La base de datos vive en
`server/db/nexpro.db` (un solo archivo — haz respaldo de este archivo periódicamente).

## Desplegar en Railway

1. Crea un servicio nuevo en Railway apuntando a la carpeta `server/`.
2. Antes de desplegar, corre `npm run build` dentro de `client/` y súbelo junto con `server/`
   (o agrega un paso de build que compile `client` y copie `client/dist` dentro de `server`).
3. Variables de entorno: `PORT` (Railway la define sola) — no se necesita ninguna base de datos
   externa porque usa SQLite en archivo. Si prefieres una base de datos administrada más adelante,
   dímelo y migramos este mismo modelo a Postgres.
4. Railway te da un dominio público; apunta tu DNS si quieres usar tu propio dominio.

## El logo de Nexpro en las facturas

Las facturas están preparadas para mostrar siempre el logo de Nexpro. Para que aparezca:

1. Coloca tu archivo de logo (PNG o SVG) en `client/public/nexpro-logo.png`.
2. Vuelve a compilar el frontend (`npm run build`).

Mientras no exista ese archivo, la factura muestra automáticamente el nombre de la empresa en texto
como respaldo, para que el documento nunca salga sin identificación de marca.

## Módulos incluidos

- **CRM:** clientes/municipios, contactos, oportunidades (pipeline por etapas), actividades y tareas
  de seguimiento.
- **Inventario:** productos con foto, costo de compra, flete, margen de ganancia (precio de venta =
  (costo + flete) / (1 − margen); con 30% de margen equivale a Costo/.70), tipos de producto
  configurables para agrupar.
- **Compras:** proveedores y órdenes de compra; al marcar una orden como "recibida" se suma
  automáticamente al stock del producto.
- **Pedidos (órdenes de pedido):** pedidos de clientes que se pueden convertir en factura con un
  clic.
- **Facturación:** facturas con impuesto, estado (pendiente/pagada), vista imprimible lista para
  generar PDF desde el navegador (Imprimir → Guardar como PDF).
- **Recepción de Vehículos:** ingreso por VIN, datos del chasis, y relación de equipos instalados
  (grúas, compresores, bucket lifts, lift gates, etc.) con número de serie y fabricante. Si el tipo
  de equipo no existe en la lista, se crea al vuelo desde el mismo formulario.
- **Catálogo de Servicios:** servicios con tarifa por hora o por servicio completo.
- **Mecánicos:** equipo de taller.
- **Órdenes de Trabajo:** se crean desde la ficha del vehículo, se les asigna un mecánico y uno o
  varios servicios (cada línea puede ser por horas o por precio fijo), calculando el total
  automáticamente.

Todas las listas de referencia (tipos de equipo, tipos de producto, catálogo de servicios) se pueden
editar o ampliar libremente desde la aplicación — los datos de ejemplo cargados por `npm run seed`
son solo un punto de partida.

## Próximos pasos sugeridos

- Conectar un dominio y desplegar en Railway para que el equipo lo use desde cualquier lugar.
- Agregar autenticación (usuarios/contraseña) si más de una persona va a usar el sistema.
- Migrar de SQLite a Postgres si el volumen de datos crece mucho o si se necesita acceso
  concurrente pesado (el modelo de datos ya está listo para ese cambio).
