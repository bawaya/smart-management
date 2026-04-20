import { cache } from 'react';
import { getDb } from '@/lib/db';
import {
  type ActualAmounts,
  BUDGET_CATEGORIES,
} from './budget-types';

function makeEmpty(): ActualAmounts {
  const out = {} as ActualAmounts;
  for (let i = 0; i < BUDGET_CATEGORIES.length; i++) {
    out[BUDGET_CATEGORIES[i]] = 0;
  }
  return out;
}

function datePrefix(year: number, month: number | null): string {
  if (month != null) {
    return `${year}-${String(month).padStart(2, '0')}-%`;
  }
  return `${year}-%`;
}

function monthToIndex(monthStr: string): number {
  const n = Number(monthStr);
  if (!Number.isInteger(n) || n < 1 || n > 12) return -1;
  return n - 1;
}

export const getMonthlyActualsForYear = cache(
  async (tenantId: string, year: number): Promise<ActualAmounts[]> => {
    const db = getDb();
    const prefix = `${year}-%`;

    const [logsRows, workersRows, fuelRows, expensesRows] = await Promise.all([
      db
        .prepare(
          `SELECT strftime('%m', log_date) AS mon,
                  COALESCE(SUM(equipment_revenue), 0) AS rev
           FROM daily_logs
           WHERE tenant_id = ? AND status IN ('confirmed','invoiced')
             AND log_date LIKE ?
           GROUP BY mon`,
        )
        .bind(tenantId, prefix)
        .all<{ mon: string; rev: number }>(),
      db
        .prepare(
          `SELECT strftime('%m', dl.log_date) AS mon,
                  COALESCE(SUM(wa.revenue), 0) AS revenue,
                  COALESCE(SUM(wa.daily_rate), 0) AS cost
           FROM worker_assignments wa
           JOIN daily_logs dl ON dl.id = wa.daily_log_id
           WHERE dl.tenant_id = ? AND dl.status IN ('confirmed','invoiced')
             AND dl.log_date LIKE ?
           GROUP BY mon`,
        )
        .bind(tenantId, prefix)
        .all<{ mon: string; revenue: number; cost: number }>(),
      db
        .prepare(
          `SELECT strftime('%m', record_date) AS mon,
                  COALESCE(SUM(total_cost), 0) AS fuel
           FROM fuel_records
           WHERE tenant_id = ? AND record_date LIKE ?
           GROUP BY mon`,
        )
        .bind(tenantId, prefix)
        .all<{ mon: string; fuel: number }>(),
      db
        .prepare(
          `SELECT strftime('%m', expense_date) AS mon,
                  category,
                  COALESCE(SUM(amount), 0) AS amount
           FROM expenses
           WHERE tenant_id = ? AND expense_date LIKE ?
           GROUP BY mon, category`,
        )
        .bind(tenantId, prefix)
        .all<{ mon: string; category: string; amount: number }>(),
    ]);

    const months: ActualAmounts[] = Array.from({ length: 12 }, () =>
      makeEmpty(),
    );

    for (let i = 0; i < logsRows.length; i++) {
      const idx = monthToIndex(logsRows[i].mon);
      if (idx >= 0) months[idx].income_equipment = Number(logsRows[i].rev ?? 0);
    }

    for (let i = 0; i < workersRows.length; i++) {
      const idx = monthToIndex(workersRows[i].mon);
      if (idx >= 0) {
        months[idx].income_workers = Number(workersRows[i].revenue ?? 0);
        months[idx].expense_worker_payment = Number(workersRows[i].cost ?? 0);
      }
    }

    for (let i = 0; i < fuelRows.length; i++) {
      const idx = monthToIndex(fuelRows[i].mon);
      if (idx >= 0) months[idx].expense_fuel += Number(fuelRows[i].fuel ?? 0);
    }

    for (let i = 0; i < expensesRows.length; i++) {
      const row = expensesRows[i];
      const idx = monthToIndex(row.mon);
      if (idx < 0) continue;
      const amount = Number(row.amount ?? 0);
      switch (row.category) {
        case 'fuel':
          months[idx].expense_fuel += amount;
          break;
        case 'vehicle_insurance':
          months[idx].expense_vehicle_insurance += amount;
          break;
        case 'vehicle_license':
          months[idx].expense_vehicle_license += amount;
          break;
        case 'vehicle_maintenance':
          months[idx].expense_vehicle_maintenance += amount;
          break;
        case 'vehicle_rental':
          months[idx].expense_vehicle_rental += amount;
          break;
        case 'equipment_maintenance':
          months[idx].expense_equipment_maintenance += amount;
          break;
        case 'worker_payment':
          months[idx].expense_worker_payment += amount;
          break;
        case 'office':
          months[idx].expense_office += amount;
          break;
        case 'phone':
          months[idx].expense_phone += amount;
          break;
        case 'internet':
          months[idx].expense_internet += amount;
          break;
        case 'other':
          months[idx].expense_other += amount;
          break;
      }
    }

    return months;
  },
);

export const getActualAmounts = cache(
  async (
    tenantId: string,
    year: number,
    month: number | null = null,
  ): Promise<ActualAmounts> => {
    const db = getDb();
    const prefix = datePrefix(year, month);

    const [logsRow, workersRow, fuelRow, expensesRows] = await Promise.all([
      db
        .prepare(
          `SELECT COALESCE(SUM(equipment_revenue), 0) AS rev
           FROM daily_logs
           WHERE tenant_id = ? AND status IN ('confirmed','invoiced')
             AND log_date LIKE ?`,
        )
        .bind(tenantId, prefix)
        .first<{ rev: number }>(),
      db
        .prepare(
          `SELECT
             COALESCE(SUM(wa.revenue), 0) AS revenue,
             COALESCE(SUM(wa.daily_rate), 0) AS cost
           FROM worker_assignments wa
           JOIN daily_logs dl ON dl.id = wa.daily_log_id
           WHERE dl.tenant_id = ? AND dl.status IN ('confirmed','invoiced')
             AND dl.log_date LIKE ?`,
        )
        .bind(tenantId, prefix)
        .first<{ revenue: number; cost: number }>(),
      db
        .prepare(
          `SELECT COALESCE(SUM(total_cost), 0) AS fuel
           FROM fuel_records
           WHERE tenant_id = ? AND record_date LIKE ?`,
        )
        .bind(tenantId, prefix)
        .first<{ fuel: number }>(),
      db
        .prepare(
          `SELECT category, COALESCE(SUM(amount), 0) AS amount
           FROM expenses
           WHERE tenant_id = ? AND expense_date LIKE ?
           GROUP BY category`,
        )
        .bind(tenantId, prefix)
        .all<{ category: string; amount: number }>(),
    ]);

    const result = makeEmpty();
    result.income_equipment = Number(logsRow?.rev ?? 0);
    result.income_workers = Number(workersRow?.revenue ?? 0);

    const expenseByCategory = new Map<string, number>();
    for (let i = 0; i < expensesRows.length; i++) {
      expenseByCategory.set(
        expensesRows[i].category,
        Number(expensesRows[i].amount ?? 0),
      );
    }

    result.expense_fuel =
      Number(fuelRow?.fuel ?? 0) + (expenseByCategory.get('fuel') ?? 0);
    result.expense_vehicle_insurance =
      expenseByCategory.get('vehicle_insurance') ?? 0;
    result.expense_vehicle_license =
      expenseByCategory.get('vehicle_license') ?? 0;
    result.expense_vehicle_maintenance =
      expenseByCategory.get('vehicle_maintenance') ?? 0;
    result.expense_vehicle_rental =
      expenseByCategory.get('vehicle_rental') ?? 0;
    result.expense_equipment_maintenance =
      expenseByCategory.get('equipment_maintenance') ?? 0;
    result.expense_worker_payment =
      Number(workersRow?.cost ?? 0) +
      (expenseByCategory.get('worker_payment') ?? 0);
    result.expense_office = expenseByCategory.get('office') ?? 0;
    result.expense_phone = expenseByCategory.get('phone') ?? 0;
    result.expense_internet = expenseByCategory.get('internet') ?? 0;
    result.expense_other = expenseByCategory.get('other') ?? 0;

    return result;
  },
);
