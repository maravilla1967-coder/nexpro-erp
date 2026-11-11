import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import DocumentBrand from '../components/DocumentBrand.jsx';
import { PROCESOS, mermaidFor } from '../help/procesos.js';

// Procedimientos: el flujo completo de cada proceso de Nexpro dibujado con Mermaid y, al lado,
// el paso a paso (quién lo hace, en qué pantalla y qué hacer). /procedimientos#venta abre el
// proceso de venta. Clic en un cuadro del diagrama o en un paso de la lista resalta ese paso.

let mermaidPromise = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      const mermaid = m.default;
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: 'base',
        themeVariables: { fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', lineColor: '#64748b' },
        flowchart: { curve: 'basis', htmlLabels: false, useMaxWidth: true },
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}
let renderSeq = 0;

const KIND = {
  start: { es: 'Inicio', en: 'Start', cls: 'proc-kstart' }, end: { es: 'Fin', en: 'End', cls: 'proc-kstart' },
  step: { es: 'Paso', en: 'Step', cls: 'proc-kstep' }, dec: { es: 'Decisión', en: 'Decision', cls: 'proc-kdec' },
  doc: { es: 'Documento del ERP', en: 'ERP document', cls: 'proc-kdoc' }, admin: { es: 'Solo administrador', en: 'Administrator only', cls: 'proc-kadmin' },
};

export default function ProcessesPage() {
  const { lang } = useI18n();
  const L = (o) => (o ? o[lang] || o.es : '');
  const U = (es, en) => (lang === 'en' ? en : es);
  const location = useLocation();
  const navigate = useNavigate();

  const procId = decodeURIComponent((location.hash || '').slice(1));
  const proc = useMemo(() => PROCESOS.find((p) => p.id === procId) || PROCESOS[0], [procId]);
  const [step, setStep] = useState(0);
  const [svgVer, setSvgVer] = useState(0);
  const [error, setError] = useState('');
  const diagramRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { setStep(0); }, [proc.id]);

  // Dibujar el diagrama (Mermaid se carga solo en esta pantalla).
  useEffect(() => {
    let alive = true;
    setError('');
    loadMermaid()
      .then((mermaid) => mermaid.render(`proc-${++renderSeq}`, mermaidFor(proc, lang)))
      .then(({ svg }) => {
        if (!alive || !diagramRef.current) return;
        diagramRef.current.innerHTML = svg;
        diagramRef.current.querySelectorAll('g.node').forEach((g) => {
          const m = /flowchart-([A-Za-z]+\d+)-/.exec(g.id || '');
          if (!m) return;
          g.dataset.step = m[1];
          g.style.cursor = 'pointer';
          g.addEventListener('click', () => {
            const i = proc.nodes.findIndex((n) => n.id === m[1]);
            if (i >= 0) setStep(i);
          });
        });
        setSvgVer((v) => v + 1);
      })
      .catch(() => { if (alive) setError(U('No se pudo dibujar el diagrama. Refresca la página.', 'The diagram could not be drawn. Refresh the page.')); });
    return () => { alive = false; };
  }, [proc, lang]);

  // Resaltar el paso actual en el diagrama y en la lista.
  useEffect(() => {
    const node = proc.nodes[step];
    if (!diagramRef.current || !node) return;
    diagramRef.current.querySelectorAll('g.node').forEach((g) => {
      const on = g.dataset.step === node.id;
      g.classList.toggle('proc-hl', on);
      // Mermaid pone sus colores con !important: el resaltado va en línea para poder ganarles.
      g.querySelectorAll('rect, polygon, path, circle').forEach((el) => {
        if (on) { el.style.setProperty('stroke', '#e8622c', 'important'); el.style.setProperty('stroke-width', '4px', 'important'); }
        else { el.style.removeProperty('stroke'); el.style.removeProperty('stroke-width'); }
      });
    });
    // Llevar el cuadro resaltado a la vista dentro del diagrama (sin mover la página).
    const box = diagramRef.current;
    const hl = box.querySelector('g.node.proc-hl');
    if (hl) {
      const r = hl.getBoundingClientRect(); const c = box.getBoundingClientRect();
      if (r.top < c.top || r.bottom > c.bottom) box.scrollTop += r.top - c.top - c.height / 2 + r.height / 2;
    }
    const li = listRef.current && listRef.current.children[step];
    if (li) li.scrollIntoView({ block: 'nearest' });
  }, [step, svgVer, proc]);

  // Flechas del teclado para avanzar o retroceder.
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); setStep((s) => Math.min(s + 1, proc.nodes.length - 1)); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); setStep((s) => Math.max(s - 1, 0)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [proc]);

  const total = proc.nodes.length;

  return (
    <>
      <div className="topbar no-print">
        <div>
          <h1>🔀 {U('Procedimientos', 'Procedures')}</h1>
          <div className="sub">{U('Cómo se hace cada proceso en Nexpro, paso a paso: quién, en qué pantalla y qué hacer', 'How each Nexpro process is done, step by step: who, on which screen and what to do')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link className="btn" to="/ayuda">📘 {U('Manual de usuario', 'User manual')}</Link>
          <button className="btn btn-primary" onClick={() => window.print()}>{U('Imprimir / Guardar PDF', 'Print / Save PDF')}</button>
        </div>
      </div>

      <div className="content proc-page">
        <div className="print-only"><DocumentBrand /></div>

        <div className="proc-tabs no-print">
          {PROCESOS.map((p) => (
            <button key={p.id} type="button" className={`proc-tab ${p.id === proc.id ? 'on' : ''}`}
              onClick={() => navigate({ hash: p.id })}>
              <span className="proc-tab-icon">{p.icon}</span><span>{L(p.title)}</span>
            </button>
          ))}
        </div>

        <h2 className="proc-title">{proc.icon} {L(proc.title)}</h2>
        <p className="muted proc-summary">{L(proc.summary)}</p>

        <div className="proc-grid">
          <div className="card proc-diagram-card">
            {error && <div className="muted">{error}</div>}
            <div className="proc-diagram" ref={diagramRef}><div className="muted">{U('Dibujando el diagrama…', 'Drawing the diagram…')}</div></div>
            <div className="proc-legend">
              {['step', 'dec', 'doc', 'admin'].map((k) => (
                <span key={k}><i className={`proc-sw ${KIND[k].cls}`} />{KIND[k][lang] || KIND[k].es}</span>
              ))}
              <span className="no-print">{U('Clic en un cuadro para ver el paso', 'Click a box to see the step')}</span>
            </div>
          </div>

          <div className="card proc-steps">
            <div className="proc-stepnav no-print">
              <button className="btn btn-sm" disabled={step === 0} onClick={() => setStep(step - 1)}>◀ {U('Anterior', 'Previous')}</button>
              <button className="btn btn-sm btn-primary" disabled={step === total - 1} onClick={() => setStep(step + 1)}>{U('Siguiente', 'Next')} ▶</button>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{U('Paso', 'Step')} {step + 1} {U('de', 'of')} {total}</span>
            </div>
            <ol className="proc-list" ref={listRef}>
              {proc.nodes.map((n, i) => (
                <li key={n.id} className={i === step ? 'on' : ''} onClick={() => setStep(i)}>
                  <div className="proc-li-head">
                    <span className={`proc-n ${KIND[n.kind].cls}`}>{i + 1}</span>
                    <strong>{L(n.label)}</strong>
                  </div>
                  <div className="proc-meta">
                    <span className="pill gray">👤 {L(n.who)}</span>
                    {n.kind !== 'step' && <span className="pill gray">{KIND[n.kind][lang] || KIND[n.kind].es}</span>}
                  </div>
                  {L(n.desc) && <div className="proc-desc">{L(n.desc)}</div>}
                  {(n.route || n.help) && (
                    <div className="proc-links no-print">
                      {n.route && <Link className="btn btn-sm" to={n.route} onClick={(e) => e.stopPropagation()}>{U('Ir a la pantalla', 'Go to screen')} →</Link>}
                      {n.help && <Link className="btn btn-sm" to={`/ayuda#${n.help}`} onClick={(e) => e.stopPropagation()}>📘 {U('Ver en el manual', 'See in manual')}</Link>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="card proc-rules">
          <div className="card-title">📌 {U('Reglas del proceso', 'Process rules')}</div>
          <ul>{proc.rules.map((r, i) => <li key={i}>{L(r)}</li>)}</ul>
        </div>
      </div>
    </>
  );
}
