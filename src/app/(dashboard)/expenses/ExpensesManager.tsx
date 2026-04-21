'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type ExpensePayload,
  addExpenseAction,
  deleteExpenseAction,
  updateExpenseAction,
} from './actions';
import { VALID_CATEGORIES, type ExpenseCategory } from './categories';

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: ExpenseCategory;
  amount: number;
  description: string | null;
  vehicle_id: string | null;
  equipment_id: string | null;
  worker_id: string | null;
  receipt_ref: string | null;
  notes: string | null;
  vehicle_name: string | null;
  equipment_name: string | null;
  worker_name: string | null;
}

export interface VehicleOption {
  id: string;
  name: string;
  license_plate: string;
}

export interface EquipmentOption {
  id: string;
  name: string;
}

export interface WorkerOption {
  id: string;
  full_name: string;
}

interface ExpensesManagerProps {
  tenantId: string;
  userId: string;
  equipmentLabel: string;
  expenses: ExpenseRow[];
  vehicles: VehicleOption[];
  equipment: EquipmentOption[];
  workers: WorkerOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; expense: ExpenseRow }
  | { kind: 'delete'; expense: ExpenseRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: 'דלק',
  vehicle_insurance: 'ביטוח רכב',
  vehicle_license: 'רישיון רכב',
  vehicle_maintenance: 'תחזוקת רכב',
  vehicle_rental: 'השכרת רכב',
  equipment_maintenance: 'תחזוקת ציוד',
  worker_payment: 'תשלום עובד',
  office: 'משרד',
  phone: 'טלפון',
  internet: 'אינטרנט',
  other: 'אחר',
};

const CATEGORY_BADGE: Record<ExpenseCategory, string> = {
  fuel: 'bg-amber-100 text-amber-800',
  vehicle_insurance: 'bg-blue-100 text-blue-800',
  vehicle_license: 'bg-indigo-100 text-indigo-800',
  vehicle_maintenance: 'bg-cyan-100 text-cyan-800',
  vehicle_rental: 'bg-teal-100 text-teal-800',
  equipment_maintenance: 'bg-purple-100 text-purple-800',
  worker_payment: 'bg-pink-100 text-pink-800',
  office: 'bg-gray-100 text-gray-800',
  phone: 'bg-gray-100 text-gray-800',
  internet: 'bg-gray-100 text-gray-800',
  other: 'bg-gray-100 text-gray-800',
};

const CATEGORY_BAR: Record<ExpenseCategory, string> = {
  fuel: 'bg-amber-500',
  vehicle_insurance: 'bg-blue-500',
  vehicle_license: 'bg-indigo-500',
  vehicle_maintenance: 'bg-cyan-500',
  vehicle_rental: 'bg-teal-500',
  equipment_maintenance: 'bg-purple-500',
  worker_payment: 'bg-pink-500',
  office: 'bg-gray-400',
  phone: 'bg-gray-400',
  internet: 'bg-gray-400',
  other: 'bg-gray-400',
};

type LinkageKind = 'vehicle' | 'equipment' | 'worker' | null;

function linkageKind(category: string): LinkageKind {
  if (
    category === 'fuel' ||
    category === 'vehicle_insurance' ||
    category === 'vehicle_license' ||
    category === 'vehicle_maintenance' ||
    category === 'vehicle_rental'
  )
    return 'vehicle';
  if (category === 'equipment_maintenance') return 'equipment';
  if (category === 'worker_payment') return 'worker';
  return null;
}

function CategoryBadge({ category }: { category: ExpenseCategory }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_BADGE[category]}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function toNum(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

function formatDateIL(iso: string): string {
  const s = (iso ?? '').slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return iso ?? '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function numToInput(n: number | null | undefined): string {
  if (n == null || n === 0) return '';
  return String(n);
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

interface ExpenseFormModalProps {
  tenantId: string;
  userId: string;
  equipmentLabel: string;
  vehicles: VehicleOption[];
  equipment: EquipmentOption[];
  workers: WorkerOption[];
  mode: 'add' | 'edit';
  expense?: ExpenseRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ExpenseFormModal({
  tenantId,
  userId,
  equipmentLabel,
  vehicles,
  equipment,
  workers,
  mode,
  expense,
  onClose,
  onSuccess,
}: ExpenseFormModalProps) {
  const editing = mode === 'edit';

  const [expenseDate, setExpenseDate] = useState(
    expense?.expense_date.slice(0, 10) ?? todayIso(),
  );
  const [category, setCategory] = useState<string>(expense?.category ?? '');
  const [amount, setAmount] = useState(numToInput(expense?.amount ?? null));
  const [description, setDescription] = useState(expense?.description ?? '');
  const [vehicleId, setVehicleId] = useState(expense?.vehicle_id ?? '');
  const [equipmentId, setEquipmentId] = useState(expense?.equipment_id ?? '');
  const [workerId, setWorkerId] = useState(expense?.worker_id ?? '');
  const [receiptRef, setReceiptRef] = useState(expense?.receipt_ref ?? '');
  const [notes, setNotes] = useState(expense?.notes ?? '');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const linkage = linkageKind(category);

  function handleCategoryChange(newCat: string): void {
    setCategory(newCat);
    const next = linkageKind(newCat);
    if (next !== 'vehicle') setVehicleId('');
    if (next !== 'equipment') setEquipmentId('');
    if (next !== 'worker') setWorkerId('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!expenseDate) {
      setError('תאריך חובה');
      return;
    }
    if (!category) {
      setError('קטגוריה חובה');
      return;
    }
    const amountNum = toNum(amount);
    if (amountNum <= 0) {
      setError('יש להזין סכום גדול מ-0');
      return;
    }

    const payload: ExpensePayload = {
      expenseDate,
      category,
      amount,
      description,
      vehicleId: linkage === 'vehicle' ? vehicleId : '',
      equipmentId: linkage === 'equipment' ? equipmentId : '',
      workerId: linkage === 'worker' ? workerId : '',
      receiptRef,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateExpenseAction(tenantId, expense!.id, payload)
        : await addExpenseAction(tenantId, userId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'ההוצאה עודכנה בהצלחה' : 'ההוצאה נוספה בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת הוצאה' : 'הוספת הוצאה'}
      </h3>
      <form
        onSubmit={handleSubmit}
        data-testid="expenses-form"
        className="space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              data-testid="expenses-form-expense-date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              קטגוריה <span className="text-red-500">*</span>
            </label>
            <select
              data-testid="expenses-form-category"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              required
              className={INPUT_CLASS}
            >
              <option value="">בחר קטגוריה</option>
              {VALID_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סכום <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              data-testid="expenses-form-amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min="0"
              step="0.01"
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תיאור
            </label>
            <input
              type="text"
              data-testid="expenses-form-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          {linkage === 'vehicle' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                רכב
              </label>
              <select
                data-testid="expenses-form-vehicle-id"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">ללא</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.license_plate})
                  </option>
                ))}
              </select>
            </div>
          )}
          {linkage === 'equipment' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {equipmentLabel}
              </label>
              <select
                data-testid="expenses-form-equipment-id"
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">ללא</option>
                {equipment.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {linkage === 'worker' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                עובד
              </label>
              <select
                data-testid="expenses-form-worker-id"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">ללא</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              אסמכתא
            </label>
            <input
              type="text"
              data-testid="expenses-form-receipt-ref"
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            הערות
          </label>
          <textarea
            data-testid="expenses-form-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </div>

        {error && (
          <div
            role="alert"
            data-testid="expenses-form-error"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton
            onClick={onClose}
            disabled={submitting}
            testId="expenses-form-cancel"
          >
            ביטול
          </GhostButton>
          <PrimaryButton
            type="submit"
            disabled={submitting}
            testId="expenses-form-submit"
          >
            {submitting ? 'שומר...' : 'שמור'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

interface DeleteModalProps {
  tenantId: string;
  expense: ExpenseRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function DeleteModal({
  tenantId,
  expense,
  onClose,
  onSuccess,
}: DeleteModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await deleteExpenseAction(tenantId, expense.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('ההוצאה נמחקה בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div data-testid="expenses-delete-modal">
        <h3 className="text-lg font-bold text-gray-900">מחיקת הוצאה</h3>
        <p className="mt-2 text-sm text-gray-600">
          האם למחוק את ההוצאה מתאריך{' '}
          <span dir="ltr">{formatDateIL(expense.expense_date)}</span> על סך{' '}
          <span dir="ltr">{formatILS(expense.amount)}</span>? פעולה זו אינה
          ניתנת לביטול.
        </p>
        {error && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <GhostButton
            onClick={onClose}
            disabled={submitting}
            testId="expenses-delete-cancel"
          >
            ביטול
          </GhostButton>
          <button
            type="button"
            data-testid="expenses-delete-confirm"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {submitting ? 'מוחק...' : 'מחק'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function linkageName(expense: ExpenseRow): string | null {
  return (
    expense.vehicle_name ??
    expense.equipment_name ??
    expense.worker_name ??
    null
  );
}

function ExpenseCard({
  expense,
  onEdit,
  onDelete,
}: {
  expense: ExpenseRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const linked = linkageName(expense);
  return (
    <div
      data-testid="expenses-row"
      data-expense-id={expense.id}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            data-testid="expenses-row-date"
            className="font-bold text-gray-900"
            dir="ltr"
          >
            {formatDateIL(expense.expense_date)}
          </p>
          <div data-testid="expenses-row-category" className="mt-1">
            <CategoryBadge category={expense.category} />
          </div>
        </div>
        <span
          data-testid="expenses-row-amount"
          className="font-bold text-gray-900"
          dir="ltr"
        >
          {formatILS(expense.amount)}
        </span>
      </header>
      {expense.description && (
        <p
          data-testid="expenses-row-description"
          className="mt-2 text-sm text-gray-700 truncate"
        >
          {expense.description}
        </p>
      )}
      {linked && (
        <p className="mt-1 text-sm text-gray-500 truncate">
          משויך ל: {linked}
        </p>
      )}
      <div className="mt-3 flex items-center justify-end gap-1">
        <GhostButton onClick={onEdit} testId="expenses-row-edit">
          עריכה
        </GhostButton>
        <button
          type="button"
          data-testid="expenses-row-delete"
          onClick={onDelete}
          className="px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50"
        >
          מחיקה
        </button>
      </div>
    </div>
  );
}

export function ExpensesManager({
  tenantId,
  userId,
  equipmentLabel,
  expenses,
  vehicles,
  equipment,
  workers,
}: ExpensesManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (fromDate && e.expense_date < fromDate) return false;
      if (toDate && e.expense_date > toDate) return false;
      if (filterCategory !== 'all' && e.category !== filterCategory)
        return false;
      return true;
    });
  }, [expenses, fromDate, toDate, filterCategory]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const byCategory = new Map<ExpenseCategory, number>();
    let total = 0;
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const d = new Date(e.expense_date);
      if (
        Number.isNaN(d.getTime()) ||
        d.getFullYear() !== y ||
        d.getMonth() !== m
      )
        continue;
      total += e.amount;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
    }
    const top3 = Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }));
    return { total, top3 };
  }, [expenses]);

  function handleSuccess(text: string): void {
    setModal(null);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            💰
          </span>
          הוצאות
        </h1>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">סה״כ הוצאות החודש</p>
          <p className="text-2xl font-bold text-gray-900" dir="ltr">
            {formatILS(monthlyStats.total)}
          </p>
        </div>
        {monthlyStats.top3.length > 0 && (
          <div className="mt-4 space-y-2">
            {monthlyStats.top3.map(({ category, amount, percentage }) => (
              <div key={category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className="text-gray-900 font-medium" dir="ltr">
                    {formatILS(amount)}
                  </span>
                </div>
                <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_BAR[category]}`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-end flex-wrap">
        <PrimaryButton
          onClick={() => setModal({ kind: 'add' })}
          testId="expenses-add-button"
        >
          + הוסף הוצאה
        </PrimaryButton>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">מתאריך</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              dir="ltr"
              className={`${INPUT_CLASS} w-36`}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">עד תאריך</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              dir="ltr"
              className={`${INPUT_CLASS} w-36`}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">קטגוריה</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={`${INPUT_CLASS} md:w-44`}
          >
            <option value="all">כל הקטגוריות</option>
            {VALID_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
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

      {expenses.length === 0 ? (
        <div
          data-testid="expenses-empty"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center"
        >
          <p className="text-gray-600">אין הוצאות עדיין.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            אין הוצאות התואמות לסינון שנבחר
          </p>
        </div>
      ) : (
        <>
          <div
            data-testid="expenses-list"
            className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">תאריך</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    קטגוריה
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סכום</th>
                  <th className="px-4 py-3 font-medium text-gray-700">תיאור</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    משויך ל
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => {
                  const linked = linkageName(e);
                  return (
                    <tr
                      key={e.id}
                      data-testid="expenses-row"
                      data-expense-id={e.id}
                    >
                      <td
                        data-testid="expenses-row-date"
                        className="px-4 py-3"
                        dir="ltr"
                      >
                        {formatDateIL(e.expense_date)}
                      </td>
                      <td data-testid="expenses-row-category" className="px-4 py-3">
                        <CategoryBadge category={e.category} />
                      </td>
                      <td
                        data-testid="expenses-row-amount"
                        className="px-4 py-3 font-medium text-gray-900"
                        dir="ltr"
                      >
                        {formatILS(e.amount)}
                      </td>
                      <td
                        data-testid="expenses-row-description"
                        className="px-4 py-3 text-gray-700 max-w-xs truncate"
                      >
                        {e.description ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700 truncate">
                        {linked ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <GhostButton
                            onClick={() => setModal({ kind: 'edit', expense: e })}
                            testId="expenses-row-edit"
                          >
                            עריכה
                          </GhostButton>
                          <button
                            type="button"
                            data-testid="expenses-row-delete"
                            onClick={() =>
                              setModal({ kind: 'delete', expense: e })
                            }
                            className="px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50"
                          >
                            מחיקה
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div data-testid="expenses-list" className="md:hidden space-y-3">
            {filtered.map((e) => (
              <ExpenseCard
                key={e.id}
                expense={e}
                onEdit={() => setModal({ kind: 'edit', expense: e })}
                onDelete={() => setModal({ kind: 'delete', expense: e })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.kind === 'add' && (
        <ExpenseFormModal
          tenantId={tenantId}
          userId={userId}
          equipmentLabel={equipmentLabel}
          vehicles={vehicles}
          equipment={equipment}
          workers={workers}
          mode="add"
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <ExpenseFormModal
          key={modal.expense.id}
          tenantId={tenantId}
          userId={userId}
          equipmentLabel={equipmentLabel}
          vehicles={vehicles}
          equipment={equipment}
          workers={workers}
          mode="edit"
          expense={modal.expense}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'delete' && (
        <DeleteModal
          key={modal.expense.id}
          tenantId={tenantId}
          expense={modal.expense}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
