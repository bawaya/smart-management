import { cache } from 'react';
import { getDb } from '@/lib/db';
import { getExpiryAlerts } from './expiry-alerts';

export interface RecentLog {
  id: string;
  log_date: string;
  client_name: string;
  status: 'draft' | 'confirmed' | 'invoiced';
}

export interface RecentInvoice {
  id: string;
  invoice_number: string;
  client_name: string;
  total: number;
  status: string;
}

export interface RecentExpense {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
}

export interface RecentActivity {
  logs: RecentLog[];
  invoices: RecentInvoice[];
  expenses: RecentExpense[];
}

export interface DashboardStats {
  monthlyEquipmentRevenue: number;
  monthlyWorkersRevenue: number;
  totalIncome: number;
  monthlyExpenses: number;
  monthlyWorkerCosts: number;
  totalExpenses: number;
  netProfit: number;
  workingDays: number;
  alertsCount: number;
}

interface LogAggRow {
  equipment_revenue: number | null;
  working_days: number | null;
}

interface WorkersAggRow {
  workers_revenue: number | null;
  workers_cost: number | null;
}

interface ExpensesAggRow {
  expenses_sum: number | null;
}

function toNumber(v: number | null | undefined): number {
  if (v == null) return 0;
  return Number.isFinite(v) ? Number(v) : 0;
}

export const getDashboardStats = cache(
  async (tenantId: string): Promise<DashboardStats> => {
    const db = getDb();

    const [logsRow, workersRow, expensesRow, alerts] = await Promise.all([
      db.queryOne<LogAggRow>(
        `SELECT
             COALESCE(SUM(CASE WHEN status IN ('confirmed','invoiced') THEN equipment_revenue ELSE 0 END), 0) AS equipment_revenue,
             COUNT(DISTINCT log_date) AS working_days
           FROM daily_logs
           WHERE tenant_id = ?
             AND strftime('%Y-%m', log_date) = strftime('%Y-%m', 'now')`,
        [tenantId],
      ),
      db.queryOne<WorkersAggRow>(
        `SELECT
             COALESCE(SUM(wa.revenue), 0) AS workers_revenue,
             COALESCE(SUM(wa.daily_rate), 0) AS workers_cost
           FROM worker_assignments wa
           JOIN daily_logs dl ON dl.id = wa.daily_log_id
           WHERE dl.tenant_id = ?
             AND dl.status IN ('confirmed','invoiced')
             AND strftime('%Y-%m', dl.log_date) = strftime('%Y-%m', 'now')`,
        [tenantId],
      ),
      db.queryOne<ExpensesAggRow>(
        `SELECT COALESCE(SUM(amount), 0) AS expenses_sum
           FROM expenses
           WHERE tenant_id = ?
             AND strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')`,
        [tenantId],
      ),
      getExpiryAlerts(tenantId),
    ]);

    const monthlyEquipmentRevenue = toNumber(logsRow?.equipment_revenue);
    const workingDays = toNumber(logsRow?.working_days);
    const monthlyWorkersRevenue = toNumber(workersRow?.workers_revenue);
    const monthlyWorkerCosts = toNumber(workersRow?.workers_cost);
    const monthlyExpenses = toNumber(expensesRow?.expenses_sum);

    const totalIncome = monthlyEquipmentRevenue + monthlyWorkersRevenue;
    const totalExpenses = monthlyExpenses + monthlyWorkerCosts;
    const netProfit = totalIncome - totalExpenses;

    return {
      monthlyEquipmentRevenue,
      monthlyWorkersRevenue,
      totalIncome,
      monthlyExpenses,
      monthlyWorkerCosts,
      totalExpenses,
      netProfit,
      workingDays,
      alertsCount: alerts.length,
    };
  },
);

export const getRecentActivity = cache(
  async (tenantId: string): Promise<RecentActivity> => {
    const db = getDb();
    const [logs, invoices, expenses] = await Promise.all([
      db.query<RecentLog>(
        `SELECT dl.id, dl.log_date, dl.status, c.name AS client_name
           FROM daily_logs dl
           JOIN clients c ON c.id = dl.client_id
           WHERE dl.tenant_id = ?
           ORDER BY dl.log_date DESC, dl.created_at DESC
           LIMIT 5`,
        [tenantId],
      ),
      db.query<RecentInvoice>(
        `SELECT i.id, i.invoice_number, i.total, i.status, c.name AS client_name
           FROM invoices i
           JOIN clients c ON c.id = i.client_id
           WHERE i.tenant_id = ?
           ORDER BY i.created_at DESC
           LIMIT 3`,
        [tenantId],
      ),
      db.query<RecentExpense>(
        `SELECT id, expense_date, category, amount
           FROM expenses
           WHERE tenant_id = ?
           ORDER BY expense_date DESC, created_at DESC
           LIMIT 3`,
        [tenantId],
      ),
    ]);
    return { logs, invoices, expenses };
  },
);
