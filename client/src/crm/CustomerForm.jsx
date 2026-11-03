import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import { useI18n } from '../i18n.jsx';
import { ROLES, CONTACT_TYPES, splitRoles } from './constants.js';

export const EMPTY_CUSTOMER = {
  type: 'empresa', name: '', aliases: '', roles: ['potencial'], taxId: '', email: '', phone: '', phone2: '', website: '',
  address: '', city: '', state: 'FL', zip: '', industry: '', status: 'lead', source: '', notes: '', preferredLanguage: 'en',
};
export const EMPTY_CONTACT = { name: '', contactType: '', role: '', phone: '', mobile: '', email: '' };

export function customerToForm(c) {
  return {
    type: c.type || 'empresa', name: c.name || '', aliases: c.aliases || '', roles: splitRoles(c.roles).length ? splitRoles(c.roles) : ['cliente'],
    taxId: c.tax_id || '', email: c.email || '', phone: c.phone || '', phone2: c.phone2 || '', website: c.website || '',
    address: c.address || '', city: c.city || '', state: c.state || '', zip: c.zip || '', industry: c.industry || '',
    status: c.status || 'lead', source: c.source || '', notes: c.notes || '', preferredLanguage: c.preferred_language || 'en',
  };
}

// Aviso de clientes parecidos mientras se escribe: así nadie crea "Miami Dade" cuando ya
// existe "Miami-Dade Water & Sewer Department". "Usar este" abre el que ya está.
export function DuplicateWarning({ form, excludeId, onUse }) {
  const { t } = useI18n();
  const [dups, setDups] = useState([]);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    const hasSomething = (form.name || '').trim().length >= 2 || (form.phone || '').replace(/\D/g, '').length >= 7 || (form.email || '').includes('@') || (form.taxId || '').length >= 4;
    if (!hasSomething) { setDups([]); return undefined; }
    timer.current = setTimeout(() => {
      api.get('/crm/duplicates', { name: form.name, phone: form.phone, email: form.email, taxId: form.taxId, excludeId })
        .then(setDups).catch(() => setDups([]));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [form.name, form.phone, form.email, form.taxId, excludeId]);
  if (!dups.length) return null;
  const strong = dups[0].score >= 80;
  return (
    <div className="dup-box" style={{ borderColor: strong ? 'var(--orange)' : 'var(--border)' }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: strong ? 'var(--orange-dark)' : 'var(--navy)' }}>
        {strong ? t('⚠️ Este cliente parece que ya existe:') : t('Clientes parecidos que ya están en el ERP:')}
      </div>
      {dups.map((d) => (
        <div key={d.id} className="dup-row">
          <span style={{ flex: 1, minWidth: 0 }}>
            <strong>{d.name}</strong> <Pill value={d.status} />
            <span className="muted" style={{ fontSize: 12, display: 'block' }}>
              {[d.city, d.phone, d.email].filter(Boolean).join(' · ')} — {t('coincide por')} {t(d.reason)} ({d.score}%)
            </span>
          </span>
          {onUse && <button type="button" className="btn btn-sm btn-primary" onClick={() => onUse(d)}>{t('Usar este')}</button>}
        </div>
      ))}
    </div>
  );
}

// Formulario de cliente (crear o editar) con roles, alias, idioma y, al crear, la primera persona de contacto.
export default function CustomerForm({ form, setForm, excludeId, onUseExisting, withContact, contact, setContact }) {
  const { t } = useI18n();
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleRole = (k) => {
    const has = form.roles.includes(k);
    const roles = has ? form.roles.filter((r) => r !== k) : [...form.roles, k];
    let status = form.status;
    if (!has && k === 'cliente' && ['lead', 'prospecto'].includes(status)) status = 'cliente';
    setForm({ ...form, roles: roles.length ? roles : form.roles, status });
  };
  return (
    <>
      <div className="grid grid-2">
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>{t('Nombre completo de la empresa / persona *')}</label>
          <input required autoFocus value={form.name} onChange={f('name')} placeholder={t('Escribe el nombre completo, p. ej. Miami-Dade Water & Sewer Department')} />
        </div>
      </div>
      <DuplicateWarning form={form} excludeId={excludeId} onUse={onUseExisting} />
      <div className="field">
        <label>{t('¿Qué es para Nexpro? (puede ser varias)')}</label>
        <div className="qp-chips">
          {ROLES.map((r) => (
            <button key={r.key} type="button" className={`qp-chip ${form.roles.includes(r.key) ? 'on' : ''}`} onClick={() => toggleRole(r.key)}>
              {form.roles.includes(r.key) ? '✓ ' : ''}{t(r.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-2">
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>{t('Otros nombres / siglas con que lo conocen')}</label>
          <input value={form.aliases} onChange={f('aliases')} placeholder={t('p. ej. WASD, MDWASD, Water & Sewer (separados por coma)')} />
        </div>
        <div className="field">
          <label>{t('Tipo')}</label>
          <select value={form.type} onChange={f('type')}>
            <option value="empresa">{t('Empresa / Municipio')}</option>
            <option value="persona">{t('Persona')}</option>
          </select>
        </div>
        <div className="field">
          <label>{t('Estado')}</label>
          <select value={form.status} onChange={f('status')}>
            <option value="lead">{t('Lead')}</option>
            <option value="prospecto">{t('Prospecto')}</option>
            <option value="cliente">{t('Cliente')}</option>
            <option value="inactivo">{t('Inactivo')}</option>
          </select>
        </div>
        <div className="field"><label>{t('Teléfono principal')}</label><input value={form.phone} onChange={f('phone')} /></div>
        <div className="field"><label>{t('Otro teléfono')}</label><input value={form.phone2} onChange={f('phone2')} /></div>
        <div className="field"><label>{t('Email')}</label><input type="email" value={form.email} onChange={f('email')} /></div>
        <div className="field"><label>{t('Sitio web')}</label><input value={form.website} onChange={f('website')} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}><label>{t('Dirección')}</label><input value={form.address} onChange={f('address')} /></div>
        <div className="field"><label>{t('Ciudad')}</label><input value={form.city} onChange={f('city')} /></div>
        <div className="grid grid-2" style={{ gap: 10 }}>
          <div className="field"><label>{t('Estado (US)')}</label><input value={form.state} onChange={f('state')} placeholder="FL" /></div>
          <div className="field"><label>{t('Código postal')}</label><input value={form.zip} onChange={f('zip')} /></div>
        </div>
        <div className="field"><label>{t('Industria')}</label><input placeholder="municipal, utilities, construction..." value={form.industry} onChange={f('industry')} /></div>
        <div className="field"><label>{t('NIT / Identificación')}</label><input value={form.taxId} onChange={f('taxId')} /></div>
        <div className="field"><label>{t('Fuente')}</label><input placeholder={t('referido, web, llamada...')} value={form.source} onChange={f('source')} /></div>
        <div className="field">
          <label>{t('Idioma para los correos')}</label>
          <select value={form.preferredLanguage} onChange={f('preferredLanguage')}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
      </div>
      <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={f('notes')} /></div>
      {withContact && (
        <>
          <div className="form-section">{t('Persona de contacto (quien llamó)')}</div>
          <ContactFields value={contact} onChange={setContact} />
        </>
      )}
    </>
  );
}

export function ContactFields({ value, onChange, required }) {
  const { t } = useI18n();
  const f = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid grid-2">
      <div className="field"><label>{t('Nombre')}{required ? ' *' : ''}</label><input required={required} value={value.name || ''} onChange={f('name')} /></div>
      <div className="field">
        <label>{t('¿Quién es? (cargo)')}</label>
        <select value={value.contactType || ''} onChange={f('contactType')}>
          <option value="">—</option>
          {CONTACT_TYPES.map((c) => <option key={c.key} value={c.key}>{t(c.label)}</option>)}
        </select>
      </div>
      <div className="field"><label>{t('Cargo exacto')}</label><input value={value.role || ''} onChange={f('role')} placeholder="Fleet Manager, Shop Foreman…" /></div>
      <div className="field"><label>{t('Celular')}</label><input value={value.mobile || ''} onChange={f('mobile')} /></div>
      <div className="field"><label>{t('Teléfono / extensión')}</label><input value={value.phone || ''} onChange={f('phone')} /></div>
      <div className="field"><label>{t('Email')}</label><input type="email" value={value.email || ''} onChange={f('email')} /></div>
    </div>
  );
}
