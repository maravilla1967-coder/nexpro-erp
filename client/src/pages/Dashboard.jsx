import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/dashboard').then(setData).catch(console.error);
  }, []);

  if (!data) return <div className="content">Cargando…</div>;
  const { totals, recentActivities, recentVehicles } = data;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">Resumen general de Nexpro</div>
        </div>
      </div>
      <div className="content">
        <div className="grid grid-4" style={{ marginBottom: 8 }}>
          <div className="kpi">
            <div className="label">Clientes / Leads</div>
            <div className="value">{totals.customers}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{totals.leads} leads activos</div>
          </div>
          <div className="kpi">
            <div className="label">Vehículos en taller</div>
            <div className="value">{totals.vehiclesInShop}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{totals.openWorkOrders} órdenes de trabajo abiertas</div>
          </div>
          <div className="kpi">
            <div className="label">Pedidos abiertos</div>
            <div className="value">{totals.openSalesOrders}</div>
          </div>
          <div className="kpi">
            <div className="label">Facturas pendientes</div>
            <div className={`value ${totals.pendingInvoices > 0 ? 'alert' : ''}`}>${Number(totals.pendingInvoicesTotal).toLocaleString()}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{totals.pendingInvoices} facturas</div>
          </div>
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-title">Vehículos recibidos recientemente</div>
            {recentVehicles.length === 0 ? (
              <div className="empty-state">Aún no se han recibido vehículos.</div>
            ) : (
              <table>
                <thead><tr><th>VIN</th><th>Vehículo</th><th>Cliente</th><th>Estado</th></tr></thead>
                <tbody>
                  {recentVehicles.map((v) => (
                    <tr key={v.id} className="clickable">
                      <td><Link to={`/vehiculos/${v.id}`}>{v.vin}</Link></td>
                      <td>{v.make} {v.model} {v.year}</td>
                      <td>{v.customer_name || '—'}</td>
                      <td><Pill value={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="card-title">Tareas y seguimientos pendientes (CRM)</div>
            {recentActivities.length === 0 ? (
              <div className="empty-state">No hay tareas pendientes.</div>
            ) : (
              <table>
                <thead><tr><th>Cliente</th><th>Asunto</th><th>Fecha</th></tr></thead>
                <tbody>
                  {recentActivities.map((a) => (
                    <tr key={a.id}>
                      <td><Link to={`/clientes/${a.customer_id}`}>{a.customer_name}</Link></td>
                      <td>{a.subject}</td>
                      <td>{a.due_date || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
