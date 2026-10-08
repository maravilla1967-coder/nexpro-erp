import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';

export default function AcceptInvite() {
  const { token } = useParams();
  const { acceptInvite } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError(t('Las contraseñas no coinciden'));
      return;
    }
    if (password.length < 6) {
      setError(t('La contraseña debe tener al menos 6 caracteres'));
      return;
    }
    setBusy(true);
    try {
      await acceptInvite(token, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-mark"><img src="/nexpro-icon.png" alt="Nexpro" /></div>
          <div>
            <strong>Nexpro ERP</strong>
            <div className="muted" style={{ fontSize: 12 }}>Trucks &amp; Equipment Corp.</div>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>{t('Crea tu contraseña para activar tu cuenta.')}</p>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label>{t('Nueva contraseña')}</label>
          <input type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('Confirmar contraseña')}</label>
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? t('Guardando…') : t('Activar cuenta')}
        </button>
      </form>
    </div>
  );
}
