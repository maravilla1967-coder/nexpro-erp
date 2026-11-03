import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Modal from '../components/Modal.jsx';
import { useI18n } from '../i18n.jsx';
import ListExportBar, { useListExport, SelectAllBox, RowBox } from '../components/ListExport.jsx';
const SUPPLIER_COLUMNS = [
  { label: 'Nombre', value: (r) => r.name },
  { label: 'Código', value: (r) => r.code, mono: true },
  { label: 'NIT', value: (r) => r.tax_id },
  { label: 'Email', value: (r) => r.email },
  { label: 'Teléfono', value: (r) => r.phone },
  { label: 'Dirección', value: (r) => r.address },
  { label: 'Ciudad', value: (r) => r.city },
  { label: 'ZIP', value: (r) => r.zip },
];

const EMPTY = {
  name: '', code: '', taxId: '', email: '', phone: '', address: '', city: '', zip: '', notes: '',
  beneficiaryName: '', beneficiaryAddress: '', bankName: '', bankAddress: '', abaRoutingNumber: '',
  accountNumber: '', accountType: '', swiftBic: '', bankContactName: '', bankContactPhone: '', bankContactEmail: '', bankNotes: '',
};

export default function SuppliersList() {
  const { t } = useI18n();
  const [list, setList] = useState([]);
  const ex = useListExport({ rows: list });
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  function load() { api.get('/suppliers', { q }).then(setList).catch(console.error); }
  useEffect(() => { load(); }, [q]);

  function openNew() { setEditing(null); setForm(EMPTY); setError(''); setModalOpen(true); }
  function openEdit(s) {
    setEditing(s);
    setForm({
      name: s.name, code: s.code || '', taxId: s.tax_id || '', email: s.email || '', phone: s.phone || '', address: s.address || '', city: s.city || '', zip: s.zip || '', notes: s.notes || '',
      beneficiaryName: s.beneficiary_name || '', beneficiaryAddress: s.beneficiary_address || '', bankName: s.bank_name || '', bankAddress: s.bank_address || '',
      abaRoutingNumber: s.aba_routing_number || '', accountNumber: s.account_number || '', accountType: s.account_type || '', swiftBic: s.swift_bic || '',
      bankContactName: s.bank_contact_name || '', bankContactPhone: s.bank_contact_phone || '', bankContactEmail: s.bank_contact_email || '', bankNotes: s.bank_notes || '',
    });
    setError(''); setModalOpen(true);
  }

  async function save(e) {
    e.preventDefault();
    try {
      if (editing) await api.put(`/suppliers/${editing.id}`, form);
      else await api.post('/suppliers', form);
      setModalOpen(false); load();
    } catch (err) { setError(err.message); }
  }
  async function remove(id) {
    if (!window.confirm(t('¿Eliminar este proveedor?'))) return;
    await api.del(`/suppliers/${id}`); load();
  }

  return (
    <>
      <div className="topbar">
        <div><h1>{t('Proveedores')}</h1><div className="sub">{t('Fuentes de compra para inventario')}</div></div>
        <button className="btn btn-primary" onClick={openNew}>{t('+ Nuevo proveedor')}</button>
      </div>
      <div className="content">
        <div className="toolbar"><input className="search-input" placeholder={t('Buscar…')} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="card">
          {list.length === 0 ? <div className="empty-state">{t('No hay proveedores todavía.')}</div> : (
            <><ListExportBar ex={ex} title={t('Proveedores')} filename="proveedores" columns={SUPPLIER_COLUMNS} />
            <table>
              <thead><tr><th><SelectAllBox ex={ex} /></th><th>{t('Nombre')}</th><th>{t('Código')}</th><th>{t('NIT')}</th><th>{t('Contacto')}</th><th></th></tr></thead>
              <tbody>
                {ex.visible.map((s) => (
                  <tr key={s.id}>
                    <td><RowBox ex={ex} row={s} /></td>
                    <td onClick={() => openEdit(s)} className="clickable"><strong>{s.name}</strong></td>
                    <td className="mono muted">{s.code || '—'}</td>
                    <td className="muted">{s.tax_id || '—'}</td>
                    <td className="muted">{s.email || s.phone || '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn-row-action edit" onClick={() => openEdit(s)}>{t('Editar')}</button>
                        <button className="btn-row-action delete" onClick={() => remove(s.id)}>{t('Eliminar')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></>
          )}
        </div>
      </div>

      {modalOpen && (
        <Modal title={editing ? t('Editar proveedor') : t('Nuevo proveedor')} onClose={() => setModalOpen(false)} wide>
          <form onSubmit={save}>
            {error && <div className="error-banner">{error}</div>}
            <div className="grid grid-2">
              <div className="field"><label>{t('Nombre *')}</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field">
                <label>{t('Código (2 letras)')}</label>
                <input maxLength={2} style={{ textTransform: 'uppercase' }} placeholder={t('Auto')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                <div className="hint">{t('Código corto del proveedor (opcional). Las órdenes de compra usan un consecutivo único de la empresa.')}</div>
              </div>
            </div>
            <div className="grid grid-2">
              <div className="field"><label>{t('NIT')}</label><input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} /></div>
              <div className="field"><label>{t('Email')}</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="field"><label>{t('Teléfono')}</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="field"><label>{t('Dirección')}</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="field"><label>{t('Ciudad')}</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div className="field"><label>{t('Código postal')}</label><input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

            <h3 style={{ marginTop: 20, marginBottom: 4, fontSize: 15 }}>{t('Información bancaria (ACH / Wire Transfer)')}</h3>
            <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t('Para hacer transferencias y pagos a este proveedor. Son datos sensibles: compártelos solo con quien procese los pagos.')}</div>
            <div className="grid grid-2">
              <div className="field">
                <label>{t('Beneficiario')}</label>
                <input value={form.beneficiaryName} onChange={(e) => setForm({ ...form, beneficiaryName: e.target.value })} placeholder={form.name} />
                <div className="hint">{t('Déjalo vacío si es el mismo nombre del proveedor.')}</div>
              </div>
              <div className="field"><label>{t('Dirección del beneficiario')}</label><input value={form.beneficiaryAddress} onChange={(e) => setForm({ ...form, beneficiaryAddress: e.target.value })} /></div>
              <div className="field"><label>{t('Banco / Institución financiera')}</label><input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
              <div className="field"><label>{t('Dirección del banco')}</label><input value={form.bankAddress} onChange={(e) => setForm({ ...form, bankAddress: e.target.value })} /></div>
              <div className="field"><label>{t('ABA / Routing Number')}</label><input value={form.abaRoutingNumber} onChange={(e) => setForm({ ...form, abaRoutingNumber: e.target.value })} /></div>
              <div className="field"><label>{t('Número de cuenta')}</label><input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></div>
              <div className="field">
                <label>{t('Tipo de cuenta')}</label>
                <select value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })}>
                  <option value="">{t('— No especificado —')}</option>
                  <option value="checking">{t('Checking')}</option>
                  <option value="savings">{t('Savings')}</option>
                </select>
              </div>
              <div className="field">
                <label>{t('SWIFT / BIC')}</label>
                <input value={form.swiftBic} onChange={(e) => setForm({ ...form, swiftBic: e.target.value })} />
                <div className="hint">{t('Solo para transferencias internacionales (wire). No aplica a ACH doméstico.')}</div>
              </div>
              <div className="field"><label>{t('Contacto para notificar el pago')}</label><input value={form.bankContactName} onChange={(e) => setForm({ ...form, bankContactName: e.target.value })} /></div>
              <div className="field"><label>{t('Teléfono del contacto')}</label><input value={form.bankContactPhone} onChange={(e) => setForm({ ...form, bankContactPhone: e.target.value })} /></div>
              <div className="field"><label>{t('Email del contacto')}</label><input type="email" value={form.bankContactEmail} onChange={(e) => setForm({ ...form, bankContactEmail: e.target.value })} /></div>
            </div>
            <div className="field"><label>{t('Notas bancarias adicionales')}</label><textarea rows={2} placeholder={t('Banco intermediario, referencia obligatoria, etc.')} value={form.bankNotes} onChange={(e) => setForm({ ...form, bankNotes: e.target.value })} /></div>

            <div className="modal-footer">
              <button type="button" className="btn" onClick={() => setModalOpen(false)}>{t('Cancelar')}</button>
              <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
