import React from 'react';

// Encabezado de marca que aparece en la parte superior de todos los documentos imprimibles
// (facturas, órdenes de trabajo, recepción de vehículo, pedidos). Los datos de contacto son
// fijos de la empresa (no cambian de un documento a otro), así que van directo en el código
// -un solo lugar para los cuatro documentos- en vez de tener que escribirlos cada vez.
export default function DocumentBrand() {
  return (
    <div className="invoice-brand">
      <img src="/nexpro-logo.png" alt="Nexpro Trucks & Equipment Corp." className="invoice-logo"
           onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
      <div className="invoice-brand-fallback" style={{ display: 'none' }}>
        <strong>NEXPRO TRUCKS &amp; EQUIPMENT CORP.</strong>
      </div>
      <div className="muted doc-brand-contact">
        <div>7380 NW 77th CT, Miami, FL 33166</div>
        <div>Tel: 786-631-5922 · Cel: 786-837-1612 · WhatsApp: 786-867-0496</div>
        <div>info@nexprotrucks.com · service@nexprotrucks.com</div>
      </div>
    </div>
  );
}
