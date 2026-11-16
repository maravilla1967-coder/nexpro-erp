import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';
import { api } from '../api.js';
import { useI18n } from '../i18n.jsx';
import { money } from './constants.js';

const STAGES = ['nuevo', 'calificado', 'propuesta', 'negociacion', 'ganado', 'perdido'];
const isPdf = (f) => /pdf/i.test(f.mime_type || f.type || '') || /\.pdf$/i.test(f.original_name || f.name || '');

// Oportunidad: datos, documentos (cotizaciones preliminares hechas en Design, fichas, fotos) y
// "Convertir en cotización del ERP": el ERP lee el PDF y propone las líneas (producto, descripción,
// cantidad y precio) para revisarlas y crear la cotización. Lo puede hacer cualquier usuario.
export default function OpportunityModal({ customerId, opportunityId, onClose, onChanged }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const isNew = !opportunityId;
  const [o, setO] = useState(null);
  const [form, setForm] = useState({ title: '', value: '', probability: '', stage: 'nuevo', expectedClose: '', notes: '' });
  const [pending, setPending] = useState([]);
  const [convert, setConvert] = useState(null); // { fileId, parsed, lines }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef(null);

  function load(id = opportunityId) {
    if (!id) return;
    api.get(`/crm/opportunities/${id}`).then((x) => {
      setO(x);
      setForm({ title: x.title || '', value: x.value ?? '', probability: x.probability ?? '', stage: x.stage || 'nuevo', expectedClose: x.expected_close || '', notes: x.notes || '' });
    }).catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, [opportunityId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function addFiles(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    setError('');
    if (isNew) {
      setPending((p) => [...p, ...files]);
      // Con la primera cotización en PDF se llenan solos el título y el valor
      const pdf = files.find(isPdf);
      if (pdf && (!form.title || !form.value)) {
        const fd = new FormData(); fd.append('file', pdf);
        try {
          const r = await api.postForm('/crm/parse-quote', fd);
          setForm((f) => ({ ...f, title: f.title || r.equipment || r.reference || (r.items[0] && r.items[0].description) || '', value: f.value || (r.total ?? '') }));
        } catch (_) { /* se llena a mano */ }
      }
      return;
    }
    const fd = new FormData(); files.forEach((f) => fd.append('files', f));
    setBusy(true);
    try { setO(await api.postForm(`/crm/opportunities/${o.id}/files`, fd)); onChanged && onChanged(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function save(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      let id = opportunityId;
      if (isNew) {
        const created = await api.post(`/customers/${customerId}/opportunities`, form);
        id = created.id;
        if (pending.length) { const fd = new FormData(); pending.forEach((f) => fd.append('files', f)); await api.postForm(`/crm/opportunities/${id}/files`, fd); }
      } else {
        await api.put(`/customers/opportunities/${id}`, form);
      }
      onChanged && onChanged();
      if (isNew) { setPending([]); load(id); onClose(); } else load(id);
    } catch (err) { if (!err.pendingApproval) setError(err.message); } finally { setBusy(false); }
  }

  async function removeFile(f) {
    if (!window.confirm(`${t('¿Quitar el archivo')} ${f.original_name}?`)) return;
    try { await api.del(`/crm/opportunities/${o.id}/files/${f.id}`); load(); } catch (e) { if (!e.pendingApproval) setError(e.message); }
  }

  async function startConvert(f) {
    setError(''); setBusy(true);
    try {
      const parsed = f.parsed && f.parsed.items ? f.parsed : await api.get(`/crm/opportunity-files/${f.id}/parse`);
      const lines = parsed.items.length
        ? parsed.items.map((i) => ({ description: i.description, details: i.details || '', quantity: i.quantity || 1, unitPrice: i.unitPrice ?? '' }))
        : [{ description: o.title, details: '', quantity: 1, unitPrice: o.value || '' }];
      setConvert({ fileId: f.id, fileName: f.original_name, parsed, lines });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const setLine = (i, patch) => setConvert((c) => ({ ...c, lines: c.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  async function createQuote() {
    setError(''); setBusy(true);
    try {
      const r = await api.post(`/crm/opportunities/${o.id}/quote`, { fileId: convert.fileId, items: convert.lines });
      onChanged && onChanged();
      navigate(`/pedidos?abrir=${r.salesOrderId}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!isNew && !o) return <Modal title={t('Oportunidad')} onClose={onClose}>{error ? <div className="error-banner">{error}</div> : t('Cargando…')}</Modal>;

  // ----- Paso: revisar líneas leídas del PDF -----
  if (convert) {
    const total = convert.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);
    const pdfTotal = convert.parsed.total;
    return (
      <Modal title={`${t('Convertir en cotización del ERP')} · ${o.title}`} onClose={() => setConvert(null)} xwide>
        {error && <div className="error-banner">{error}</div>}
        <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
          {t('Leído de')} <strong>{convert.fileName}</strong>{convert.parsed.quoteNumber ? ` (${convert.parsed.quoteNumber})` : ''}. {t('Revisa y corrige si hace falta; luego pulsa "Crear cotización".')}
        </div>
        {(convert.parsed.warnings || []).map((w, i) => <div key={i} className="notice-banner" style={{ fontSize: 12.5 }}>⚠️ {w}</div>)}
        <table>
          <thead><tr><th>{t('Producto')}</th><th>{t('Descripción')}</th><th style={{ width: 80 }}>{t('Cant.')}</th><th style={{ width: 150 }}>{t('Precio unitario')}</th><th className="text-right">{t('Total')}</th><th /></tr></thead>
          <tbody>
            {convert.lines.map((l, i) => (
              <tr key={i}>
                <td><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                <td><input value={l.details} onChange={(e) => setLine(i, { details: e.target.value })} /></td>
                <td><input type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></td>
                <td><input type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} /></td>
                <td className="text-right">{money((Number(l.quantity) || 0) * (Number(l.unitPrice) || 0))}</td>
                <td><button type="button" className="link-btn" style={{ color: 'var(--red)' }} onClick={() => setConvert((c) => ({ ...c, lines: c.lines.filter((_, j) => j !== i) }))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <button type="button" className="btn btn-sm" onClick={() => setConvert((c) => ({ ...c, lines: [...c.lines, { description: '', details: '', quantity: 1, unitPrice: '' }] }))}>{t('+ Agregar línea')}</button>
          <div style={{ fontSize: 15 }}>
            <strong>{t('Total')}: {money(total)}</strong>
            {pdfTotal != null && Math.abs(pdfTotal - total) > 0.01 && <span className="text-danger" style={{ fontSize: 12.5, marginLeft: 8 }}>({t('el PDF dice')} {money(pdfTotal)})</span>}
            {pdfTotal != null && Math.abs(pdfTotal - total) <= 0.01 && <span style={{ fontSize: 12.5, marginLeft: 8, color: 'var(--green)' }}>✓ {t('igual al PDF')}</span>}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={() => setConvert(null)}>{t('Volver')}</button>
          <button type="button" className="btn btn-primary" onClick={createQuote} disabled={busy || !convert.lines.length}>{busy ? t('Creando…') : t('🧾 Crear cotización')}</button>
        </div>
      </Modal>
    );
  }

  const files = o ? o.files : [];
  return (
    <Modal title={isNew ? t('Nueva oportunidad') : `${t('Oportunidad')} · ${o.title}`} onClose={onClose} wide>
      <form onSubmit={save}>
        {error && <div className="error-banner">{error}</div>}
        <div className="field"><label>{t('Título *')}</label><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ZETLA AS-135A, ALTEC AT37-G…" /></div>
        <div className="grid grid-2">
          <div className="field"><label>{t('Valor estimado ($)')}</label><input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} /></div>
          <div className="field"><label>{t('Probabilidad (%)')}</label><input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></div>
          <div className="field"><label>{t('Etapa')}</label><select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>{STAGES.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></div>
          <div className="field"><label>{t('Cierre esperado')}</label><input type="date" value={form.expectedClose} onChange={(e) => setForm({ ...form, expectedClose: e.target.value })} /></div>
        </div>
        <div className="field"><label>{t('Notas')}</label><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

        <div className="form-section">{t('Cotizaciones y documentos')}</div>
        <div className="drop-zone" onClick={() => fileInput.current && fileInput.current.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
          {busy && !isNew ? t('Subiendo…') : t('📎 Arrastra aquí la cotización preliminar (PDF) u otros documentos, o haz clic para escogerlos')}
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        {isNew && pending.length > 0 && (
          <div className="file-grid">
            {pending.map((f, i) => (
              <div key={i} className="file-tile">
                <span className="file-ico">{isPdf(f) ? '📄' : '📎'}</span>
                <span className="file-name" title={f.name}>{f.name}</span>
                <span className="muted" style={{ fontSize: 11 }}>{t('se sube al guardar')}</span>
                <button type="button" className="file-x" onClick={() => setPending(pending.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        )}
        {!isNew && files.length > 0 && (
          <div className="opp-files">
            {files.map((f) => (
              <div key={f.id} className="opp-file">
                <a href={f.file_url} target="_blank" rel="noreferrer" className="opp-file-name">{isPdf(f) ? '📄' : '📎'} {f.original_name}</a>
                <span className="muted" style={{ fontSize: 12 }}>
                  {String(f.created_at).slice(0, 10)}{f.created_by_name ? ` · ${f.created_by_name}` : ''}
                  {f.parsed && f.parsed.quoteNumber ? ` · ${f.parsed.quoteNumber}` : ''}{f.parsed && f.parsed.total ? ` · ${money(f.parsed.total)}` : ''}
                </span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {f.sales_order_id
                    ? <Link className="btn btn-sm" to={`/pedidos?abrir=${f.sales_order_id}`}>🧾 {f.sales_order_number}</Link>
                    : isPdf(f) && <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => startConvert(f)}>{t('🧾 Convertir en cotización del ERP')}</button>}
                  <button type="button" className="link-btn admin-only" style={{ color: 'var(--red)' }} onClick={() => removeFile(f)}>✕</button>
                </span>
              </div>
            ))}
          </div>
        )}
        {!isNew && o.sales_order_id && (
          <div className="notice-banner" style={{ background: '#eef2ff', color: '#1e3a8a', marginTop: 10 }}>
            {t('Cotización del ERP de esta oportunidad:')} <Link to={`/pedidos?abrir=${o.sales_order_id}`} className="mono">{o.sales_order_number}</Link> · {money(o.sales_order_total)}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{isNew ? t('Cancelar') : t('Cerrar')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{t('Guardar')}</button>
        </div>
      </form>
    </Modal>
  );
}
