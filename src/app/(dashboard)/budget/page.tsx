import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import {
  getActualAmounts,
  getMonthlyActualsForYear,
} from '@/lib/utils/budget-calculations';
import { BudgetManager, type BudgetRow } from './BudgetManager';

interface SettingRow {
  value: string;
}

interface MonthlyBudgetRow {
  budget_month: number;
  category: string;
  planned_amount: number;
}

interface Props {
  searchParams: {
    year?: string;
    month?: string;
    view?: string;
  };
}

function parseYear(v: string | undefined): number {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 2000 && n <= 3000) return n;
  return new Date().getFullYear();
}

function parseMonth(v: string | undefined): number | null {
  if (v == null || v === '' || v === 'all') return null;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return null;
}

function parseView(v: string | undefined): 'current' | 'yearly' {
  return v === 'yearly' ? 'yearly' : 'current';
}

export default async function BudgetPage({ searchParams }: Props) {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'budget')) {
    redirect('/');
  }

  const year = parseYear(searchParams.year);
  const month = parseMonth(searchParams.month);
  const view = parseView(searchParams.view);

  const db = getDb();

  const labelRow = await db
    .prepare(
      "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    )
    .bind(tenantId)
    .first<SettingRow>();
  const equipmentLabel = (labelRow?.value ?? '').trim() || 'ציוד';

  if (view === 'yearly') {
    const monthlyBudgetRows = await db
      .prepare(
        `SELECT budget_month, category, planned_amount
         FROM budgets
         WHERE tenant_id = ? AND budget_year = ? AND budget_month IS NOT NULL`,
      )
      .bind(tenantId, year)
      .all<MonthlyBudgetRow>();

    const monthlyActuals = await getMonthlyActualsForYear(tenantId, year);

    return (
      <BudgetManager
        tenantId={tenantId}
        equipmentLabel={equipmentLabel}
        year={year}
        month={null}
        view="yearly"
        budgets={[]}
        actual={monthlyActuals[0]}
        monthlyBudgets={monthlyBudgetRows}
        monthlyActuals={monthlyActuals}
      />
    );
  }

  const budgetRows =
    month == null
      ? await db
          .prepare(
            `SELECT category, planned_amount FROM budgets
             WHERE tenant_id = ? AND budget_year = ? AND budget_month IS NULL`,
          )
          .bind(tenantId, year)
          .all<BudgetRow>()
      : await db
          .prepare(
            `SELECT category, planned_amount FROM budgets
             WHERE tenant_id = ? AND budget_year = ? AND budget_month = ?`,
          )
          .bind(tenantId, year, month)
          .all<BudgetRow>();

  const actual = await getActualAmounts(tenantId, year, month);

  return (
    <BudgetManager
      tenantId={tenantId}
      equipmentLabel={equipmentLabel}
      year={year}
      month={month}
      view="current"
      budgets={budgetRows}
      actual={actual}
    />
  );
}
