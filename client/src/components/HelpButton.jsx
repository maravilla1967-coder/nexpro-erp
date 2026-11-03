import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n.jsx';
import { sectionForPath } from '../help/manual.js';

// Botón flotante "? Ayuda": abre el manual en la sección de la pantalla actual.
export default function HelpButton() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  if (pathname.startsWith('/ayuda')) return null;
  const s = sectionForPath(pathname);
  return (
    <Link to={`/ayuda${s ? `#${s.id}` : ''}`} className="help-fab no-print" title={t('Ver cómo funciona esta pantalla')}>
      ? {t('Ayuda')}
    </Link>
  );
}
