import React, { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
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
          <div className="brand-mark">NX</div>
          <div>
            <strong>Nexpro ERP</strong>
            <div className="muted" style={{ fontSize: 12 }}>Trucks &amp; Equipment Corp.</div>
          </div>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="field">
          <label>{t('Correo')}</label>
          <input type="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('Contraseña')}</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
          {busy ? t('Ingresando…') : t('Iniciar sesión')}
        </button>
      </form>
    </div>
  );
}
