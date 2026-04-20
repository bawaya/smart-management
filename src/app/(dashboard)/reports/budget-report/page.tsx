import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { getMonthlyActualsForYear } from '@/lib/utils/budget-calculations';
import {
  BUDGET_CATEGORIES,
  type BudgetCategory,
} from '@/lib/utils/budget-types';
import { getCompanyInfo } from '@/lib/utils/company-info';
import {
  type BudgetReportCategoryLine,
  type BudgetReportData,
  BudgetReport,
} from './BudgetReport';

interface Props {
  searchParams: { year?: string };
}

interface BudgetQueryRow {
  budget_month: number | null;
  category: string;
  planned_amount: number;
}

interface SettingRow {
  value: string;
}

function parseYear(v: string | undefined): number {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 2000 && n <= 3000) return n;
  return new Date().getFullYear();
}

const INCOME_CATEGORIES: BudgetCategory[] = [
  'income_equipment',
  'income_workers',
  'income_other',
];

const EXPENSE_CATEGORIES: BudgetCategory[] = [
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

function categoryLabel(
  cat: BudgetCategory,
  equipmentLabel: string,
): string {
  switch (cat) {
    case 'income_equipment':
      return `הכנסה מ${equipmentLabel}`;
    case 'income_workers':
      return 'הכנסה מעובדים';
    case 'income_other':
      return 'הכנסה אחרת';
    case 'expense_fuel':
      return 'דלק';
    case 'expense_vehicle_insurance':
      return 'ביטוח רכב';
    case 'expense_vehicle_license':
      return 'רישיון רכב';
    case 'expense_vehicle_maintenance':
      return 'תחזוקת רכב';
    case 'expense_vehicle_rental':
      return 'השכרת רכב';
    case 'expense_equipment_maintenance':
      return 'תחזוקת ציוד';
    case 'expense_worker_payment':
      return 'תשלום עובדים';
    case 'expense_office':
      return 'משרד';
    case 'expense_phone':
      return 'טלפון';
    case 'expense_internet':
      return 'אינטרנט';
    case 'expense_other':
      return 'אחר';
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function BudgetReportPage({ searchParams }: Props) {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const year = parseYear(searchParams.year);

  const db = getDb();

  const [labelRow, budgetRows, monthlyActuals, company] = await Promise.all([
    db
      .prepare(
        "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
      )
      .bind(tenantId)
      .first<SettingRow>(),
    db
      .prepare(
        `SELECT budget_month, category, planned_amount
         FROM budgets
         WHERE tenant_id = ? AND budget_year = ?`,
      )
      .bind(tenantId, year)
      .all<BudgetQueryRow>(),
    getMonthlyActualsForYear(tenantId, year),
    getCompanyInfo(tenantId),
  ]);

  const equipmentLabel = (labelRow?.value ?? '').trim() || 'ציוד';

  const yearlyBudget = new Map<BudgetCategory, number>();
  const monthlyBudget = new Map<BudgetCategory, Map<number, number>>();

  for (let i = 0; i < budgetRows.length; i++) {
    const row = budgetRows[i];
    if (!(BUDGET_CATEGORIES as readonly string[]).includes(row.category)) {
      continue;
    }
    const cat = row.category as BudgetCategory;
    if (row.budget_month == null) {
      yearlyBudget.set(cat, row.planned_amount);
    } else {
      let inner = monthlyBudget.get(cat);
      if (!inner) {
        inner = new Map<number, number>();
        monthlyBudget.set(cat, inner);
      }
      inner.set(row.budget_month, row.planned_amount);
    }
  }

  function effectivePlannedMonthly(
    cat: BudgetCategory,
    month: number,
  ): number {
    const monthly = monthlyBudget.get(cat);
    if (monthly && monthly.has(month)) return monthly.get(month) ?? 0;
    const yearly = yearlyBudget.get(cat);
    if (yearly != null) return yearly / 12;
    return 0;
  }

  function buildCategoryLine(cat: BudgetCategory): BudgetReportCategoryLine {
    const monthlyBreakdown = [];
    let yearlyActual = 0;
    let yearlyPlanned = 0;
    for (let m = 1; m <= 12; m++) {
      const planned = round2(effectivePlannedMonthly(cat, m));
      const actual = round2(monthlyActuals[m - 1][cat] ?? 0);
      monthlyBreakdown.push({ month: m, planned, actual });
      yearlyActual += actual;
      yearlyPlanned += planned;
    }
    yearlyActual = round2(yearlyActual);
    yearlyPlanned = round2(yearlyPlanned);
    return {
      key: cat,
      label: categoryLabel(cat, equipmentLabel),
      kind: cat.startsWith('income_') ? 'income' : 'expense',
      yearlyPlanned,
      yearlyActual,
      monthlyBreakdown,
    };
  }

  const incomeCategories = INCOME_CATEGORIES.map(buildCategoryLine);
  const expenseCategories = EXPENSE_CATEGORIES.map(buildCategoryLine);

  function totalFor(
    lines: BudgetReportCategoryLine[],
    field: 'yearlyPlanned' | 'yearlyActual',
  ): number {
    let s = 0;
    for (let i = 0; i < lines.length; i++) s += lines[i][field];
    return round2(s);
  }

  const totalIncomePlanned = totalFor(incomeCategories, 'yearlyPlanned');
  const totalIncomeActual = totalFor(incomeCategories, 'yearlyActual');
  const totalExpensePlanned = totalFor(expenseCategories, 'yearlyPlanned');
  const totalExpenseActual = totalFor(expenseCategories, 'yearlyActual');

  const monthlyTotals = [];
  for (let m = 1; m <= 12; m++) {
    let plannedIncome = 0;
    let actualIncome = 0;
    for (let i = 0; i < incomeCategories.length; i++) {
      plannedIncome += incomeCategories[i].monthlyBreakdown[m - 1].planned;
      actualIncome += incomeCategories[i].monthlyBreakdown[m - 1].actual;
    }
    let plannedExpense = 0;
    let actualExpense = 0;
    for (let i = 0; i < expenseCategories.length; i++) {
      plannedExpense += expenseCategories[i].monthlyBreakdown[m - 1].planned;
      actualExpense += expenseCategories[i].monthlyBreakdown[m - 1].actual;
    }
    monthlyTotals.push({
      month: m,
      plannedIncome: round2(plannedIncome),
      actualIncome: round2(actualIncome),
      plannedExpense: round2(plannedExpense),
      actualExpense: round2(actualExpense),
      plannedProfit: round2(plannedIncome - plannedExpense),
      actualProfit: round2(actualIncome - actualExpense),
    });
  }

  const data: BudgetReportData = {
    year,
    incomeCategories,
    expenseCategories,
    totalIncomePlanned,
    totalIncomeActual,
    totalExpensePlanned,
    totalExpenseActual,
    plannedProfit: round2(totalIncomePlanned - totalExpensePlanned),
    actualProfit: round2(totalIncomeActual - totalExpenseActual),
    monthlyTotals,
  };

  return <BudgetReport data={data} company={company} />;
}
