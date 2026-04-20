import { cache } from 'react';
import { getDb } from '@/lib/db';
import { getActualAmounts } from './budget-calculations';

export interface IncomeLine {
  key: string;
  label: string;
  amount: number;
}

export interface ExpenseLine {
  key: string;
  label: string;
  amount: number;
}

export interface ProfitLossData {
  year: number;
  month: number | null;
  incomes: IncomeLine[];
  totalIncome: number;
  expenses: ExpenseLine[];
  totalExpenses: number;
  grossProfit: number;
  marginPct: number;
  vatCollected: number;
  netProfit: number;
  previous: {
    totalIncome: number;
    totalExpenses: number;
    grossProfit: number;
  } | null;
}

export interface AccountantReportData extends ProfitLossData {
  invoicesCount: number;
  invoicesSubtotalSum: number;
  invoicesVatSum: number;
  invoicesTotalSum: number;
  estimatedTaxRate: number;
  estimatedTax: number;
  netAfterTax: number;
}

const INCOME_LABELS: Record<string, string> = {
  income_equipment: 'הכנסה מציוד',
  income_workers: 'הכנסה מעובדים',
  income_other: 'הכנסה אחרת',
};

const EXPENSE_LABELS: Record<string, string> = {
  expense_fuel: 'דלק',
  expense_vehicle_insurance: 'ביטוח רכב',
  expense_vehicle_license: 'רישיון רכב',
  expense_vehicle_maintenance: 'תחזוקת רכב',
  expense_vehicle_rental: 'השכרת רכב',
  expense_equipment_maintenance: 'תחזוקת ציוד',
  expense_worker_payment: 'תשלום עובדים',
  expense_office: 'משרד',
  expense_phone: 'טלפון',
  expense_internet: 'אינטרנט',
  expense_other: 'אחר',
};

const EXPENSE_ORDER = [
  'expense_fuel',
  'expense_vehicle_insurance',
  'expense_vehicle_license',
  'expense_vehicle_maintenance',
  'expense_vehicle_rental',
  'expense_equipment_maintenance',
  'expense_worker_payment',
  'expense_office',
  'expense_phone',
  'expense_internet',
  'expense_other',
];

const INCOME_ORDER = ['income_equipment', 'income_workers', 'income_other'];

const ESTIMATED_TAX_RATE = 0.23;

function previousPeriod(
  year: number,
  month: number | null,
): { year: number; month: number | null } {
  if (month === null) return { year: year - 1, month: null };
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

async function getVatSummary(
  tenantId: string,
  year: number,
  month: number | null,
): Promise<{
  count: number;
  subtotal: number;
  vat: number;
  total: number;
}> {
  const db = getDb();
  const prefix =
    month != null
      ? `${year}-${String(month).padStart(2, '0')}-%`
      : `${year}-%`;
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS cnt,
              COALESCE(SUM(subtotal), 0) AS sub,
              COALESCE(SUM(vat_amount), 0) AS vat,
              COALESCE(SUM(total), 0) AS total
       FROM invoices
       WHERE tenant_id = ? AND status IN ('sent', 'paid', 'partial')
         AND period_end LIKE ?`,
    )
    .bind(tenantId, prefix)
    .first<{ cnt: number; sub: number; vat: number; total: number }>();
  return {
    count: Number(row?.cnt ?? 0),
    subtotal: Number(row?.sub ?? 0),
    vat: Number(row?.vat ?? 0),
    total: Number(row?.total ?? 0),
  };
}

interface ComputedTotals {
  incomes: IncomeLine[];
  totalIncome: number;
  expenses: ExpenseLine[];
  totalExpenses: number;
  grossProfit: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function computeTotals(
  tenantId: string,
  year: number,
  month: number | null,
): Promise<ComputedTotals> {
  const actual = await getActualAmounts(tenantId, year, month);

  const incomes: IncomeLine[] = INCOME_ORDER.map((key) => ({
    key,
    label: INCOME_LABELS[key],
    amount: round2((actual as Record<string, number>)[key] ?? 0),
  }));

  const expenses: ExpenseLine[] = EXPENSE_ORDER.map((key) => ({
    key,
    label: EXPENSE_LABELS[key],
    amount: round2((actual as Record<string, number>)[key] ?? 0),
  }));

  const totalIncome = round2(incomes.reduce((s, r) => s + r.amount, 0));
  const totalExpenses = round2(expenses.reduce((s, r) => s + r.amount, 0));
  const grossProfit = round2(totalIncome - totalExpenses);

  return { incomes, totalIncome, expenses, totalExpenses, grossProfit };
}

export const getProfitLossData = cache(
  async (
    tenantId: string,
    year: number,
    month: number | null = null,
  ): Promise<ProfitLossData> => {
    const prev = previousPeriod(year, month);
    const [current, previousTotals, vatSummary] = await Promise.all([
      computeTotals(tenantId, year, month),
      computeTotals(tenantId, prev.year, prev.month),
      getVatSummary(tenantId, year, month),
    ]);

    const marginPct =
      current.totalIncome > 0
        ? Math.round((current.grossProfit / current.totalIncome) * 100)
        : 0;

    return {
      year,
      month,
      incomes: current.incomes,
      totalIncome: current.totalIncome,
      expenses: current.expenses,
      totalExpenses: current.totalExpenses,
      grossProfit: current.grossProfit,
      marginPct,
      vatCollected: round2(vatSummary.vat),
      netProfit: current.grossProfit,
      previous: {
        totalIncome: previousTotals.totalIncome,
        totalExpenses: previousTotals.totalExpenses,
        grossProfit: previousTotals.grossProfit,
      },
    };
  },
);

export const getAccountantReportData = cache(
  async (
    tenantId: string,
    year: number,
    month: number | null = null,
  ): Promise<AccountantReportData> => {
    const [base, vatSummary] = await Promise.all([
      getProfitLossData(tenantId, year, month),
      getVatSummary(tenantId, year, month),
    ]);
    const estimatedTax =
      base.grossProfit > 0 ? round2(base.grossProfit * ESTIMATED_TAX_RATE) : 0;
    const netAfterTax = round2(base.grossProfit - estimatedTax);
    return {
      ...base,
      invoicesCount: vatSummary.count,
      invoicesSubtotalSum: round2(vatSummary.subtotal),
      invoicesVatSum: round2(vatSummary.vat),
      invoicesTotalSum: round2(vatSummary.total),
      estimatedTaxRate: ESTIMATED_TAX_RATE,
      estimatedTax,
      netAfterTax,
    };
  },
);

export interface FuelByVehicleLine {
  vehicleId: string;
  vehicleName: string;
  licensePlate: string;
  liters: number;
  cost: number;
  avgDaily: number;
  percentage: number;
}

export interface FuelByMonthLine {
  month: number;
  monthLabel: string;
  liters: number;
  cost: number;
}

export interface FuelReportData {
  year: number;
  month: number | null;
  totalCost: number;
  totalLiters: number;
  avgPricePerLiter: number;
  byVehicle: FuelByVehicleLine[];
  byMonth: FuelByMonthLine[] | null;
}

export interface WorkerReportLine {
  workerId: string;
  workerName: string;
  days: number;
  totalCost: number;
  totalRevenue: number;
  profit: number;
  avgDailyCost: number;
  avgDailyProfit: number;
}

export interface WorkersReportData {
  year: number;
  month: number | null;
  totalDays: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  activeWorkersCount: number;
  byWorker: WorkerReportLine[];
  topPerformer: { name: string; profit: number } | null;
}

const HEBREW_MONTHS_SHORT = [
  'ינו',
  'פבר',
  'מרץ',
  'אפר',
  'מאי',
  'יונ',
  'יול',
  'אוג',
  'ספט',
  'אוק',
  'נוב',
  'דצמ',
];

function daysInPeriod(year: number, month: number | null): number {
  if (month == null) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeap ? 366 : 365;
  }
  return new Date(year, month, 0).getDate();
}

function periodPrefix(year: number, month: number | null): string {
  if (month != null) {
    return `${year}-${String(month).padStart(2, '0')}-%`;
  }
  return `${year}-%`;
}

export const getFuelReportData = cache(
  async (
    tenantId: string,
    year: number,
    month: number | null = null,
  ): Promise<FuelReportData> => {
    const db = getDb();
    const prefix = periodPrefix(year, month);
    const days = daysInPeriod(year, month);

    const [vehicleRows, monthRows] = await Promise.all([
      db
        .prepare(
          `SELECT fr.vehicle_id AS vehicle_id,
                  v.name AS vehicle_name,
                  v.license_plate AS license_plate,
                  COALESCE(SUM(fr.liters), 0) AS liters,
                  COALESCE(SUM(fr.total_cost), 0) AS cost
           FROM fuel_records fr
           JOIN vehicles v ON v.id = fr.vehicle_id
           WHERE fr.tenant_id = ? AND fr.record_date LIKE ?
           GROUP BY fr.vehicle_id
           ORDER BY cost DESC`,
        )
        .bind(tenantId, prefix)
        .all<{
          vehicle_id: string;
          vehicle_name: string;
          license_plate: string;
          liters: number;
          cost: number;
        }>(),
      month == null
        ? db
            .prepare(
              `SELECT strftime('%m', record_date) AS mon,
                      COALESCE(SUM(liters), 0) AS liters,
                      COALESCE(SUM(total_cost), 0) AS cost
               FROM fuel_records
               WHERE tenant_id = ? AND record_date LIKE ?
               GROUP BY mon`,
            )
            .bind(tenantId, prefix)
            .all<{ mon: string; liters: number; cost: number }>()
        : Promise.resolve([]),
    ]);

    let totalCost = 0;
    let totalLiters = 0;
    for (let i = 0; i < vehicleRows.length; i++) {
      totalCost += Number(vehicleRows[i].cost ?? 0);
      totalLiters += Number(vehicleRows[i].liters ?? 0);
    }
    const avgPricePerLiter =
      totalLiters > 0 ? round2(totalCost / totalLiters) : 0;

    const byVehicle: FuelByVehicleLine[] = vehicleRows.map((r) => ({
      vehicleId: r.vehicle_id,
      vehicleName: r.vehicle_name,
      licensePlate: r.license_plate,
      liters: round2(Number(r.liters ?? 0)),
      cost: round2(Number(r.cost ?? 0)),
      avgDaily: round2(Number(r.cost ?? 0) / Math.max(1, days)),
      percentage:
        totalCost > 0
          ? Math.round((Number(r.cost ?? 0) / totalCost) * 1000) / 10
          : 0,
    }));

    let byMonth: FuelByMonthLine[] | null = null;
    if (month == null) {
      const map = new Map<number, { liters: number; cost: number }>();
      for (let i = 0; i < monthRows.length; i++) {
        const m = Number(monthRows[i].mon);
        if (Number.isInteger(m) && m >= 1 && m <= 12) {
          map.set(m, {
            liters: Number(monthRows[i].liters ?? 0),
            cost: Number(monthRows[i].cost ?? 0),
          });
        }
      }
      byMonth = [];
      for (let m = 1; m <= 12; m++) {
        const v = map.get(m) ?? { liters: 0, cost: 0 };
        byMonth.push({
          month: m,
          monthLabel: HEBREW_MONTHS_SHORT[m - 1],
          liters: round2(v.liters),
          cost: round2(v.cost),
        });
      }
    }

    return {
      year,
      month,
      totalCost: round2(totalCost),
      totalLiters: round2(totalLiters),
      avgPricePerLiter,
      byVehicle,
      byMonth,
    };
  },
);

export const getWorkersReportData = cache(
  async (
    tenantId: string,
    year: number,
    month: number | null = null,
  ): Promise<WorkersReportData> => {
    const db = getDb();
    const prefix = periodPrefix(year, month);

    const rows = await db
      .prepare(
        `SELECT wa.worker_id AS worker_id,
                w.full_name AS worker_name,
                COUNT(wa.id) AS days,
                COALESCE(SUM(wa.daily_rate), 0) AS total_cost,
                COALESCE(SUM(wa.revenue), 0) AS total_revenue
         FROM worker_assignments wa
         JOIN daily_logs dl ON dl.id = wa.daily_log_id
         JOIN workers w ON w.id = wa.worker_id
         WHERE dl.tenant_id = ?
           AND dl.status IN ('confirmed','invoiced')
           AND dl.log_date LIKE ?
         GROUP BY wa.worker_id
         ORDER BY (COALESCE(SUM(wa.revenue), 0) - COALESCE(SUM(wa.daily_rate), 0)) DESC`,
      )
      .bind(tenantId, prefix)
      .all<{
        worker_id: string;
        worker_name: string;
        days: number;
        total_cost: number;
        total_revenue: number;
      }>();

    let totalDays = 0;
    let totalCost = 0;
    let totalRevenue = 0;

    const byWorker: WorkerReportLine[] = rows.map((r) => {
      const days = Number(r.days ?? 0);
      const cost = Number(r.total_cost ?? 0);
      const revenue = Number(r.total_revenue ?? 0);
      const profit = round2(revenue - cost);
      totalDays += days;
      totalCost += cost;
      totalRevenue += revenue;
      return {
        workerId: r.worker_id,
        workerName: r.worker_name,
        days,
        totalCost: round2(cost),
        totalRevenue: round2(revenue),
        profit,
        avgDailyCost: days > 0 ? round2(cost / days) : 0,
        avgDailyProfit: days > 0 ? round2(profit / days) : 0,
      };
    });

    const totalProfit = round2(totalRevenue - totalCost);
    const topPerformer =
      byWorker.length > 0 && byWorker[0].profit > 0
        ? { name: byWorker[0].workerName, profit: byWorker[0].profit }
        : null;

    return {
      year,
      month,
      totalDays,
      totalCost: round2(totalCost),
      totalRevenue: round2(totalRevenue),
      totalProfit,
      activeWorkersCount: byWorker.length,
      byWorker,
      topPerformer,
    };
  },
);
