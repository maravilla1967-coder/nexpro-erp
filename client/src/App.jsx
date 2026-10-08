import React, { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useI18n } from './i18n.jsx';
import { useAuth } from './auth.jsx';
import Modal from './components/Modal.jsx';

import Dashboard from './pages/Dashboard.jsx';
import CustomersList from './pages/CustomersList.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import ProductsList from './pages/ProductsList.jsx';
import SuppliersList from './pages/SuppliersList.jsx';
import PurchaseOrdersList from './pages/PurchaseOrdersList.jsx';
import SalesOrdersList from './pages/SalesOrdersList.jsx';
import SalesOrderDocument from './pages/SalesOrderDocument.jsx';
import InvoicesList from './pages/InvoicesList.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import VehiclesList from './pages/VehiclesList.jsx';
import VehicleDetail from './pages/VehicleDetail.jsx';
import VehicleReceptionDocument from './pages/VehicleReceptionDocument.jsx';
import ServicesList from './pages/ServicesList.jsx';
import MechanicsList from './pages/MechanicsList.jsx';
import WorkOrdersList from './pages/WorkOrdersList.jsx';
import WorkOrderDocument from './pages/WorkOrderDocument.jsx';
import UsersList from './pages/UsersList.jsx';
import ApprovalsList from './pages/ApprovalsList.jsx';
import Login from './pages/Login.jsx';
import AcceptInvite from './pages/AcceptInvite.jsx';

const NAV = [
  { label: 'General', links: [{ to: '/', text: 'Dashboard', icon: '📊' }] },
  {
    label: 'CRM',
    links: [{ to: '/clientes', text: 'Clientes', icon: '🤝' }],
  },
  {
    label: 'Taller',
    links: [
      { to: '/vehiculos', text: 'Recepción de Vehículos', icon: '🚚' },
      { to: '/ordenes-trabajo', text: 'Órdenes de Trabajo', icon: '🔧' },
      { to: '/servicios', text: 'Catálogo de Servicios', icon: '📋' },
      { to: '/mecanicos', text: 'Mecánicos', icon: '👷' },
    ],
  },
  {
    label: 'Ventas',
    links: [
      { to: '/pedidos', text: 'Órdenes de Pedido', icon: '🧾' },
      { to: '/facturas', text: 'Facturación', icon: '💵' },
    ],
  },
  {
    label: 'Inventario y Compras',
    links: [
      { to: '/inventario', text: 'Inventario', icon: '📦' },
      { to: '/proveedores', text: 'Proveedores', icon: '🏭' },
      { to: '/compras', text: 'Órdenes de Compra', icon: '🛒' },
    ],
  },
];

const ADMIN_LINK = { to: '/usuarios', text: 'Usuarios', icon: '🔐' };
const APPROVALS_LINK = { to: '/aprobaciones', text: 'Aprobaciones', icon: '✅' };

function LanguageToggle() {
  const { lang, toggle } = useI18n();
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={toggle}
      title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}
    >
      <span>🌐</span>
      <span>{lang === 'es' ? 'ES' : 'EN'} / {lang === 'es' ? 'EN' : 'ES'}</span>
    </button>
  );
}

function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) { setError(t('Las contraseñas no coinciden')); return; }
    try {
      await changePassword(currentPassword, newPassword);
      setOk(true);
      setTimeout(onClose, 1200);
    } catch (err) { setError(err.message); }
  }

  return (
    <Modal title={t('Cambiar contraseña')} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-banner">{error}</div>}
        {ok && <div className="muted" style={{ marginBottom: 10 }}>{t('Contraseña actualizada.')}</div>}
        <div className="field">
          <label>{t('Contraseña actual')}</label>
          <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('Nueva contraseña')}</label>
          <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('Confirmar contraseña')}</label>
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>{t('Cancelar')}</button>
          <button type="submit" className="btn btn-primary">{t('Guardar')}</button>
        </div>
      </form>
    </Modal>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  if (!user) return null;
  return (
    <div className="account-menu">
      <button type="button" className="account-trigger" onClick={() => setOpen(!open)}>
        <span className="account-avatar">{(user.name || '?').charAt(0).toUpperCase()}</span>
        <span className="account-info">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
        </span>
      </button>
      {open && (
        <div className="account-dropdown">
          <button type="button" className="nav-link" onClick={() => { setChangeOpen(true); setOpen(false); }}>{t('Cambiar contraseña')}</button>
          <button type="button" className="nav-link" onClick={logout}>{t('Cerrar sesión')}</button>
        </div>
      )}
      {changeOpen && <ChangePasswordModal onClose={() => setChangeOpen(false)} />}
    </div>
  );
}

function MainShell() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">NX</div>
          <div className="brand-text">
            <strong>Nexpro ERP</strong>
            <span>Trucks &amp; Equipment Corp.</span>
          </div>
        </div>
        <div style={{ padding: '0 14px 10px' }}>
          <LanguageToggle />
        </div>
        {NAV.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{t(group.label)}</div>
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span>{link.icon}</span>
                <span>{t(link.text)}</span>
              </NavLink>
            ))}
          </div>
        ))}
        <div className="nav-group">
          <div className="nav-label">{t('Administración')}</div>
          <NavLink to={APPROVALS_LINK.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span>{APPROVALS_LINK.icon}</span><span>{t(APPROVALS_LINK.text)}</span>
          </NavLink>
          {isAdmin && (
            <NavLink to={ADMIN_LINK.to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <span>{ADMIN_LINK.icon}</span><span>{t(ADMIN_LINK.text)}</span>
            </NavLink>
          )}
        </div>
        <div style={{ marginTop: 'auto', padding: '10px 14px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <AccountMenu />
        </div>
      </aside>
      <div className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/clientes" element={<CustomersList />} />
          <Route path="/clientes/:id" element={<CustomerDetail />} />
          <Route path="/inventario" element={<ProductsList />} />
          <Route path="/proveedores" element={<SuppliersList />} />
          <Route path="/compras" element={<PurchaseOrdersList />} />
          <Route path="/pedidos" element={<SalesOrdersList />} />
          <Route path="/pedidos/:id/documento" element={<SalesOrderDocument />} />
          <Route path="/facturas" element={<InvoicesList />} />
          <Route path="/facturas/:id" element={<InvoiceView />} />
          <Route path="/vehiculos" element={<VehiclesList />} />
          <Route path="/vehiculos/:id" element={<VehicleDetail />} />
          <Route path="/vehiculos/:id/documento" element={<VehicleReceptionDocument />} />
          <Route path="/servicios" element={<ServicesList />} />
          <Route path="/mecanicos" element={<MechanicsList />} />
          <Route path="/ordenes-trabajo" element={<WorkOrdersList />} />
          <Route path="/ordenes-trabajo/:id/documento" element={<WorkOrderDocument />} />
          <Route path="/aprobaciones" element={<ApprovalsList />} />
          {isAdmin && <Route path="/usuarios" element={<UsersList />} />}
        </Routes>
      </div>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  if (loading) return <div className="login-shell"><div className="muted">{t('Cargando…')}</div></div>;
  if (!user) return <Login />;
  return <MainShell />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/invitacion/:token" element={<AcceptInvite />} />
      <Route path="/*" element={<AuthGate />} />
    </Routes>
  );
}
