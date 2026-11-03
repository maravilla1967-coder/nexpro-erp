import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { MANUAL } from '../help/manual.js';

// Manual de usuario: una sección por módulo (qué hace, pasos, consejos y problemas
// frecuentes), con buscador e índice. /ayuda#compras abre directo la sección de compras.
export default function HelpPage() {
  const { t, lang } = useI18n();
  const L = (o) => (o ? o[lang] || o.es : '');
  const location = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(() => new Set());

  // Abrir y llevar a la sección del enlace (#id).
  useEffect(() => {
    const id = decodeURIComponent((location.hash || '').slice(1));
    if (!id) return;
    setOpen((o) => new Set([...o, id]));
    setTimeout(() => { const el = document.getElementById(`help-${id}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }, [location.hash]);

  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const words = norm(q).split(/\s+/).filter(Boolean);
  const textOf = (s) => norm([L(s.title), L(s.summary), ...(s.tasks || []).flatMap((tk) => [L(tk.title), ...tk.steps.map(L)]),
    ...(s.tips || []).map(L), ...(s.problems || []).flatMap((p) => [L(p.q), L(p.a)])].join(' '));
  const visible = useMemo(() => MANUAL.filter((s) => !words.length || words.every((w) => textOf(s).includes(w))), [q, lang]);
  const isOpen = (id) => words.length > 0 || open.has(id);
  const toggle = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const mark = (txt) => {
    if (!words.length) return txt;
    const src = String(txt); const n = norm(src); const parts = []; let i = 0;
    while (i < src.length) {
      let hit = -1; let wl = 0;
      for (const w of words) { const k = n.indexOf(w, i); if (k !== -1 && (hit === -1 || k < hit)) { hit = k; wl = w.length; } }
      if (hit === -1) { parts.push(src.slice(i)); break; }
      parts.push(src.slice(i, hit)); parts.push(<mark key={hit}>{src.slice(hit, hit + wl)}</mark>); i = hit + wl;
    }
    return parts;
  };

  return (
    <>
      <div className="topbar no-print">
        <div><h1>{t('📘 Manual de usuario')}</h1><div className="sub">{t('Cómo funciona cada módulo del ERP, paso a paso, y qué hacer si algo no sale')}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setOpen(new Set(MANUAL.map((s) => s.id)))}>{t('Abrir todo')}</button>
          <button className="btn btn-primary" onClick={() => { setOpen(new Set(MANUAL.map((s) => s.id))); setTimeout(() => window.print(), 100); }}>{t('Imprimir / Guardar PDF')}</button>
        </div>
      </div>
      <div className="content help-page">
        <div className="toolbar no-print">
          <input className="search-input" style={{ flex: 1 }} autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t('🔎 ¿Qué necesitas hacer? Ej.: registrar pago, recibir orden, serial, faltante…')} />
          {q && <button className="btn btn-sm" onClick={() => setQ('')}>{t('Limpiar')}</button>}
        </div>
        <div className="help-layout">
          <nav className="help-index no-print">
            {MANUAL.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={visible.includes(s) ? '' : 'dim'}>{s.icon} {L(s.title)}</a>
            ))}
          </nav>
          <div className="help-sections">
            {visible.length === 0 && <div className="card empty-state">{t('No encontré nada con esas palabras. Prueba con otras (ej. "pago", "recibir", "factura").')}</div>}
            {visible.map((s) => (
              <section key={s.id} id={`help-${s.id}`} className="card help-section">
                <button type="button" className="help-head" onClick={() => toggle(s.id)}>
                  <span className="help-icon">{s.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <strong>{mark(L(s.title))}</strong>
                    <span className="muted help-summary">{mark(L(s.summary))}</span>
                  </span>
                  <span className="no-print muted">{isOpen(s.id) ? '▾' : '▸'}</span>
                </button>
                {isOpen(s.id) && (
                  <div className="help-body">
                    {s.routes && s.routes[0] && <div className="no-print" style={{ marginBottom: 8 }}><Link className="btn btn-sm" to={s.routes[0]}>{t('Ir a')} {L(s.title)} →</Link></div>}
                    {(s.tasks || []).map((tk, i) => (
                      <div key={i} className="help-task">
                        <h4>{mark(L(tk.title))}</h4>
                        <ol>{tk.steps.map((st, j) => <li key={j}>{mark(L(st))}</li>)}</ol>
                      </div>
                    ))}
                    {s.tips && s.tips.length > 0 && (
                      <div className="help-tips"><strong>💡 {t('Consejos')}</strong><ul>{s.tips.map((tp, i) => <li key={i}>{mark(L(tp))}</li>)}</ul></div>
                    )}
                    {s.problems && s.problems.length > 0 && (
                      <div className="help-problems"><strong>🛠️ {t('Problemas frecuentes')}</strong>
                        {s.problems.map((p, i) => <div key={i} className="help-problem"><div><strong>{mark(L(p.q))}</strong></div><div>{mark(L(p.a))}</div></div>)}
                      </div>
                    )}
                  </div>
                )}
              </section>
            ))}
            <div className="muted" style={{ fontSize: 13, margin: '6px 0 30px' }}>{t('¿No encuentras la respuesta? Escríbele al administrador del ERP describiendo qué estabas haciendo y, si puedes, con una captura de pantalla.')}</div>
          </div>
        </div>
      </div>
    </>
  );
}
