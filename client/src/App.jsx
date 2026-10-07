import React from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';

import Dashboard from './pages/Dashboard.jsx';
import CustomersList from './pages/CustomersList.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import ProductsList from './pages/ProductsList.jsx';
import SuppliersList from './pages/SuppliersList.jsx';
import PurchaseOrdersList from './pages/PurchaseOrdersList.jsx';
import SalesOrdersList from './pages/SalesOrdersList.jsx';
import InvoicesList from './pages/InvoicesList.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import VehiclesList from './pages/VehiclesList.jsx';
import VehicleDetail from './pages/VehicleDetail.jsx';
import ServicesList from './pages/ServicesList.jsx';
import MechanicsList from './pages/MechanicsList.jsx';
import WorkOrdersList from './pages/WorkOrdersList.jsx';

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

export default function App() {
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
        {NAV.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <span>{link.icon}</span>
                <span>{link.text}</span>
              </NavLink>
            ))}
          </div>
        ))}
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
          <Route path="/facturas" element={<InvoicesList />} />
          <Route path="/facturas/:id" element={<InvoiceView />} />
          <Route path="/vehiculos" element={<VehiclesList />} />
          <Route path="/vehiculos/:id" element={<VehicleDetail />} />
          <Route path="/servicios" element={<ServicesList />} />
          <Route path="/mecanicos" element={<MechanicsList />} />
          <Route path="/ordenes-trabajo" element={<WorkOrdersList />} />
        </Routes>
      </div>
    </div>
  );
}
