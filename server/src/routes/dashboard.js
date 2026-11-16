const express = require('express');
const { all, get } = require('../../db');

const router = express.Router();
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Resumen del dashboard: cada número trae a dónde lleva al hacer clic (en el cliente).
router.get('/', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const balanceSql = `(i.total - (SELECT COALESCE(SUM(p.amount),0) FROM invoice_payments p WHERE p.invoice_id = i.id))`;
  const totals = {
    customers: get('SELECT COUNT(*) as n FROM customers').n,
    leads: get(`SELECT COUNT(*) as n FROM customers WHERE status IN ('lead','prospecto')`).n,
    products: get('SELECT COUNT(*) as n FROM products').n,
    lowStock: get('SELECT COUNT(*) as n FROM products WHERE stock_qty <= 0').n,
    openSalesOrders: get(`SELECT COUNT(*) as n FROM sales_orders WHERE status NOT IN ('facturado','cancelado')`).n,
    openSalesOrdersTotal: r2(get(`SELECT COALESCE(SUM(i.quantity * i.unit_price),0) AS n FROM sales_order_items i JOIN sales_orders so ON so.id = i.sales_order_id
                                  WHERE so.status NOT IN ('facturado','cancelado')`).n),
    pendingInvoices: get(`SELECT COUNT(*) as n FROM invoices WHERE status IN ('pendiente','parcial')`).n,
    pendingInvoicesTotal: r2(get(`SELECT COALESCE(SUM(${balanceSql}),0) as n FROM invoices i WHERE i.status IN ('pendiente','parcial')`).n),
    overdueTotal: r2(get(`SELECT COALESCE(SUM(${balanceSql}),0) as n FROM invoices i WHERE i.status IN ('pendiente','parcial') AND i.due_date IS NOT NULL AND substr(i.due_date,1,10) < ?`, [today]).n),
    invoicedMonth: r2(get(`SELECT COALESCE(SUM(total),0) AS n FROM invoices WHERE status NOT IN ('anulada','cancelado') AND substr(issue_date,1,10) >= ?`, [monthStart]).n),
    invoicedMonthCount: get(`SELECT COUNT(*) AS n FROM invoices WHERE status NOT IN ('anulada','cancelado') AND substr(issue_date,1,10) >= ?`, [monthStart]).n,
    collectedMonth: r2(get(`SELECT COALESCE(SUM(amount),0) AS n FROM invoice_payments WHERE substr(payment_date,1,10) >= ?`, [monthStart]).n),
    vehiclesInShop: get(`SELECT COUNT(*) as n FROM vehicles WHERE status IN ('recibido','en_servicio')`).n,
    openWorkOrders: get(`SELECT COUNT(*) as n FROM work_orders WHERE status NOT IN ('completado','facturado','cancelado')`).n,
    openRequests: get(`SELECT COUNT(*) AS n FROM crm_requests WHERE status IN ('nueva','en_proceso','cotizada')`).n,
    newRequests: get(`SELECT COUNT(*) AS n FROM crm_requests WHERE status = 'nueva'`).n,
    requestsToday: get(`SELECT COUNT(*) AS n FROM crm_requests WHERE substr(created_at,1,10) = ?`, [today]).n,
    oppOpenCount: get(`SELECT COUNT(*) AS n FROM opportunities WHERE stage NOT IN ('ganado','perdido')`).n,
    oppOpenTotal: r2(get(`SELECT COALESCE(SUM(value),0) AS n FROM opportunities WHERE stage NOT IN ('ganado','perdido')`).n),
    oppWeighted: r2(get(`SELECT COALESCE(SUM(value * COALESCE(probability,0) / 100.0),0) AS n FROM opportunities WHERE stage NOT IN ('ganado','perdido')`).n),
    oppWonTotal: r2(get(`SELECT COALESCE(SUM(value),0) AS n FROM opportunities WHERE stage = 'ganado'`).n),
  };
  const pipeline = all(`SELECT stage, COUNT(*) AS count, COALESCE(SUM(value),0) AS total FROM opportunities GROUP BY stage`);
  const topOpportunities = all(`SELECT o.id, o.title, o.value, o.stage, o.probability, o.customer_id, c.name AS customer_name
                                FROM opportunities o JOIN customers c ON c.id = o.customer_id
                                WHERE o.stage NOT IN ('ganado','perdido') ORDER BY COALESCE(o.value,0) DESC LIMIT 6`);
  const recentRequests = all(`SELECT r.id, r.number, r.status, r.subject, r.channel, r.created_at, c.name AS customer_name, r.customer_id
                              FROM crm_requests r JOIN customers c ON c.id = r.customer_id
                              WHERE r.status IN ('nueva','en_proceso','cotizada') ORDER BY r.created_at DESC LIMIT 6`);
  const recentActivities = all(
    `SELECT a.*, c.name as customer_name FROM activities a
     LEFT JOIN customers c ON c.id = a.customer_id
     WHERE a.done = 0 ORDER BY a.due_date IS NULL, a.due_date ASC LIMIT 10`
  );
  const recentVehicles = all(
    `SELECT v.*, c.name as customer_name FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id ORDER BY v.received_at DESC LIMIT 8`
  );
  const overdueInvoices = all(`SELECT i.id, i.number, i.due_date, c.name AS customer_name, ${balanceSql} AS balance
                               FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
                               WHERE i.status IN ('pendiente','parcial') AND i.due_date IS NOT NULL AND substr(i.due_date,1,10) < ?
                               ORDER BY i.due_date ASC LIMIT 6`, [today]);
  res.json({ totals, pipeline, topOpportunities, recentRequests, recentActivities, recentVehicles, overdueInvoices });
});

module.exports = router;
