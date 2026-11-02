import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import CustomerSnapshot, { RolePills } from '../crm/CustomerSnapshot.jsx';
import CatalogQuickPick from '../crm/CatalogQuickPick.jsx';
import MessageComposer from '../crm/MessageComposer.jsx';
import RequestFiles from '../crm/RequestFiles.jsx';
import CustomerForm, { EMPTY_CUSTOMER, EMPTY_CONTACT, ContactFields } from '../crm/CustomerForm.jsx';
import { CHANNELS, PRIORITIES, contactTypeLabel, digits } from '../crm/constants.js';

const KIND_ICON = { cliente: '🏢', contacto: '👤', vehiculo: '🚚', equipo: '🏗️', proveedor: '🏭' };

// Atender llamada / nueva solicitud: se busca a quien llama (por teléfono, nombre, VIN o serie),
// se ve todo lo del cliente al instante y se registra lo que pide escogiéndolo de la lista.
export default function CallConsole() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [customerId, setCustomerId] = useState(params.get('cliente') || '');
  const [data, setData] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);
  const [newContact, setNewContact] = useState(EMPTY_CONTACT);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // solicitud recién creada
  const [composer, setComposer] = useState(null);
  const timer = useRef(null);

  // Formulario de la solicitud
  const blank = { contactId: params.get('contacto') || '', channel: 'llamada', items: [], notes: '', priority: 'normal', vehicleId: '', replyTo: '', createQuote: true };
  const [rq, setRq] = useState(blank);
  const [newPerson, setNewPerson] = useState(null); // datos de una persona nueva que llama
  const [pendingFiles, setPendingFiles] = useState([]);

  const loadCatalog = () => api.get('/crm/catalog').then(setCatalog).catch(() => {});
  useEffect(() => { loadCatalog(); }, []);

  function load360(id) {
    if (!id) { setData(null); return; }
    api.get(`/crm/customers/${id}/360`).then(setData).catch((e) => setError(e.message));
  }
  useEffect(() => { load360(customerId); }, [customerId]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits([]); return undefined; }
    setSearching(true);
    timer.current = setTimeout(() => {
      api.get('/crm/lookup', { q }).then((h) => { setHits(h); setSearching(false); }).catch(() => setSearching(false));
    }, 200);
    return () => clearTimeout(timer.current);
  }, [q]);

  // Al escoger contacto: el medio de respuesta se llena solo
  useEffect(() => {
    if (!data) return;
    const k = data.contacts.find((x) => String(x.id) === String(rq.contactId));
    const email = (k && k.email) || data.customer.email || '';
    const phone = (k && (k.mobile || k.phone)) || data.customer.phone || '';
    setRq((r) => ({ ...r, replyTo: r.channel === 'email' ? email : (['texto', 'whatsapp', 'llamada'].includes(r.channel) ? phone : r.replyTo) }));
  }, [rq.contactId, rq.channel, data]);

  async function pick(h) {
    setError('');
    let id = h.customer_id;
    if (h.kind === 'proveedor') {
      const r = await api.post(`/crm/from-supplier/${h.supplier_id}`, {});
      id = r.id;
    }
    if (!id) { setError(t('Ese vehículo no tiene cliente asignado. Asígnalo desde la recepción del vehículo.')); return; }
    selectCustomer(id, h.contact_id || '', h.vehicle_id || '');
  }
  function selectCustomer(id, contactId = '', vehicleId = '') {
    setCustomerId(String(id));
    setRq({ ...blank, contactId: contactId ? String(contactId) : '', vehicleId: vehicleId ? String(vehicleId) : '' });
    setNewPerson(null); setCreating(false); setDone(null); setHits([]); setQ('');
    setParams({ cliente: String(id) });
  }

  function startCreate() {
    const isPhone = digits(q).length >= 7 && !/[a-z]{3,}/i.test(q);
    setNewCustomer({ ...EMPTY_CUSTOMER, name: isPhone ? '' : q.trim(), phone: isPhone ? q.trim() : '' });
    setNewContact(EMPTY_CONTACT);
    setCreating(true); setCustomerId(''); setData(null); setDone(null);
  }
  async function saveNewCustomer(e) {
    e.preventDefault(); setError('');
    try {
      const c = await api.post('/customers', { ...newCustomer, firstContact: newContact });
      const full = await api.get(`/crm/customers/${c.id}/360`);
      const first = full.contacts[0];
      selectCustomer(c.id, first ? first.id : '');
    } catch (err) { setError(err.message); }
  }

  async function saveRequest(e) {
    e.preventDefault(); setError('');
    try {
      let contactId = rq.contactId;
      if (rq.contactId === 'nuevo') {
        if (!newPerson || !newPerson.name || !newPerson.name.trim()) { setError(t('Escribe el nombre de la persona que llama')); return; }
        const k = await api.post(`/customers/${customerId}/contacts`, newPerson);
        contactId = k.id;
      }
      let r = await api.post('/crm/requests', {
        customerId, contactId: contactId || null, channel: rq.channel, notes: rq.notes, priority: rq.priority,
        vehicleId: rq.vehicleId || null, replyTo: rq.replyTo, createQuote: rq.createQuote && rq.items.length > 0,
        items: rq.items.map((i) => ({ ...i, quantity: parseFloat(i.quantity) || 1 })),
      });
      if (pendingFiles.length) {
        const fd = new FormData();
        pendingFiles.forEach((f) => fd.append('files', f));
        try { r = await api.postForm(`/crm/requests/${r.id}/files`, fd); } catch (upErr) { setError(`${t('La solicitud se guardó, pero no se pudieron subir los archivos:')} ${upErr.message}`); }
      }
      setDone(r);
      setComposer(r);
      setRq(blank); setNewPerson(null); setPendingFiles([]);
      load360(customerId);
    } catch (err) { setError(err.message); }
  }

  const contact = data && data.contacts.find((x) => String(x.id) === String(rq.contactId));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t('Atender llamada')}</h1>
          <div className="sub">{t('Busca a quien llama, mira todo su historial y registra lo que necesita')}</div>
        </div>
        <Link to="/crm/solicitudes" className="btn">{t('Ver solicitudes')}</Link>
      </div>
      <div className="content">
        {error && <div className="error-banner">{error}</div>}
        <div className="call-search card">
          <input className="call-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t('📞 Teléfono, nombre de la empresa o de la persona, VIN, placa o número de serie…')} />
          {q.trim().length >= 2 && (
            <div className="call-hits">
              {searching && hits.length === 0 && <div className="muted" style={{ padding: 10 }}>{t('Buscando…')}</div>}
              {!searching && hits.length === 0 && <div className="muted" style={{ padding: 10 }}>{t('No se encontró a nadie con eso.')}</div>}
              {hits.map((h, i) => (
                <div key={i} className="call-hit" onClick={() => pick(h)}>
                  <span style={{ fontSize: 18 }}>{KIND_ICON[h.kind] || '•'}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong>{h.title}</strong> {h.roles && <RolePills roles={h.roles} />}
                    {h.contact_type && <span className="muted" style={{ fontSize: 12 }}> · {t(contactTypeLabel(h.contact_type))}</span>}
                    <div className="muted" style={{ fontSize: 12 }}>{h.subtitle}</div>
                  </span>
                  <span className="muted" style={{ fontSize: 11 }}>{t({ cliente: 'Cliente', contacto: 'Persona', vehiculo: 'Vehículo', equipo: 'Equipo', proveedor: 'Proveedor (sin ficha CRM)' }[h.kind])}</span>
                </div>
              ))}
              <div className="call-hit" onClick={startCreate} style={{ color: 'var(--orange-dark)', fontWeight: 700 }}>
                ＋ {t('No está: crear cliente / contacto nuevo')} {q.trim() && `“${q.trim()}”`}
              </div>
            </div>
          )}
        </div>

        {creating && (
          <div className="card" style={{ maxWidth: 900 }}>
            <div className="card-title">{t('Cliente nuevo')}</div>
            <form onSubmit={saveNewCustomer}>
              <CustomerForm form={newCustomer} setForm={setNewCustomer} withContact contact={newContact} setContact={setNewContact}
                onUseExisting={(d) => selectCustomer(d.id)} />
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setCreating(false)}>{t('Cancelar')}</button>
                <button type="submit" className="btn btn-primary">{t('Crear y registrar la solicitud')}</button>
              </div>
            </form>
          </div>
        )}

        {data && !creating && (
          <div className="call-grid">
            <div className="card"><CustomerSnapshot data={data} selectedContactId={rq.contactId} onPickContact={(id) => setRq({ ...rq, contactId: String(id) })} /></div>
            <div className="card">
              {done && (
                <div className="notice-banner" style={{ background: '#dcfce7', color: '#166534' }}>
                  ✓ {t('Solicitud')} <Link to={`/crm/solicitudes?abrir=${done.id}`} className="mono">{done.number}</Link> {t('registrada')}
                  {done.sales_order_id && <> · {t('orden de pedido')} <Link to={`/pedidos?abrir=${done.sales_order_id}`} className="mono">{done.sales_order_number}</Link> {t('lista para revisar y cotizar')}</>}
                  . <button type="button" className="link-btn" onClick={() => setComposer(done)}>{t('Enviar acuse')}</button>
                </div>
              )}
              <div className="card-title">{t('Nueva solicitud')}</div>
              <form onSubmit={saveRequest}>
                <div className="grid grid-2">
                  <div className="field">
                    <label>{t('¿Quién llama / escribe?')}</label>
                    <select value={rq.contactId} onChange={(e) => { setRq({ ...rq, contactId: e.target.value }); setNewPerson(e.target.value === 'nuevo' ? { ...EMPTY_CONTACT } : null); }}>
                      <option value="">{t('— Sin especificar —')}</option>
                      {data.contacts.map((k) => <option key={k.id} value={k.id}>{k.name}{k.contact_type ? ` (${t(contactTypeLabel(k.contact_type))})` : ''}</option>)}
                      <option value="nuevo">{t('＋ Persona nueva…')}</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>{t('Por dónde llegó')}</label>
                    <select value={rq.channel} onChange={(e) => setRq({ ...rq, channel: e.target.value })}>
                      {CHANNELS.map((c) => <option key={c.key} value={c.key}>{c.icon} {t(c.label)}</option>)}
                    </select>
                  </div>
                </div>
                {newPerson && (
                  <div className="sub-card">
                    <ContactFields value={newPerson} onChange={setNewPerson} required />
                  </div>
                )}
                {contact && <div className="muted" style={{ fontSize: 12.5, margin: '-4px 0 10px' }}>{[t(contactTypeLabel(contact.contact_type)), contact.role, contact.mobile || contact.phone, contact.email].filter(Boolean).join(' · ')}</div>}

                <div className="field">
                  <label>{t('¿Qué está buscando?')}</label>
                  <CatalogQuickPick catalog={catalog} value={rq.items} onChange={(items) => setRq({ ...rq, items })} onCatalogChange={loadCatalog} />
                </div>
                <div className="field">
                  <label>{t('Detalles de la conversación')}</label>
                  <textarea rows={3} value={rq.notes} onChange={(e) => setRq({ ...rq, notes: e.target.value })}
                    placeholder={t('Chasis, capacidad, para cuándo lo necesita, presupuesto, quién decide…')} />
                </div>
                <div className="field">
                  <label>{t('Documentos y fotos del cliente')}</label>
                  <RequestFiles pending={pendingFiles} onPendingChange={setPendingFiles} />
                </div>
                <div className="grid grid-2">
                  <div className="field">
                    <label>{t('Vehículo relacionado')}</label>
                    <select value={rq.vehicleId} onChange={(e) => setRq({ ...rq, vehicleId: e.target.value })}>
                      <option value="">—</option>
                      {data.vehicles.map((v) => <option key={v.id} value={v.id}>{v.vin} {[v.year, v.make, v.model].filter(Boolean).join(' ')}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>{t('Prioridad')}</label>
                    <select value={rq.priority} onChange={(e) => setRq({ ...rq, priority: e.target.value })}>
                      {PRIORITIES.map((p) => <option key={p} value={p}>{t(p)}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ gridColumn: '1 / -1' }}>
                    <label>{t('Responder a (correo o teléfono por donde llegó)')}</label>
                    <input value={rq.replyTo} onChange={(e) => setRq({ ...rq, replyTo: e.target.value })} />
                  </div>
                </div>
                <label className="check-line">
                  <input type="checkbox" checked={rq.createQuote} onChange={(e) => setRq({ ...rq, createQuote: e.target.checked })} />
                  {t('Pide precio: crear la orden de pedido para revisarla y cotizar')}
                </label>
                <div className="modal-footer">
                  <button type="button" className="btn" onClick={() => navigate(`/clientes/${customerId}`)}>{t('Abrir ficha')}</button>
                  <button type="submit" className="btn btn-primary">{t('Guardar solicitud y preparar correo')}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {!data && !creating && q.trim().length < 2 && (
          <div className="empty-state">{t('Empieza a escribir el teléfono o el nombre de quien llama. Si no existe, lo creas aquí mismo sin duplicarlo.')}</div>
        )}
      </div>
      {composer && <MessageComposer request={composer} kind="acuse" onClose={() => setComposer(null)} onSent={(r) => setDone(r)} />}
    </>
  );
}
