'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  BUDGET_CATEGORIES,
  type ActualAmounts,
  type BudgetCategory,
} from '@/lib/utils/budget-types';
import { saveBudgetAction } from './actions';

export interface BudgetRow {
  category: string;
  planned_amount: number;
}

export interface MonthlyBudgetRow {
  budget_month: number;
  category: string;
  planned_amount: number;
}

interface BudgetManagerProps {
  tenantId: string;
  equipmentLabel: string;
  year: number;
  month: number | null;
  view: 'current' | 'yearly';
  budgets: BudgetRow[];
  actual: ActualAmounts;
  monthlyBudgets?: MonthlyBudgetRow[];
  monthlyActuals?: ActualAmounts[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

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

function categoryLabel(cat: BudgetCategory, equipmentLabel: string): string {
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
      return 'תשלום עובד';
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

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function progressColor(percentage: number): string {
  if (percentage > 100) return 'bg-red-700';
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 75) return 'bg-yellow-500';
  return 'bg-green-500';
}

function numToInput(n: number): string {
  return n === 0 ? '' : String(n);
}

function Modal({
  onClose,
  children,
  size = 'lg',
}: {
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | '2xl';
}) {
  const widthClass =
    size === '2xl' ? 'max-w-2xl' : size === 'md' ? 'max-w-md' : 'max-w-lg';
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-xl shadow-lg p-6 w-full text-right max-h-[90vh] overflow-y-auto ${widthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
  type = 'button',
  testId,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  testId?: string;
}) {
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 rounded-md bg-[#f59e0b] text-black font-bold text-sm hover:bg-[#d97706] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60"
    >
      {children}
    </button>
  );
}

interface BudgetRowProps {
  label: string;
  planned: number;
  actual: number;
}

function BudgetItemRow({ label, planned, actual }: BudgetRowProps) {
  const percentage = planned > 0 ? (actual / planned) * 100 : 0;
  const hasPlanned = planned > 0;
  const overBudget = percentage > 100;
  const barWidth = Math.min(100, percentage);

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-gray-900 font-medium">{label}</span>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-600" dir="ltr">
            תקציב {formatILS(planned)}
          </span>
          <span className="text-gray-900" dir="ltr">
            ביצוע {formatILS(actual)}
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          {hasPlanned ? (
            <div
              className={`h-full rounded-full ${progressColor(percentage)}`}
              style={{ width: `${barWidth}%` }}
            />
          ) : null}
        </div>
        <span
          className={`text-xs font-medium w-16 text-end ${
            overBudget ? 'text-red-700' : 'text-gray-600'
          }`}
          dir="ltr"
        >
          {hasPlanned ? `${Math.round(percentage)}%` : '—'}
        </span>
      </div>
      {overBudget && (
        <p className="mt-1 text-xs text-red-700 font-bold">חריגה!</p>
      )}
    </div>
  );
}

interface UpdateBudgetModalProps {
  tenantId: string;
  year: number;
  month: number | null;
  equipmentLabel: string;
  currentPlanned: Map<BudgetCategory, number>;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function UpdateBudgetModal({
  tenantId,
  year,
  month,
  equipmentLabel,
  currentPlanned,
  onClose,
  onSuccess,
}: UpdateBudgetModalProps) {
  const initial = useMemo(() => {
    const m: Record<string, string> = {};
    for (let i = 0; i < BUDGET_CATEGORIES.length; i++) {
      const c = BUDGET_CATEGORIES[i];
      m[c] = numToInput(currentPlanned.get(c) ?? 0);
    }
    return m;
  }, [currentPlanned]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(cat: string, v: string): void {
    setValues((prev) => ({ ...prev, [cat]: v }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const items = BUDGET_CATEGORIES.map((c) => ({
        category: c,
        amount: values[c] ?? '',
      }));
      const res = await saveBudgetAction(tenantId, year, month, items);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('התקציב עודכן בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  const periodLabel =
    month == null ? `תקציב שנתי ${year}` : `תקציב ${HEBREW_MONTHS[month - 1]} ${year}`;

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900">עדכון תקציב</h3>
      <p className="mt-1 text-sm text-gray-600">{periodLabel}</p>

      <form
        onSubmit={handleSubmit}
        data-testid="budget-form"
        className="mt-4 space-y-5"
      >
        <section>
          <h4 className="text-sm font-semibold text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-1.5">
            הכנסות
          </h4>
          <div className="mt-2 space-y-2">
            {INCOME_CATEGORIES.map((cat) => (
              <div
                key={cat}
                data-testid="budget-category-row"
                data-budget-category={cat}
                className="grid grid-cols-[1fr_10rem] gap-3 items-center"
              >
                <label
                  data-testid="budget-category-name"
                  className="text-sm text-gray-700"
                >
                  {categoryLabel(cat, equipmentLabel)}
                </label>
                <input
                  type="number"
                  data-testid="budget-category-amount"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  placeholder="0"
                  value={values[cat] ?? ''}
                  onChange={(e) => handleChange(cat, e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-1.5">
            הוצאות
          </h4>
          <div className="mt-2 space-y-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <div
                key={cat}
                data-testid="budget-category-row"
                data-budget-category={cat}
                className="grid grid-cols-[1fr_10rem] gap-3 items-center"
              >
                <label
                  data-testid="budget-category-name"
                  className="text-sm text-gray-700"
                >
                  {categoryLabel(cat, equipmentLabel)}
                </label>
                <input
                  type="number"
                  data-testid="budget-category-amount"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  placeholder="0"
                  value={values[cat] ?? ''}
                  onChange={(e) => handleChange(cat, e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            data-testid="budget-error"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton
            onClick={onClose}
            disabled={submitting}
            testId="budget-cancel"
          >
            ביטול
          </GhostButton>
          <PrimaryButton
            type="submit"
            disabled={submitting}
            testId="budget-submit"
          >
            {submitting ? 'שומר...' : 'שמור תקציב'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

const SHORT_HEBREW_MONTHS = [
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

interface YearlyViewProps {
  equipmentLabel: string;
  monthlyBudgets: MonthlyBudgetRow[];
  monthlyActuals: ActualAmounts[];
}

function YearlyView({
  equipmentLabel,
  monthlyBudgets,
  monthlyActuals,
}: YearlyViewProps) {
  const plannedByMonth: Array<Map<BudgetCategory, number>> = Array.from(
    { length: 12 },
    () => new Map(),
  );
  for (let i = 0; i < monthlyBudgets.length; i++) {
    const b = monthlyBudgets[i];
    const monthIdx = b.budget_month - 1;
    if (monthIdx < 0 || monthIdx > 11) continue;
    if ((BUDGET_CATEGORIES as readonly string[]).includes(b.category)) {
      plannedByMonth[monthIdx].set(
        b.category as BudgetCategory,
        b.planned_amount,
      );
    }
  }

  function yearlyActualSum(cat: BudgetCategory): number {
    let s = 0;
    for (let i = 0; i < monthlyActuals.length; i++) s += monthlyActuals[i][cat];
    return s;
  }

  function yearlyPlannedSum(cat: BudgetCategory): number {
    let s = 0;
    for (let i = 0; i < plannedByMonth.length; i++)
      s += plannedByMonth[i].get(cat) ?? 0;
    return s;
  }

  function cellColor(
    cat: BudgetCategory,
    actual: number,
    planned: number,
  ): string {
    if (planned === 0) {
      return actual > 0 ? 'text-gray-900' : 'text-gray-400';
    }
    const ratio = actual / planned;
    const isExpense = cat.startsWith('expense_');
    if (isExpense) {
      if (ratio > 1) return 'text-red-700 font-bold';
      if (ratio >= 0.9) return 'text-amber-700';
      return 'text-gray-900';
    }
    if (ratio >= 1) return 'text-green-700 font-bold';
    if (ratio < 0.5 && planned > 0) return 'text-red-700';
    return 'text-gray-900';
  }

  const monthIncomeTotals = monthlyActuals.map((m) =>
    INCOME_CATEGORIES.reduce((s, c) => s + m[c], 0),
  );
  const monthExpenseTotals = monthlyActuals.map((m) =>
    EXPENSE_CATEGORIES.reduce((s, c) => s + m[c], 0),
  );
  const monthProfits = monthIncomeTotals.map(
    (inc, i) => inc - monthExpenseTotals[i],
  );

  const monthPlannedIncome = plannedByMonth.map((m) =>
    INCOME_CATEGORIES.reduce((s, c) => s + (m.get(c) ?? 0), 0),
  );
  const monthPlannedExpense = plannedByMonth.map((m) =>
    EXPENSE_CATEGORIES.reduce((s, c) => s + (m.get(c) ?? 0), 0),
  );

  const yearlyIncomeActual = monthIncomeTotals.reduce((a, b) => a + b, 0);
  const yearlyExpenseActual = monthExpenseTotals.reduce((a, b) => a + b, 0);
  const yearlyProfitActual = yearlyIncomeActual - yearlyExpenseActual;

  const chartMax = Math.max(
    1,
    ...monthIncomeTotals,
    ...monthExpenseTotals,
  );

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs md:text-sm">
          <thead className="bg-gray-50">
            <tr className="text-right">
              <th className="sticky end-0 bg-gray-50 px-2 py-2 font-medium text-gray-700 min-w-[10rem]">
                קטגוריה
              </th>
              {SHORT_HEBREW_MONTHS.map((m) => (
                <th
                  key={m}
                  className="px-2 py-2 font-medium text-gray-700 text-center min-w-[4.5rem]"
                >
                  {m}
                </th>
              ))}
              <th className="px-2 py-2 font-medium text-gray-900 text-center bg-amber-50 min-w-[6rem]">
                סה״כ שנתי
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="bg-green-50/40">
              <td
                colSpan={14}
                className="px-2 py-1 text-xs font-bold text-green-800"
              >
                הכנסות
              </td>
            </tr>
            {INCOME_CATEGORIES.map((cat) => (
              <tr key={cat}>
                <td className="sticky end-0 bg-white px-2 py-2 text-gray-900 font-medium">
                  {categoryLabel(cat, equipmentLabel)}
                </td>
                {monthlyActuals.map((m, i) => {
                  const planned = plannedByMonth[i].get(cat) ?? 0;
                  const actual = m[cat];
                  return (
                    <td
                      key={i}
                      className="px-2 py-2 text-center leading-tight"
                    >
                      <div
                        className={`${cellColor(cat, actual, planned)}`}
                        dir="ltr"
                      >
                        {formatILS(actual)}
                      </div>
                      <div className="text-[10px] text-gray-400" dir="ltr">
                        / {formatILS(planned)}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center bg-amber-50/50 font-semibold" dir="ltr">
                  {formatILS(yearlyActualSum(cat))}
                  <div className="text-[10px] text-gray-400">
                    / {formatILS(yearlyPlannedSum(cat))}
                  </div>
                </td>
              </tr>
            ))}

            <tr className="bg-red-50/40">
              <td
                colSpan={14}
                className="px-2 py-1 text-xs font-bold text-red-800"
              >
                הוצאות
              </td>
            </tr>
            {EXPENSE_CATEGORIES.map((cat) => (
              <tr key={cat}>
                <td className="sticky end-0 bg-white px-2 py-2 text-gray-900 font-medium">
                  {categoryLabel(cat, equipmentLabel)}
                </td>
                {monthlyActuals.map((m, i) => {
                  const planned = plannedByMonth[i].get(cat) ?? 0;
                  const actual = m[cat];
                  return (
                    <td
                      key={i}
                      className="px-2 py-2 text-center leading-tight"
                    >
                      <div
                        className={`${cellColor(cat, actual, planned)}`}
                        dir="ltr"
                      >
                        {formatILS(actual)}
                      </div>
                      <div className="text-[10px] text-gray-400" dir="ltr">
                        / {formatILS(planned)}
                      </div>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center bg-amber-50/50 font-semibold" dir="ltr">
                  {formatILS(yearlyActualSum(cat))}
                  <div className="text-[10px] text-gray-400">
                    / {formatILS(yearlyPlannedSum(cat))}
                  </div>
                </td>
              </tr>
            ))}

            <tr className="bg-amber-50 border-t-2 border-amber-200">
              <td className="sticky end-0 bg-amber-50 px-2 py-2 font-bold text-gray-900">
                רווח
              </td>
              {monthProfits.map((p, i) => {
                const plannedProfit =
                  monthPlannedIncome[i] - monthPlannedExpense[i];
                return (
                  <td
                    key={i}
                    className="px-2 py-2 text-center leading-tight"
                  >
                    <div
                      className={`font-bold ${
                        p >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                      dir="ltr"
                    >
                      {formatILS(p)}
                    </div>
                    <div className="text-[10px] text-gray-400" dir="ltr">
                      / {formatILS(plannedProfit)}
                    </div>
                  </td>
                );
              })}
              <td
                className={`px-2 py-2 text-center font-bold ${
                  yearlyProfitActual >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
                dir="ltr"
              >
                {formatILS(yearlyProfitActual)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">
          תרשים חודשי — הכנסות מול הוצאות
        </h3>
        <div className="flex items-end gap-2 h-40">
          {SHORT_HEBREW_MONTHS.map((label, i) => {
            const incomeH = (monthIncomeTotals[i] / chartMax) * 100;
            const expenseH = (monthExpenseTotals[i] / chartMax) * 100;
            const profit = monthProfits[i];
            return (
              <div
                key={label}
                className="flex-1 flex flex-col items-center min-w-0"
              >
                <div className="flex-1 w-full flex items-end gap-0.5">
                  <div
                    className="flex-1 bg-green-500 rounded-t"
                    style={{ height: `${incomeH}%` }}
                    title={`הכנסה: ${formatILS(monthIncomeTotals[i])}`}
                  />
                  <div
                    className="flex-1 bg-red-500 rounded-t"
                    style={{ height: `${expenseH}%` }}
                    title={`הוצאה: ${formatILS(monthExpenseTotals[i])}`}
                  />
                </div>
                <div className="mt-1 text-[10px] text-gray-600">{label}</div>
                <div
                  className={`text-[10px] font-medium ${
                    profit >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                  dir="ltr"
                >
                  {formatILS(profit)}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-600 justify-end">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-500" />
            הכנסה
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500" />
            הוצאה
          </span>
        </div>
      </section>
    </>
  );
}

export function BudgetManager({
  tenantId,
  equipmentLabel,
  year,
  month,
  view,
  budgets,
  actual,
  monthlyBudgets,
  monthlyActuals,
}: BudgetManagerProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const plannedMap = useMemo(() => {
    const m = new Map<BudgetCategory, number>();
    for (let i = 0; i < budgets.length; i++) {
      const b = budgets[i];
      if ((BUDGET_CATEGORIES as readonly string[]).includes(b.category)) {
        m.set(b.category as BudgetCategory, b.planned_amount);
      }
    }
    return m;
  }, [budgets]);

  const totals = useMemo(() => {
    let plannedIncome = 0;
    let actualIncome = 0;
    let plannedExpenses = 0;
    let actualExpenses = 0;
    for (let i = 0; i < INCOME_CATEGORIES.length; i++) {
      const c = INCOME_CATEGORIES[i];
      plannedIncome += plannedMap.get(c) ?? 0;
      actualIncome += actual[c];
    }
    for (let i = 0; i < EXPENSE_CATEGORIES.length; i++) {
      const c = EXPENSE_CATEGORIES[i];
      plannedExpenses += plannedMap.get(c) ?? 0;
      actualExpenses += actual[c];
    }
    return {
      plannedIncome,
      actualIncome,
      plannedExpenses,
      actualExpenses,
      plannedProfit: plannedIncome - plannedExpenses,
      actualProfit: actualIncome - actualExpenses,
    };
  }, [plannedMap, actual]);

  const hasBudget = budgets.length > 0;

  function navigate(
    nextYear: number,
    nextMonth: number | null,
    nextView: 'current' | 'yearly' = view,
  ): void {
    const params = new URLSearchParams();
    params.set('year', String(nextYear));
    if (nextView === 'yearly') {
      params.set('view', 'yearly');
    } else if (nextMonth != null) {
      params.set('month', String(nextMonth));
    }
    router.push(`/budget?${params.toString()}`);
  }

  function handleSuccess(text: string): void {
    setShowModal(false);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  const periodLabel =
    month == null ? String(year) : `${HEBREW_MONTHS[month - 1]} ${year}`;

  return (
    <div data-testid="budget" className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            📊
          </span>
          תקציב מול ביצוע
        </h1>
      </header>

      <div className="flex flex-col md:flex-row gap-2 md:items-center flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate(year - 1, month)}
            aria-label="שנה קודמת"
            className="w-9 h-9 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            →
          </button>
          <span
            data-testid="budget-year"
            className="px-3 py-2 rounded-md bg-white border border-gray-200 font-bold text-gray-900 min-w-[4rem] text-center"
          >
            {year}
          </span>
          <button
            type="button"
            onClick={() => navigate(year + 1, month)}
            aria-label="שנה הבאה"
            className="w-9 h-9 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            ←
          </button>
        </div>
        {view === 'current' && (
          <select
            data-testid="budget-month"
            value={month == null ? 'all' : String(month)}
            onChange={(e) =>
              navigate(
                year,
                e.target.value === 'all' ? null : Number(e.target.value),
              )
            }
            className={`${INPUT_CLASS} md:w-40`}
            aria-label="בחירת תקופה"
          >
            <option value="all">שנתי</option>
            {HEBREW_MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        )}
        <div
          data-testid="budget-period-toggle"
          className="inline-flex rounded-md border border-gray-300 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => navigate(year, month, 'current')}
            className={`px-3 py-2 text-sm font-medium ${
              view === 'current'
                ? 'bg-[#f59e0b] text-black'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            תצוגה נוכחית
          </button>
          <button
            type="button"
            onClick={() => navigate(year, null, 'yearly')}
            className={`px-3 py-2 text-sm font-medium border-s border-gray-300 ${
              view === 'yearly'
                ? 'bg-[#f59e0b] text-black'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            השוואה שנתית
          </button>
        </div>
        {view === 'current' && (
          <PrimaryButton
            onClick={() => setShowModal(true)}
            testId="budget-update-button"
          >
            עדכן תקציב
          </PrimaryButton>
        )}
      </div>

      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg text-sm text-center border ${
            message.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {view === 'yearly' ? (
        <YearlyView
          equipmentLabel={equipmentLabel}
          monthlyBudgets={monthlyBudgets ?? []}
          monthlyActuals={monthlyActuals ?? []}
        />
      ) : !hasBudget ? (
        <div
          data-testid="budget-empty"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center"
        >
          <p className="text-gray-600">
            לא הוגדר תקציב ל{periodLabel}. הגדר תקציב כדי לעקוב אחר ביצוע.
          </p>
          <div className="mt-4 flex justify-center">
            <PrimaryButton
              onClick={() => setShowModal(true)}
              testId="budget-update-button"
            >
              הגדר תקציב
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <>
          <section className="bg-[#ecfdf5] border border-green-200 rounded-xl p-4">
            <h2 className="text-base font-bold text-green-800 mb-2">הכנסות</h2>
            <div className="divide-y divide-green-100">
              {INCOME_CATEGORIES.map((cat) => (
                <BudgetItemRow
                  key={cat}
                  label={categoryLabel(cat, equipmentLabel)}
                  planned={plannedMap.get(cat) ?? 0}
                  actual={actual[cat]}
                />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t-2 border-green-200 flex items-center justify-between text-sm font-bold">
              <span className="text-green-900">סה״כ הכנסות</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-700" dir="ltr">
                  תקציב {formatILS(totals.plannedIncome)}
                </span>
                <span className="text-green-900" dir="ltr">
                  ביצוע {formatILS(totals.actualIncome)}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-[#fef2f2] border border-red-200 rounded-xl p-4">
            <h2 className="text-base font-bold text-red-800 mb-2">הוצאות</h2>
            <div className="divide-y divide-red-100">
              {EXPENSE_CATEGORIES.map((cat) => (
                <BudgetItemRow
                  key={cat}
                  label={categoryLabel(cat, equipmentLabel)}
                  planned={plannedMap.get(cat) ?? 0}
                  actual={actual[cat]}
                />
              ))}
            </div>
            <div className="mt-3 pt-3 border-t-2 border-red-200 flex items-center justify-between text-sm font-bold">
              <span className="text-red-900">סה״כ הוצאות</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-gray-700" dir="ltr">
                  תקציב {formatILS(totals.plannedExpenses)}
                </span>
                <span className="text-red-900" dir="ltr">
                  ביצוע {formatILS(totals.actualExpenses)}
                </span>
              </div>
            </div>
          </section>

          <section className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h2 className="text-base font-bold text-amber-900 mb-3">סיכום</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-700">סה״כ הכנסות מתוכננות:</dt>
                <dd className="font-medium" dir="ltr">
                  {formatILS(totals.plannedIncome)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">סה״כ הוצאות מתוכננות:</dt>
                <dd className="font-medium" dir="ltr">
                  {formatILS(totals.plannedExpenses)}
                </dd>
              </div>
              <div className="flex justify-between border-b border-amber-200 pb-2">
                <dt className="text-gray-800 font-semibold">רווח מתוכנן:</dt>
                <dd
                  className={`font-bold ${
                    totals.plannedProfit >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                  dir="ltr"
                >
                  {formatILS(totals.plannedProfit)}
                </dd>
              </div>
              <div className="flex justify-between pt-2">
                <dt className="text-gray-700">סה״כ הכנסות בפועל:</dt>
                <dd className="font-medium" dir="ltr">
                  {formatILS(totals.actualIncome)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">סה״כ הוצאות בפועל:</dt>
                <dd className="font-medium" dir="ltr">
                  {formatILS(totals.actualExpenses)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-amber-200 pt-2 mt-1">
                <dt className="text-gray-900 font-bold">רווח בפועל:</dt>
                <dd
                  className={`font-bold text-base ${
                    totals.actualProfit >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                  dir="ltr"
                >
                  {formatILS(totals.actualProfit)}
                </dd>
              </div>
            </dl>
          </section>
        </>
      )}

      {showModal && (
        <UpdateBudgetModal
          tenantId={tenantId}
          year={year}
          month={month}
          equipmentLabel={equipmentLabel}
          currentPlanned={plannedMap}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
