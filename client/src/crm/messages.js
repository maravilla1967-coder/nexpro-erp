// Plantillas de mensajes al cliente: acuse de recibo de la solicitud y envío de la cotización.
// En inglés por defecto (clientes en EE. UU.); en español si el cliente lo prefiere.

const SIGNATURE = {
  en: (user) => `Best regards,\n${user ? `${user}\n` : ''}Nexpro Trucks & Equipment Corp.\n7380 NW 77th CT, Miami, FL 33166\nTel: 786-631-5922 · Cell: 786-837-1612 · WhatsApp: 786-867-0496\ninfo@nexprotrucks.com · nexprotrucks.com`,
  es: (user) => `Cordial saludo,\n${user ? `${user}\n` : ''}Nexpro Trucks & Equipment Corp.\n7380 NW 77th CT, Miami, FL 33166\nTel: 786-631-5922 · Cel: 786-837-1612 · WhatsApp: 786-867-0496\ninfo@nexprotrucks.com · nexprotrucks.com`,
};

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

// Nombre del ítem en el idioma del correo (los servicios tienen su nombre en inglés guardado)
const itemName = (i, lang) => String((lang === 'en' && i.service_name_en) || i.description).replace(/ \(por cotizar\)$/, '');
function itemLines(items, lang) {
  return (items || []).map((i) => `  • ${Number(i.quantity) !== 1 ? `${i.quantity} × ` : ''}${itemName(i, lang)}`).join('\n');
}

export function ackMessage({ lang = 'en', customer, contact, request, userName }) {
  const name = firstName(contact && contact.name);
  const list = itemLines(request.items, lang);
  if (lang === 'es') {
    return {
      subject: `Recibimos su solicitud ${request.number} — Nexpro Trucks`,
      body: `${name ? `Hola ${name},` : `Estimado cliente,`}\n\nGracias por contactar a Nexpro Trucks & Equipment. Recibimos su solicitud${customer ? ` para ${customer.name}` : ''} y ya estamos buscando la mejor solución para usted.\n${list ? `\nLo que nos pidió:\n${list}\n` : ''}${request.notes ? `\nDetalles: ${request.notes}\n` : ''}\nEn breve le enviaremos la información${request.sales_order_id ? ' y la cotización' : ''}. Su número de referencia es ${request.number}.\n\n${SIGNATURE.es(userName)}`,
      sms: `Hola${name ? ` ${name}` : ''}, Nexpro Trucks recibió su solicitud ${request.number}${list ? ` (${(request.items || []).map((i) => itemName(i, lang)).join(', ')})` : ''}. Ya estamos trabajando en ella y le contactamos pronto. Tel 786-631-5922`,
    };
  }
  return {
    subject: `We received your request ${request.number} — Nexpro Trucks`,
    body: `${name ? `Hi ${name},` : 'Hello,'}\n\nThank you for contacting Nexpro Trucks & Equipment. We have received your request${customer ? ` for ${customer.name}` : ''} and we are already working on the right solution for you.\n${list ? `\nWhat you asked for:\n${list}\n` : ''}${request.notes ? `\nDetails: ${request.notes}\n` : ''}\nWe will follow up shortly with the information${request.sales_order_id ? ' and your quote' : ''}. Your reference number is ${request.number}.\n\n${SIGNATURE.en(userName)}`,
    sms: `Hi${name ? ` ${name}` : ''}, Nexpro Trucks received your request ${request.number}${list ? ` (${(request.items || []).map((i) => itemName(i, lang)).join(', ')})` : ''}. We're working on it and will get back to you soon. Tel 786-631-5922`,
  };
}

export function quoteMessage({ lang = 'en', customer, contact, request, userName }) {
  const name = firstName(contact && contact.name);
  const total = Number(request.sales_order_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (lang === 'es') {
    return {
      subject: `Cotización ${request.sales_order_number || ''} — solicitud ${request.number} — Nexpro Trucks`,
      body: `${name ? `Hola ${name},` : 'Estimado cliente,'}\n\nCon gusto le enviamos la cotización ${request.sales_order_number || ''} correspondiente a su solicitud ${request.number}${customer ? ` para ${customer.name}` : ''}, por un total de $${total} (se adjunta en PDF).\n\nQuedamos atentos a cualquier pregunta o ajuste que necesite.\n\n${SIGNATURE.es(userName)}`,
      sms: `Hola${name ? ` ${name}` : ''}, le enviamos por correo la cotización ${request.sales_order_number || ''} de su solicitud ${request.number} por $${total}. Cualquier pregunta: 786-631-5922 — Nexpro Trucks`,
    };
  }
  return {
    subject: `Quote ${request.sales_order_number || ''} — request ${request.number} — Nexpro Trucks`,
    body: `${name ? `Hi ${name},` : 'Hello,'}\n\nPlease find attached quote ${request.sales_order_number || ''} for your request ${request.number}${customer ? ` for ${customer.name}` : ''}, for a total of $${total}.\n\nLet us know if you have any questions or need any changes.\n\n${SIGNATURE.en(userName)}`,
    sms: `Hi${name ? ` ${name}` : ''}, we emailed you quote ${request.sales_order_number || ''} for request ${request.number} — total $${total}. Questions? 786-631-5922 — Nexpro Trucks`,
  };
}

// Outlook web (Microsoft 365) — abre el mensaje ya escrito en la cuenta de Outlook con la que se
// esté conectado en el navegador (je.ramirez@nexprotrucks.com), en una pestaña nueva.
export const outlookHref = (to, subject, body) => `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to || '')}&subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
export const mailtoHref = (to, subject, body) => `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject || '')}&body=${encodeURIComponent(body || '')}`;
export const smsHref = (phone, body) => `sms:${String(phone || '').replace(/[^\d+]/g, '')}${/iPhone|iPad|Mac/i.test(navigator.userAgent) ? '&' : '?'}body=${encodeURIComponent(body || '')}`;
export const whatsappHref = (phone, body) => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = `1${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(body || '')}`;
};
