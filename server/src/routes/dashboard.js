const express = require('express');
const { all, get } = require('../../db');

const router = express.Router();

router.get('/', (req, res) => {
  const totals = {
    customers: get('SELECT COUNT(*) as n FROM customers').n,
    leads: get(`SELECT COUNT(*) as n FROM customers WHERE status = 'lead'`).n,
    products: get('SELECT COUNT(*) as n FROM products').n,
    lowStock: get('SELECT COUNT(*) as n FROM products WHERE stock_qty <= 0').n,
    openSalesOrders: get(`SELECT COUNT(*) as n FROM sales_orders WHERE status != 'facturado' AND status != 'cancelado'`).n,
    pendingInvoices: get(`SELECT COUNT(*) as n FROM invoices WHERE status = 'pendiente'`).n,
    pendingInvoicesTotal: get(`SELECT COALESCE(SUM(total),0) as n FROM invoices WHERE status = 'pendiente'`).n,
    vehiclesInShop: get(`SELECT COUNT(*) as n FROM vehicles WHERE status IN ('recibido','en_servicio')`).n,
    openWorkOrders: get(`SELECT COUNT(*) as n FROM work_orders WHERE status != 'completado' AND status != 'facturado'`).n,
  };
  const recentActivities = all(
    `SELECT a.*, c.name as customer_name FROM activities a
     LEFT JOIN customers c ON c.id = a.customer_id
     WHERE a.done = 0 ORDER BY a.due_date IS NULL, a.due_date ASC LIMIT 10`
  );
  const recentVehicles = all(
    `SELECT v.*, c.name as customer_name FROM vehicles v
     LEFT JOIN customers c ON c.id = v.customer_id ORDER BY v.received_at DESC LIMIT 8`
  );
  res.json({ totals, recentActivities, recentVehicles });
});

module.exports = router;
