import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Pill from '../components/Pill.jsx';
import { useAuth } from '../auth.jsx';
import { useI18n } from '../i18n.jsx';

const ENTITY_LABEL = { invoice: 'Factura', sales_order: 'Pedido' };
const ACTION_LABEL = { update: 'Editar', delete: 'Eliminar' };

export default function ApprovalsList() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('pendiente');
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  function load() { api.get('/approvals', { status: status || undefined }).then(setList).catch(console.error); }
  useEffect(() => { load(); }, [status]);

  async function approve(id) {
    setBusyId(id); setError('');
    try {
      await api.post(`/approvals/${id}/approve`);
      load();
    } catch (err) { setError(err.message); } finally { setBusyId(null); }
  }

  async function reject(id) {
    const reason = window.prompt(t('Motivo del rechazo (opcional):')) || '';
    setBusyId(id); setError('');
    try {
      await api.post(`/approvals/${id}/reject`, { reason });
      load();
    } catch (err) { setError(err.message); } finally { setBusyId(null); }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{t('Aprobaciones')}</h1>
          <div className="sub">
            {isAdmin
              ? t('Cambios en facturas y pedidos que esperan tu autorización')
              : t('Tus solicitudes de cambio enviadas para autorización')}
          </div>
        </div>
      </div>
      <div className="content">
        <div className="toolbar">
          <select style={{ width: 200 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="pendiente">{t('Pendientes')}</option>
            <option value="aprobado">{t('Aprobadas')}</option>
            <option value="rechazado">{t('Rechazadas')}</option>
            <option value="">{t('Todas')}</option>
          </select>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="card">
          {list.length === 0 ? (
            <div className="empty-state">{t('No hay solicitudes aquí.')}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{t('Tipo')}</th><th>{t('Acción')}</th><th>{t('Detalle')}</th>
                  {isAdmin && <th>{t('Solicitado por')}</th>}
                  <th>{t('Fecha')}</th><th>{t('Estado')}</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>{t(ENTITY_LABEL[r.entity_type] || r.entity_type)}</td>
                    <td>{t(ACTION_LABEL[r.action] || r.action)}</td>
                    <td className="muted">{r.summary}</td>
                    {isAdmin && <td className="muted">{r.requested_by_name || '—'}</td>}
                    <td className="muted">{r.created_at}</td>
                    <td>
                      <Pill value={r.status} />
                      {r.status === 'rechazado' && r.reject_reason && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.reject_reason}</div>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {r.status === 'pendiente' ? (
                          <>
                            <button type="button" className="btn btn-sm btn-primary" disabled={busyId === r.id} onClick={() => approve(r.id)}>{t('Aprobar')}</button>
                            {' '}
                            <button type="button" className="btn btn-sm btn-danger" disabled={busyId === r.id} onClick={() => reject(r.id)}>{t('Rechazar')}</button>
                          </>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>{r.resolved_by_name}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
