// Importación única de las órdenes de compra históricas que Jorge llevaba en un Excel
// de control (Control_Ordene_de_Compra.xlsx), para que queden en el ERP con la numeración
// NX-<2 letras del proveedor>-<consecutivo> y el consecutivo de cada proveedor continúe
// correctamente a partir de ahí para las órdenes nuevas.
//
// Se corre una sola vez: revisa la bandera 'historical_pos_imported' en app_settings antes
// de hacer nada, y la deja puesta al terminar. Es seguro que esta función se llame en cada
// arranque del servidor (como seed.js): después de la primera vez no vuelve a insertar nada.
//
// Notas sobre los datos de origen:
// - Se unificaron variantes de nombre del mismo proveedor escritas de forma distinta en el
//   Excel (ej. "Hydraulic Sypply" -> "Hydraulic Supply", "Hydradaine" -> "Hydradyne",
//   "Florida Power Train" -> "Florida Powertrain", "Stucchi" -> "Stucchi USA").
// - Se asignaron códigos de 2 letras distintos cuando dos proveedores distintos del Excel
//   comparten las mismas 2 primeras letras de su nombre, para que la numeración no se mezcle
//   entre ellos (ej. Stanley=ST vs Stucchi USA=SC, Kanga=KA vs Kalypac=KL, Continental
//   hydraulic=CH vs Coxreels=CX, CM=CM vs CMN Steel=CN, Fiedler=FI vs First Fleet Trucks=FF,
//   Gar-P=GP vs Gallegos Trailers=GL, Hydraulic Supply=HY vs Hydradyne=HD).
// - Estado del Excel -> estado en el ERP: Close -> recibida, Open/open -> enviada,
//   Void -> cancelado, Parcial -> recibida (se anota en notas que fue parcial).
// - Dos filas del Excel no tenían monto ni estado registrado; se importan como "borrador"
//   con una nota indicándolo, en vez de inventar un valor.
// - Una fila de Hydradyne tiene fecha 29/11/2029 en el Excel original (probable error de
//   tipeo, posiblemente 2023 dado el contexto de las filas vecinas). Se importó tal cual
//   aparece en el archivo original, sin corregirla, para no alterar un dato que Jorge no
//   confirmó. Conviene que la revise.

const { get, run, nowIso } = require('./index');
const { nextPoNumber } = require('../src/utils/numbering');

const HISTORICAL_POS = [
  { vendor: "Paladin", code: "PA", date: "2020-06-02", description: "Auger System", amount: 2278.3, status: "recibida", notes: "No tengo No." },
  { vendor: "Stanley", code: "ST", date: "2020-06-26", description: "Power Unit & Trush Pump", amount: 7864.79, status: "recibida", notes: "No tengo No." },
  { vendor: "Stanley", code: "ST", date: "2020-07-16", description: "Power Unit & Trush Pump & Hose", amount: 25069.63, status: "recibida", notes: "No tengo No." },
  { vendor: "Stanley", code: "ST", date: "2021-04-20", description: "Chain Saw & Pipe Clamp", amount: 3420.9, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2021-05-13", description: "Serices Truck Unit", amount: 23391.85, status: "recibida", notes: null },
  { vendor: "AlumaReel", code: "AL", date: "2021-05-25", description: "Skit Package", amount: 5470.0, status: "recibida", notes: null },
  { vendor: "Hannay reels", code: "HA", date: "2021-05-27", description: "N600 Reel Demo Unit", amount: 2221.0, status: "recibida", notes: null },
  { vendor: "Venco", code: "VE", date: "2021-07-29", description: "Equipment Colossus Project", amount: 123574.32, status: "recibida", notes: null },
  { vendor: "Paladin", code: "PA", date: "2021-07-29", description: "Equipment Colossus Project", amount: 171830.37, status: "recibida", notes: null },
  { vendor: "Stanley", code: "ST", date: "2021-07-29", description: "Equipment Colossus Project", amount: 102623.11, status: "recibida", notes: null },
  { vendor: "Kanga", code: "KA", date: "2021-07-30", description: "Equipment Colossus Project", amount: 167181.4, status: "recibida", notes: null },
  { vendor: "CMN Steel", code: "CN", date: "2021-10-11", description: "Automatic Bed Hight", amount: 42426.0, status: "recibida", notes: null },
  { vendor: "Knapheide", code: "KN", date: "2021-10-07", description: "Colossus Bodies", amount: 223778.9, status: "recibida", notes: null },
  { vendor: "Knapheide", code: "KN", date: "2021-10-07", description: "Colossus Bodies", amount: 43635.57, status: "recibida", notes: null },
  { vendor: "Kalypac", code: "KL", date: "2021-12-30", description: "Hydraulic Hose Reels", amount: 11644.77, status: "recibida", notes: null },
  { vendor: "CID", code: "CI", date: "2022-01-25", description: "Hydraulic Angle & CRB225 Braker", amount: 7755.0, status: "recibida", notes: null },
  { vendor: "CID", code: "CI", date: "2022-06-15", description: "Hydraulic Angle", amount: 4381.0, status: "cancelado", notes: null },
  { vendor: "CID", code: "CI", date: "2022-06-24", description: "CBR225 Braker", amount: 4043.0, status: "cancelado", notes: null },
  { vendor: "Kanga", code: "KA", date: "2022-03-31", description: "DW624-0014", amount: 131926.8, status: "recibida", notes: null },
  { vendor: "Hydradyne", code: "HD", date: "2022-06-22", description: "PTO & Pump, Hydraulic system", amount: 31282.75, status: "recibida", notes: null },
  { vendor: "Stanley", code: "ST", date: "2022-08-01", description: "Utility Chain and Pipe Clamp", amount: 19295.8, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2022-11-11", description: "Compresores Teco", amount: 26495.4, status: "recibida", notes: null },
  { vendor: "Kanga", code: "KA", date: "2022-11-28", description: "DT725", amount: 24322.5, status: "recibida", notes: null },
  { vendor: "Kanga", code: "KA", date: "2022-11-28", description: "Bucket & Trencher", amount: 5278.0, status: "recibida", notes: null },
  { vendor: "E.H. Wachs Utility", code: "EH", date: "2022-11-22", description: "TM-7 HD", amount: 52980.0, status: "recibida", notes: null },
  { vendor: "Knapheide", code: "KN", date: "2022-12-12", description: "Body Unit", amount: 15774.0, status: "recibida", notes: null },
  { vendor: "Kanga", code: "KA", date: "2022-12-20", description: "Ripper Blade", amount: 311.5, status: "recibida", notes: null },
  { vendor: "Gar-P", code: "GP", date: "2022-12-20", description: "Steel Flatbed Body", amount: 49000.0, status: "recibida", notes: null },
  { vendor: "Zetla", code: "ZE", date: "2022-01-13", description: "Bumpers", amount: 112838.4, status: "recibida", notes: null },
  { vendor: "Gar-P", code: "GP", date: "2023-02-24", description: "EM Series 3,300 Lbs", amount: 18360.0, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2023-03-22", description: "Services Kit", amount: 326.2, status: "recibida", notes: null },
  { vendor: "Venco", code: "VE", date: "2023-02-24", description: "Crane Control", amount: 1725.28, status: "recibida", notes: "No. Duplicado" },
  { vendor: "Vanair", code: "VA", date: "2023-04-14", description: "Valves Parts Check/ Discharge", amount: 351.4, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2023-05-15", description: "Saturn Block", amount: 695.16, status: "recibida", notes: null },
  { vendor: "Andor LLC", code: "AN", date: "2023-05-15", description: "Parts", amount: 7555.36, status: "recibida", notes: null },
  { vendor: "Pollarwater", code: "PO", date: "2023-05-15", description: "Key Fixed HDL", amount: 1137.1, status: "recibida", notes: null },
  { vendor: "Manufactor Distributors", code: "MA", date: "2023-05-25", description: "Hannay Reels", amount: 1944.56, status: "recibida", notes: null },
  { vendor: "DOA", code: "DO", date: "2023-06-10", description: "Hydrobox", amount: 6340.4, status: "recibida", notes: null },
  { vendor: "DOA", code: "DO", date: "2023-06-11", description: "Hydrobox", amount: 7132.95, status: "recibida", notes: "Euros" },
  { vendor: "Continental hydraulic", code: "CH", date: "2023-06-25", description: "Parts", amount: 1790.0, status: "recibida", notes: null },
  { vendor: "Continental hydraulic", code: "CH", date: "2023-06-25", description: "Parts", amount: 3487.0, status: "recibida", notes: null },
  { vendor: "Venco", code: "VE", date: "2023-08-09", description: "Control Battery", amount: 77.18, status: "recibida", notes: null },
  { vendor: "Florida Powertrain", code: "FL", date: "2023-09-05", description: "PTO & Pump", amount: 8792.45, status: "recibida", notes: null },
  { vendor: "Florida Powertrain", code: "FL", date: "2023-09-05", description: "PTO & Pump", amount: 49688.31, status: "recibida", notes: null },
  { vendor: "Coxreels", code: "CX", date: "2023-09-13", description: "Dual Hydraulic Reels", amount: 15467.87, status: "recibida", notes: null },
  { vendor: "DOA", code: "DO", date: "2023-09-18", description: "Hydrobox", amount: 22825.44, status: "recibida", notes: "Euros" },
  { vendor: "Stucchi USA", code: "SC", date: "2023-09-25", description: "Saturn Block", amount: 347.58, status: "recibida", notes: null },
  { vendor: "Hydraulic Supply", code: "HY", date: "2023-11-01", description: "Salami Stock", amount: 656.8, status: "recibida", notes: null },
  { vendor: "Hydraulic Supply", code: "HY", date: "2023-11-01", description: "Brand Valve", amount: 3387.7, status: "recibida", notes: null },
  { vendor: "Load King", code: "LO", date: "2023-11-01", description: "Crane Model 19-70", amount: 1670900.0, status: "recibida", notes: "11 unidades" },
  { vendor: "Load King", code: "LO", date: "2023-11-01", description: "Crane Model 35-100", amount: 240550.0, status: "recibida", notes: "1 unit" },
  { vendor: "Load King", code: "LO", date: "2023-11-01", description: "Crane Model 35-127M", amount: 301678.2, status: "recibida", notes: "1 unit" },
  { vendor: "Load King", code: "LO", date: "2023-11-01", description: "Crane Model 40-127RS", amount: 361775.2, status: "recibida", notes: "1 unit" },
  { vendor: "Hydradyne", code: "HD", date: "2023-11-29", description: "Labor Cost", amount: 9224.25, status: "recibida", notes: "Falta un numero era 10?" },
  { vendor: "Kanga", code: "KA", date: "2023-12-08", description: "Partes", amount: 448.35, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2024-01-18", description: "Saturn Block", amount: 347.58, status: "recibida", notes: null },
  { vendor: "Hydraulic Supply", code: "HY", date: "2024-01-30", description: "Walvoil and Port Pressure", amount: 3031.93, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2024-02-01", description: "Saturn Block", amount: 347.58, status: "recibida", notes: null },
  { vendor: "Venco", code: "VE", date: "2024-02-06", description: "Control Remote Modification", amount: 3478.54, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2024-02-27", description: "Saturn Block", amount: 1042.74, status: "recibida", notes: null },
  { vendor: "Dakota", code: "DA", date: "2024-03-07", description: "Valve Triuck Body", amount: 43958.0, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2024-04-08", description: "Saturn Block", amount: 1042.74, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2024-04-10", description: "Harrison Repair", amount: 314.0, status: "recibida", notes: null },
  { vendor: "Dakota", code: "DA", date: "2024-04-16", description: "Water Services Lakeland", amount: 33602.0, status: "cancelado", notes: "Update Order" },
  { vendor: "Dakota", code: "DA", date: "2024-04-17", description: "Water Services Lakeland", amount: 67204.0, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2024-05-16", description: "Harrison Repair", amount: 395.5, status: "recibida", notes: null },
  { vendor: "Hydradyne", code: "HD", date: "2029-11-29", description: "Equipment and Services", amount: 8942.39, status: "recibida", notes: "Enviada con la 138" },
  { vendor: "Hydradyne", code: "HD", date: null, description: "Services Truck 450", amount: 0.0, status: "borrador", notes: "Datos incompletos en el archivo original (faltaba monto y/o estado)." },
  { vendor: "Vanair", code: "VA", date: "2024-05-29", description: "Services Kit and Torsinal Coupling", amount: 452.2, status: "recibida", notes: null },
  { vendor: "Venco", code: "VE", date: "2025-01-25", description: "Electric Crane ET6K", amount: 24160.0, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2024-06-03", description: "Saturn Block", amount: 1042.74, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2024-07-10", description: "Saturn Block", amount: 1042.74, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2024-08-01", description: "Saturn Block", amount: 1390.32, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2024-10-01", description: "Lakeland Compressor", amount: 27646.0, status: "recibida", notes: null },
  { vendor: "Coxreels", code: "CX", date: "2023-10-01", description: "Hydrulic Reels", amount: 1740.06, status: "recibida", notes: null },
  { vendor: "Coxreels", code: "CX", date: "2023-10-24", description: "Dual Hydraulic Reels", amount: 1582.84, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2023-10-09", description: "Services Kit", amount: 641.2, status: "recibida", notes: null },
  { vendor: "Stanley", code: "ST", date: "2024-11-01", description: "Orden Puerto Rico", amount: 22231.12, status: "recibida", notes: null },
  { vendor: "DOA", code: "DO", date: "2025-01-06", description: "Hydrobox", amount: 3170.2, status: "recibida", notes: "Euros" },
  { vendor: "E.H. Wachs Utility", code: "EH", date: "2025-01-08", description: "TM-7 HD", amount: 51331.0, status: "recibida", notes: null },
  { vendor: "Venco", code: "VE", date: "2025-01-15", description: "Electric Crane ET6K", amount: 23343.2, status: "recibida", notes: null },
  { vendor: "Stucchi USA", code: "SC", date: "2025-02-19", description: "Saturn Block", amount: 695.16, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2025-04-09", description: "Services kit", amount: 469.5, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2025-05-20", description: "Compressor kit", amount: 264.0, status: "recibida", notes: null },
  { vendor: "Zetla", code: "ZE", date: "2025-05-22", description: "TM-7 HD Plus", amount: 8500.0, status: "recibida", notes: null },
  { vendor: "Dakota", code: "DA", date: "2025-05-01", description: "Water Services Lakeland", amount: 49740.0, status: "cancelado", notes: "Update Order" },
  { vendor: "Dakota", code: "DA", date: "2025-05-01", description: "Water Services Lakeland", amount: 24870.0, status: "recibida", notes: null },
  { vendor: "Stanley", code: "ST", date: "2025-06-11", description: "Submersible Pump", amount: 5824.86, status: "recibida", notes: null },
  { vendor: "DOA", code: "DO", date: "2025-06-16", description: "Hydrobox", amount: 17796.42, status: "recibida", notes: null },
  { vendor: "DOA", code: "DO", date: "2025-06-17", description: "Hydrobox", amount: 12685.0, status: "recibida", notes: null },
  { vendor: "Zetla", code: "ZE", date: "2025-07-22", description: "Zetla LJ-13T", amount: 36000.0, status: "recibida", notes: null },
  { vendor: "Dynaset", code: "DY", date: "2025-06-20", description: "Equipment", amount: 9366.95, status: "recibida", notes: "Euros" },
  { vendor: "Zetla", code: "ZE", date: "2025-07-22", description: "Zetla AS-150 & Math", amount: 52190.0, status: "recibida", notes: null },
  { vendor: "Zetla", code: "ZE", date: "2025-07-22", description: "AS-135, Uper Boom & Chassis Insulation", amount: 30350.0, status: "recibida", notes: null },
  { vendor: "Zetla", code: "ZE", date: "2025-07-22", description: "Bumper CM / MV", amount: 67546.0, status: "recibida", notes: null },
  { vendor: "Zetla", code: "ZE", date: "2025-08-22", description: "Bumper CM / MV; AS-150 & MatH", amount: 61556.0, status: "recibida", notes: null },
  { vendor: "Venco", code: "VE", date: "2025-08-11", description: "Electric Crane ET16K", amount: 33814.2, status: "recibida", notes: null },
  { vendor: "Fiedler", code: "FI", date: "2025-09-05", description: "Equipment", amount: 25892.25, status: "recibida", notes: null },
  { vendor: "Stanley", code: "ST", date: "2025-09-11", description: "11CC Pump", amount: 524.65, status: "recibida", notes: null },
  { vendor: "Kanga", code: "KA", date: "2025-09-24", description: "RIM", amount: 227.5, status: "recibida", notes: null },
  { vendor: "Kanga", code: "KA", date: "2025-09-30", description: "Wheel Studs", amount: 39.25, status: "recibida", notes: null },
  { vendor: "Custom Truck", code: "CU", date: "2025-11-11", description: "VST-7100-MHI", amount: 228501.0, status: "enviada", notes: null },
  { vendor: "Custom Truck", code: "CU", date: "2025-11-11", description: "VST-7100-MHI", amount: 228501.0, status: "enviada", notes: null },
  { vendor: "Custom Truck", code: "CU", date: "2025-11-11", description: "VST-7100-MHI", amount: 228501.0, status: "enviada", notes: null },
  { vendor: "Zetla", code: "ZE", date: "2025-10-14", description: "Bumper MV", amount: 9966.0, status: "recibida", notes: null },
  { vendor: "Custom Truck", code: "CU", date: "2025-11-11", description: "VST-52-MHI", amount: 143508.59, status: "enviada", notes: null },
  { vendor: "Custom Truck", code: "CU", date: "2025-11-11", description: "VST-52-MHI", amount: 143508.59, status: "enviada", notes: null },
  { vendor: "First Fleet Trucks", code: "FF", date: "2025-11-05", description: "Serco 8500", amount: 149570.0, status: "recibida", notes: "Se entrego a Resting ya facturado" },
  { vendor: "Vanair", code: "VA", date: "2025-11-12", description: "Torsinal Elements", amount: 508.2, status: "recibida", notes: "Entregado" },
  { vendor: "Vanair", code: "VA", date: "2025-12-15", description: "Repuestos Teco", amount: 70.7, status: "recibida", notes: "Entregado" },
  { vendor: "Vanair", code: "VA", date: "2025-12-16", description: "Repuestos Teco", amount: 224.0, status: "recibida", notes: "Entregado" },
  { vendor: "Custom Truck", code: "CU", date: "2025-12-23", description: "Terex Commander Digger", amount: 256519.0, status: "recibida", notes: "Entregado" },
  { vendor: "Dakota", code: "DA", date: "2025-12-26", description: "Water Liner Body", amount: 68682.0, status: "recibida", notes: "Entregado" },
  { vendor: "Kanga", code: "KA", date: "2026-10-12", description: "Decal", amount: 1175.0, status: "enviada", notes: null },
  { vendor: "Reading", code: "RE", date: "2026-01-20", description: "Bodies", amount: 100147.0, status: "recibida", notes: "Cambiada" },
  { vendor: "Reading", code: "RE", date: "2026-02-25", description: "Bodies", amount: 86850.0, status: "recibida", notes: "Entregado" },
  { vendor: "Reading", code: "RE", date: "2026-01-20", description: "Partes", amount: 24719.0, status: "recibida", notes: "Entregado" },
  { vendor: "CM", code: "CM", date: "2026-01-27", description: "Bodies", amount: 30128.04, status: "recibida", notes: "Entregado" },
  { vendor: "Berkol International LLC", code: "BE", date: "2026-01-22", description: "Aceite Shell Spirax S6 AXME 75W-90", amount: 25800.0, status: "recibida", notes: "Entregado" },
  { vendor: "Gallegos Trailers", code: "GL", date: "2026-02-12", description: "Dump Bodies.", amount: 46350.0, status: "enviada", notes: null },
  { vendor: "Kalypac", code: "KL", date: "2026-03-06", description: "Display Buyers", amount: 5170.04, status: "recibida", notes: "Entregado" },
  { vendor: "Epiroc Industrial", code: "EP", date: "2026-03-25", description: "Pieza Camion Columbus", amount: 1460.47, status: "recibida", notes: null },
  { vendor: "Sunrise Equipment", code: "SU", date: "2026-03-30", description: "Auger Camion Columbus", amount: 1753.58, status: "recibida", notes: "Entregada en Ohio, Camion Columbus" },
  { vendor: "Vanair", code: "VA", date: "2026-03-30", description: "Inventory - Show Room", amount: 37658.55, status: "recibida", notes: "Se han entregado parcialmente, falta un Itme que se entrega en Junio · Recepción parcial según el archivo original de control de compras." },
  { vendor: "Freightliner", code: "FR", date: "2026-03-31", description: "Asiento Colombs Trucks", amount: 1464.39, status: "recibida", notes: "Entregada en Ohio, Camion Columbus" },
  { vendor: "Hughes Equipment", code: "HU", date: "2026-04-01", description: "Extra job Columbus Unit", amount: 16780.0, status: "enviada", notes: null },
  { vendor: "Dakota", code: "DA", date: "2026-04-06", description: "Demo Services Unit", amount: 21871.0, status: "enviada", notes: null },
  { vendor: "Coxreels", code: "CX", date: "2026-04-08", description: "Reeles for Water Truck Miami", amount: 1472.94, status: "recibida", notes: "Entregado" },
  { vendor: "Custom Truck", code: "CU", date: "2026-04-29", description: "Servicio Grua 40-127", amount: 1453.28, status: "recibida", notes: "Entregado" },
  { vendor: "Stucchi USA", code: "SC", date: "2026-05-14", description: "Coneccion Blocks P/Water Liners", amount: 695.16, status: "recibida", notes: null },
  { vendor: "Kalypac", code: "KL", date: "2026-05-18", description: "Partes Charles", amount: 822.0, status: "recibida", notes: "Falta incluir shipement y comicion" },
  { vendor: "Custom Truck", code: "CU", date: "2026-05-20", description: "Part Warranty Air Conditionong", amount: 1323.75, status: "recibida", notes: null },
  { vendor: "Hydraulic Supply", code: "HY", date: "2026-05-19", description: "Valvula", amount: 77.0, status: "recibida", notes: null },
  { vendor: "CM", code: "CM", date: "2026-06-01", description: "Spart Part", amount: 250.44, status: "recibida", notes: "Ship" },
  { vendor: "Hydraulic Supply", code: "HY", date: "2026-06-03", description: "Valvula", amount: 0.0, status: "borrador", notes: "Datos incompletos en el archivo original (faltaba monto y/o estado)." },
  { vendor: "Florida Powertrain", code: "FL", date: "2026-06-03", description: "Instaletion Services", amount: 7272.8, status: "enviada", notes: "3636.40 P/c" },
  { vendor: "Hydradyne", code: "HD", date: "2026-06-03", description: "Servicion & Intalacion", amount: 8702.54, status: "enviada", notes: "4351.27 P/c" },
  { vendor: "Boomerang Rubber", code: "BO", date: "2026-06-05", description: "Rubber Mud Flap", amount: 934.0, status: "enviada", notes: null },
  { vendor: "Vanair", code: "VA", date: "2026-07-10", description: "Kit Services", amount: 207.9, status: "recibida", notes: null },
  { vendor: "Vanair", code: "VA", date: "2026-07-27", description: "Solenoide Valve", amount: 265.3, status: "recibida", notes: "Shipment $14.03" },
  { vendor: "Kalypac", code: "KL", date: "2026-07-29", description: "Partes Charles", amount: 2311.29, status: "recibida", notes: null },
  { vendor: "Hydraulic Supply", code: "HY", date: "2026-08-13", description: "Flow Control", amount: 203.59, status: "enviada", notes: null },
  { vendor: "Custom Truck", code: "CU", date: "2026-08-18", description: "Loak King Stinger Model 35-127RS QR-061024", amount: 382481.0, status: "enviada", notes: null },
];

function importHistoricalPOs() {
  const already = get("SELECT value FROM app_settings WHERE key = 'historical_pos_imported'");
  if (already) return;

  let created = 0;
  for (const row of HISTORICAL_POS) {
    let supplier = get('SELECT * FROM suppliers WHERE name = ?', [row.vendor]);
    if (!supplier) {
      run('INSERT INTO suppliers (name, code) VALUES (?,?)', [row.vendor, row.code]);
      supplier = get('SELECT * FROM suppliers WHERE name = ?', [row.vendor]);
    }
    const number = nextPoNumber(supplier.code || row.code);
    const createdAt = row.date ? `${row.date} 00:00:00` : nowIso();
    run(
      'INSERT INTO purchase_orders (number, supplier_id, status, order_date, notes, created_at) VALUES (?,?,?,?,?,?)',
      [number, supplier.id, row.status, row.date, row.notes, createdAt]
    );
    const po = get('SELECT * FROM purchase_orders WHERE number = ?', [number]);
    run(
      'INSERT INTO purchase_order_items (purchase_order_id, description, quantity, unit_cost) VALUES (?,?,?,?)',
      [po.id, row.description, 1, row.amount]
    );
    created += 1;
  }

  run("INSERT INTO app_settings (key, value) VALUES ('historical_pos_imported', ?)", [String(created)]);
  console.log(`Importación de órdenes de compra históricas completa: ${created} órdenes creadas.`);
}

module.exports = { importHistoricalPOs };
