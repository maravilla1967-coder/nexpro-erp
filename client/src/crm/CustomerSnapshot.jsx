import React from 'react';
import { Link } from 'react-router-dom';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import { splitRoles, roleLabel, contactTypeLabel, interactionIcon, money, shortDate } from './constants.js';

// El estado solo se muestra cuando aporta algo (lead / prospecto / inactivo); "cliente" ya lo dice el rol.
export function StatusPill({ status }) {
  if (!status || status === 'cliente') return null;
  return <Pill value={status} />;
}

export function RolePills({ roles }) {
  const { t } = useI18n();
  const COLORS = { cliente: 'green', potencial: 'blue', proveedor: 'orange', dealer: 'amber' };
  return (
    <>
      {splitRoles(roles).map((r) => <span key={r} className={`pill ${COLORS[r] || 'gray'}`} style={{ marginRight: 4 }}>{t(roleLabel(r))}</span>)}
    </>
  );
}

// Resumen de todo lo que hay que saber del cliente mientras está en la línea.
export default function CustomerSnapshot({ data, selectedContactId, onPickContact }) {
  const { t } = useI18n();
  const { customer: c, contacts, summary: s, requests, interactions, vehicles } = data;
  const open = requests.filter((r) => ['nueva', 'en_proceso', 'cotizada'].includes(r.status));
  return (
    <div className="snap">
      <div className="snap-head">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{c.name}</div>
          <div style={{ marginTop: 4 }}><RolePills roles={c.roles} /> <StatusPill status={c.status} /></div>
          {c.aliases && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('También:')} {c.aliases}</div>}
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
            {[c.phone, c.phone2, c.email].filter(Boolean).join(' · ')}
            {(c.address || c.city) && <div>{[c.address, c.city, c.state, c.zip].filter(Boolean).join(', ')}</div>}
          </div>
        </div>
        <Link className="btn btn-sm" to={`/clientes/${c.id}`}>{t('Ficha completa →')}</Link>
      </div>

      <div className="snap-kpis">
        <div><span>{t('Saldo por cobrar')}</span><strong className={s.balance_due > 0 ? 'alert' : ''}>{money(s.balance_due)}</strong>{s.overdue > 0 && <em>{t('vencido')} {money(s.overdue)}</em>}</div>
        <div><span>{t('Facturado total')}</span><strong>{money(s.total_invoiced)}</strong></div>
        <div><span>{t('Solicitudes abiertas')}</span><strong>{s.open_requests}</strong></div>
        <div><span>{t('Vehículos / equipos')}</span><strong>{s.vehicles} / {s.equipment}</strong></div>
      </div>

      <div className="snap-sec">{t('Personas')} ({contacts.length})</div>
      {contacts.length === 0 && <div className="muted" style={{ fontSize: 13 }}>{t('Sin contactos todavía.')}</div>}
      {contacts.map((k) => (
        <div key={k.id} className={`snap-contact ${String(selectedContactId) === String(k.id) ? 'on' : ''}`} onClick={() => onPickContact && onPickContact(k.id)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{k.name}</strong>{k.is_primary ? ' ★' : ''} <span className="muted" style={{ fontSize: 12 }}>{[t(contactTypeLabel(k.contact_type)), k.role].filter(Boolean).join(' · ')}</span>
            <div className="muted" style={{ fontSize: 12 }}>{[k.mobile, k.phone, k.email].filter(Boolean).join(' · ')}</div>
          </div>
          {onPickContact && <span className="muted" style={{ fontSize: 11 }}>{String(selectedContactId) === String(k.id) ? t('está llamando') : t('¿es quien llama?')}</span>}
        </div>
      ))}

      {open.length > 0 && (
        <>
          <div className="snap-sec">{t('Solicitudes abiertas')}</div>
          {open.map((r) => (
            <div key={r.id} className="snap-line">
              <Link to={`/crm/solicitudes?abrir=${r.id}`} className="mono">{r.number}</Link> <Pill value={r.status} />
              <span className="muted"> {shortDate(r.created_at)} · {r.contact_name || '—'}</span>
              <div style={{ fontSize: 12.5 }}>{r.items.map((i) => i.description).join(', ') || r.subject}</div>
            </div>
          ))}
        </>
      )}

      {vehicles.length > 0 && (
        <>
          <div className="snap-sec">{t('Vehículos y equipos')}</div>
          {vehicles.slice(0, 8).map((v) => (
            <div key={v.id} className="snap-line">
              <Link to={`/vehiculos/${v.id}`} className="mono">{v.vin}</Link> <span className="muted">{[v.year, v.make, v.model].filter(Boolean).join(' ')}{v.contact_name ? ` · ${v.contact_name}` : ''}</span>
              {v.equipment.length > 0 && <div style={{ fontSize: 12.5 }}>{v.equipment.map((e) => `${e.type_name || t('Equipo')}${e.serial_number ? ` S/N ${e.serial_number}` : ''}`).join(' · ')}</div>}
              {v.work_orders[0] && <div className="muted" style={{ fontSize: 12 }}>{t('Último servicio:')} {v.work_orders[0].number} ({shortDate(v.work_orders[0].created_at)}) — {v.work_orders[0].services.map((x) => x.description).join(', ') || v.work_orders[0].diagnosis || ''}</div>}
            </div>
          ))}
        </>
      )}

      {interactions.length > 0 && (
        <>
          <div className="snap-sec">{t('Últimas interacciones')}</div>
          {interactions.slice(0, 6).map((a) => (
            <div key={a.id} className="snap-line">
              <span>{interactionIcon(a.type)}</span> <span className="muted">{shortDate(a.occurred_at || a.created_at)}</span> {a.subject}
              {a.contact_name && <span className="muted"> — {a.contact_name}</span>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
