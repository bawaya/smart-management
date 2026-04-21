'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import type { BudgetCategory } from '@/lib/utils/budget-types';
import type { CompanyInfo } from '@/lib/utils/company-info';
import { printInvoice } from '@/lib/utils/generate-invoice-pdf';

export interface MonthlyBreakdownCell {
  month: number;
  planned: number;
  actual: number;
}

export interface BudgetReportCategoryLine {
  key: BudgetCategory;
  label: string;
  kind: 'income' | 'expense';
  yearlyPlanned: number;
  yearlyActual: number;
  monthlyBreakdown: MonthlyBreakdownCell[];
}

export interface MonthlyTotalsRow {
  month: number;
  plannedIncome: number;
  actualIncome: number;
  plannedExpense: number;
  actualExpense: number;
  plannedProfit: number;
  actualProfit: number;
}

export interface BudgetReportData {
  year: number;
  incomeCategories: BudgetReportCategoryLine[];
  expenseCategories: BudgetReportCategoryLine[];
  totalIncomePlanned: number;
  totalIncomeActual: number;
  totalExpensePlanned: number;
  totalExpenseActual: number;
  plannedProfit: number;
  actualProfit: number;
  monthlyTotals: MonthlyTotalsRow[];
}

interface BudgetReportProps {
  data: BudgetReportData;
  company: CompanyInfo;
}

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

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

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function utilization(actual: number, planned: number): number {
  if (planned <= 0) return 0;
  return Math.round((actual / planned) * 100);
}

function delta(actual: number, planned: number): number {
  return Math.round((actual - planned) * 100) / 100;
}

function expenseTone(
  actual: number,
  planned: number,
): 'over' | 'near' | 'ok' | 'noplan' {
  if (planned <= 0) return 'noplan';
  const ratio = actual / planned;
  if (ratio > 1) return 'over';
  if (ratio >= 0.9) return 'near';
  return 'ok';
}

function profitClass(n: number): string {
  if (n > 0) return 'text-green-700';
  if (n < 0) return 'text-red-700';
  return 'text-gray-900';
}

export function BudgetReport({ data, company }: BudgetReportProps) {
  const router = useRouter();

  function changeYear(nextYear: number): void {
    const params = new URLSearchParams();
    params.set('year', String(nextYear));
    router.push(`/reports/budget-report?${params.toString()}`);
  }

  const yearOptions: number[] = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 5; y--) yearOptions.push(y);

  const incomeUtilization = utilization(
    data.totalIncomeActual,
    data.totalIncomePlanned,
  );
  const expenseUtilization = utilization(
    data.totalExpenseActual,
    data.totalExpensePlanned,
  );

  const warnings = useMemo(() => {
    const out: Array<{ label: string; pct: number; actual: number; planned: number }> = [];
    const check = (line: BudgetReportCategoryLine) => {
      if (line.yearlyPlanned <= 0) return;
      const pct = Math.round((line.yearlyActual / line.yearlyPlanned) * 100);
      if (pct > 100) {
        out.push({
          label: line.label,
          pct,
          actual: line.yearlyActual,
          planned: line.yearlyPlanned,
        });
      }
    };
    for (let i = 0; i < data.expenseCategories.length; i++)
      check(data.expenseCategories[i]);
    return out;
  }, [data.expenseCategories]);

  const underused = useMemo(() => {
    const out: Array<{ label: string; pct: number }> = [];
    const check = (line: BudgetReportCategoryLine) => {
      if (line.yearlyPlanned <= 0) return;
      const pct = Math.round((line.yearlyActual / line.yearlyPlanned) * 100);
      if (pct < 50) {
        out.push({ label: line.label, pct });
      }
    };
    for (let i = 0; i < data.expenseCategories.length; i++)
      check(data.expenseCategories[i]);
    return out;
  }, [data.expenseCategories]);

  const chartMax = useMemo(() => {
    let max = 1;
    for (let i = 0; i < data.monthlyTotals.length; i++) {
      const t = data.monthlyTotals[i];
      const val = Math.max(
        Math.abs(t.plannedProfit),
        Math.abs(t.actualProfit),
      );
      if (val > max) max = val;
    }
    return max;
  }, [data.monthlyTotals]);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4 landscape; }
          body { background: white !important; }
          .report-print-hide { display: none !important; }
          .report-print-surface {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="report-print-hide flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
        <select
          value={data.year}
          onChange={(e) => changeYear(Number(e.target.value))}
          className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
          aria-label="שנה"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={printInvoice}
          className="ms-auto px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          הדפס
        </button>
      </div>

      <article className="report-print-surface mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-6xl mx-auto">
        <header className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            {company.name && (
              <h2 className="text-lg font-bold text-gray-900">
                {company.name}
              </h2>
            )}
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-gray-900">
              <span aria-hidden className="me-2">
                📈
              </span>
              דוח תקציב שנתי
            </h1>
            <p className="mt-1 text-sm text-gray-700" dir="ltr">
              שנה {data.year}
            </p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">תקציב הכנסות</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5" dir="ltr">
              {formatILS(data.totalIncomePlanned)}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">ביצוע הכנסות</p>
            <p className="text-lg font-bold text-green-700 mt-0.5" dir="ltr">
              {formatILS(data.totalIncomeActual)}{' '}
              <span className="text-xs text-gray-500">
                ({incomeUtilization}%)
              </span>
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">תקציב הוצאות</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5" dir="ltr">
              {formatILS(data.totalExpensePlanned)}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">ביצוע הוצאות</p>
            <p
              className={`text-lg font-bold mt-0.5 ${
                expenseUtilization > 100 ? 'text-red-700' : 'text-gray-900'
              }`}
              dir="ltr"
            >
              {formatILS(data.totalExpenseActual)}{' '}
              <span className="text-xs text-gray-500">
                ({expenseUtilization}%)
              </span>
            </p>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-bold text-green-900 mb-2">הכנסות</h3>
          <div className="overflow-x-auto">
            <table
              data-testid="report-budget-table"
              className="w-full text-sm border border-gray-200"
            >
              <thead className="bg-green-50 text-right">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-700">סעיף</th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    תקציב
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">ביצוע</th>
                  <th className="px-3 py-2 font-medium text-gray-700">אחוז</th>
                  <th className="px-3 py-2 font-medium text-gray-700">הפרש</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.incomeCategories.map((line) => {
                  const pct = utilization(line.yearlyActual, line.yearlyPlanned);
                  const diff = delta(line.yearlyActual, line.yearlyPlanned);
                  return (
                    <tr
                      key={line.key}
                      data-testid="report-budget-row"
                      data-budget-category={line.key}
                    >
                      <td className="px-3 py-2 text-gray-900">{line.label}</td>
                      <td
                        data-testid="report-budget-planned"
                        className="px-3 py-2"
                        dir="ltr"
                      >
                        {formatILS(line.yearlyPlanned)}
                      </td>
                      <td
                        data-testid="report-budget-actual"
                        className="px-3 py-2 font-medium"
                        dir="ltr"
                      >
                        {formatILS(line.yearlyActual)}
                      </td>
                      <td className="px-3 py-2" dir="ltr">
                        {line.yearlyPlanned > 0 ? `${pct}%` : '—'}
                      </td>
                      <td
                        data-testid="report-budget-variance"
                        className={`px-3 py-2 font-medium ${profitClass(diff)}`}
                        dir="ltr"
                      >
                        {diff >= 0 ? '+' : ''}
                        {formatILS(diff)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-green-50 font-bold">
                  <td className="px-3 py-2 text-green-900">סה״כ הכנסות</td>
                  <td
                    data-testid="report-budget-total-income-planned"
                    className="px-3 py-2 text-green-900"
                    dir="ltr"
                  >
                    {formatILS(data.totalIncomePlanned)}
                  </td>
                  <td
                    data-testid="report-budget-total-income-actual"
                    className="px-3 py-2 text-green-900"
                    dir="ltr"
                  >
                    {formatILS(data.totalIncomeActual)}
                  </td>
                  <td className="px-3 py-2 text-green-900" dir="ltr">
                    {data.totalIncomePlanned > 0 ? `${incomeUtilization}%` : '—'}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-bold text-red-900 mb-2">הוצאות</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200">
              <thead className="bg-red-50 text-right">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-700">סעיף</th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    תקציב
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">ביצוע</th>
                  <th className="px-3 py-2 font-medium text-gray-700">אחוז</th>
                  <th className="px-3 py-2 font-medium text-gray-700">הפרש</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.expenseCategories.map((line) => {
                  const pct = utilization(line.yearlyActual, line.yearlyPlanned);
                  const diff = delta(line.yearlyActual, line.yearlyPlanned);
                  const tone = expenseTone(
                    line.yearlyActual,
                    line.yearlyPlanned,
                  );
                  const pctColor =
                    tone === 'over'
                      ? 'text-red-700 font-bold'
                      : tone === 'near'
                        ? 'text-amber-700'
                        : 'text-gray-700';
                  return (
                    <tr
                      key={line.key}
                      data-testid="report-budget-row"
                      data-budget-category={line.key}
                    >
                      <td className="px-3 py-2 text-gray-900">{line.label}</td>
                      <td
                        data-testid="report-budget-planned"
                        className="px-3 py-2"
                        dir="ltr"
                      >
                        {formatILS(line.yearlyPlanned)}
                      </td>
                      <td
                        data-testid="report-budget-actual"
                        className="px-3 py-2 font-medium"
                        dir="ltr"
                      >
                        {formatILS(line.yearlyActual)}
                      </td>
                      <td className={`px-3 py-2 ${pctColor}`} dir="ltr">
                        {line.yearlyPlanned > 0 ? `${pct}%` : '—'}
                      </td>
                      <td
                        data-testid="report-budget-variance"
                        className={`px-3 py-2 font-medium ${
                          diff <= 0 ? 'text-green-700' : 'text-red-700'
                        }`}
                        dir="ltr"
                      >
                        {diff >= 0 ? '+' : ''}
                        {formatILS(diff)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-red-50 font-bold">
                  <td className="px-3 py-2 text-red-900">סה״כ הוצאות</td>
                  <td
                    data-testid="report-budget-total-expense-planned"
                    className="px-3 py-2 text-red-900"
                    dir="ltr"
                  >
                    {formatILS(data.totalExpensePlanned)}
                  </td>
                  <td
                    data-testid="report-budget-total-expense-actual"
                    className="px-3 py-2 text-red-900"
                    dir="ltr"
                  >
                    {formatILS(data.totalExpenseActual)}
                  </td>
                  <td className="px-3 py-2 text-red-900" dir="ltr">
                    {data.totalExpensePlanned > 0
                      ? `${expenseUtilization}%`
                      : '—'}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
                <tr className="bg-amber-50 font-bold">
                  <td className="px-3 py-2 text-amber-900">רווח</td>
                  <td className="px-3 py-2 text-amber-900" dir="ltr">
                    {formatILS(data.plannedProfit)}
                  </td>
                  <td
                    className={`px-3 py-2 ${profitClass(data.actualProfit)}`}
                    dir="ltr"
                  >
                    {formatILS(data.actualProfit)}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-2">
            פילוח חודשי
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-700">חודש</th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    תקציב הכנסות
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    הכנסות בפועל
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    תקציב הוצאות
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    הוצאות בפועל
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">רווח</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.monthlyTotals.map((t) => {
                  const expenseTone2 = expenseTone(
                    t.actualExpense,
                    t.plannedExpense,
                  );
                  const expenseClass =
                    expenseTone2 === 'over'
                      ? 'text-red-700 font-bold'
                      : 'text-gray-900';
                  const incomeClass =
                    t.plannedIncome > 0 && t.actualIncome >= t.plannedIncome
                      ? 'text-green-700 font-medium'
                      : 'text-gray-900';
                  return (
                    <tr key={t.month}>
                      <td className="px-3 py-2 text-gray-900">
                        {HEBREW_MONTHS[t.month - 1]}
                      </td>
                      <td className="px-3 py-2" dir="ltr">
                        {formatILS(t.plannedIncome)}
                      </td>
                      <td className={`px-3 py-2 ${incomeClass}`} dir="ltr">
                        {formatILS(t.actualIncome)}
                      </td>
                      <td className="px-3 py-2" dir="ltr">
                        {formatILS(t.plannedExpense)}
                      </td>
                      <td className={`px-3 py-2 ${expenseClass}`} dir="ltr">
                        {formatILS(t.actualExpense)}
                      </td>
                      <td
                        className={`px-3 py-2 font-bold ${profitClass(t.actualProfit)}`}
                        dir="ltr"
                      >
                        {formatILS(t.actualProfit)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-amber-50 font-bold">
                  <td className="px-3 py-2 text-amber-900">סה״כ שנתי</td>
                  <td className="px-3 py-2 text-amber-900" dir="ltr">
                    {formatILS(data.totalIncomePlanned)}
                  </td>
                  <td className="px-3 py-2 text-amber-900" dir="ltr">
                    {formatILS(data.totalIncomeActual)}
                  </td>
                  <td className="px-3 py-2 text-amber-900" dir="ltr">
                    {formatILS(data.totalExpensePlanned)}
                  </td>
                  <td className="px-3 py-2 text-amber-900" dir="ltr">
                    {formatILS(data.totalExpenseActual)}
                  </td>
                  <td
                    className={`px-3 py-2 ${profitClass(data.actualProfit)}`}
                    dir="ltr"
                  >
                    {formatILS(data.actualProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900 mb-3">
            תרשים רווח חודשי — תקציב מול ביצוע
          </h3>
          <div className="flex items-end gap-2 h-48">
            {data.monthlyTotals.map((t) => {
              const plannedH = (Math.abs(t.plannedProfit) / chartMax) * 100;
              const actualH = (Math.abs(t.actualProfit) / chartMax) * 100;
              const actualColor =
                t.actualProfit >= 0 ? 'bg-green-500' : 'bg-red-500';
              return (
                <div
                  key={t.month}
                  className="flex-1 flex flex-col items-center min-w-0"
                >
                  <div className="flex-1 w-full flex items-end gap-0.5">
                    <div
                      className="flex-1 bg-gray-400 rounded-t"
                      style={{ height: `${plannedH}%` }}
                      title={`תקציב: ${formatILS(t.plannedProfit)}`}
                    />
                    <div
                      className={`flex-1 rounded-t ${actualColor}`}
                      style={{ height: `${actualH}%` }}
                      title={`ביצוע: ${formatILS(t.actualProfit)}`}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-gray-600">
                    {HEBREW_MONTHS_SHORT[t.month - 1]}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-gray-600 flex-wrap justify-end">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-gray-400" />
              תקציב
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500" />
              ביצוע (רווח)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500" />
              ביצוע (הפסד)
            </span>
          </div>
        </section>

        {(warnings.length > 0 || underused.length > 0) && (
          <section className="mt-6 space-y-2">
            {warnings.map((w) => (
              <div
                key={`warn-${w.label}`}
                className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm"
              >
                <span aria-hidden className="me-2">
                  ⚠️
                </span>
                התקציב חורג בסעיף <strong>{w.label}</strong>:{' '}
                <span dir="ltr">
                  {formatILS(w.actual)} / {formatILS(w.planned)}
                </span>{' '}
                (<span dir="ltr">{w.pct}%</span>)
              </div>
            ))}
            {underused.map((u) => (
              <div
                key={`under-${u.label}`}
                className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm"
              >
                <span aria-hidden className="me-2">
                  💡
                </span>
                בסעיף <strong>{u.label}</strong>: נוצל רק{' '}
                <span dir="ltr">{u.pct}%</span> מהתקציב — ייתכן שהתקציב מוגזם
              </div>
            ))}
          </section>
        )}
      </article>
    </>
  );
}
