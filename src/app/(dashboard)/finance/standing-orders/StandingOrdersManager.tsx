'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type StandingOrderFrequency,
  type StandingOrderPayload,
  addStandingOrderAction,
  toggleStandingOrderAction,
  updateStandingOrderAction,
} from '../actions';

export interface StandingOrderRow {
  id: string;
  bank_account_id: string;
  payee_name: string;
  amount: number;
  frequency: StandingOrderFrequency;
  day_of_month: number | null;
  category: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  next_execution: string | null;
  last_executed: string | null;
  notes: string | null;
  is_active: number;
  bank_name: string;
  account_number: string;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  account_number: string;
}

interface StandingOrdersManagerProps {
  tenantId: string;
  orders: StandingOrderRow[];
  bankAccounts: BankAccountOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; order: StandingOrderRow }
  | { kind: 'toggle'; order: StandingOrderRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const FREQUENCY_LABELS: Record<StandingOrderFrequency, string> = {
  weekly: 'שבועי',
  monthly: 'חודשי',
  bimonthly: 'דו-חודשי',
  quarterly: 'רבעוני',
  yearly: 'שנתי',
};

const CATEGORY_LABELS: Record<string, string> = {
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
const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS);

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

function formatDateIL(iso: string | null): string {
  if (!iso) return '—';
  const s = iso.slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
      }`}
    >
      {active ? 'פעיל' : 'מושבת'}
    </span>
  );
}

function NextExecutionCell({
  date,
  active,
}: {
  date: string | null;
  active: boolean;
}) {
  if (!date) return <span className="text-gray-400">—</span>;
  const days = daysUntil(date);
  const display = formatDateIL(date);
  if (active && days !== null && days >= 0 && days <= 7) {
    return (
      <span className="text-red-600 font-bold" dir="ltr">
        <span aria-hidden className="me-1">
          ⚠️
        </span>
        {display}
      </span>
    );
  }
  return (
    <span className="text-gray-700" dir="ltr">
      {display}
    </span>
  );
}

interface OrderFormModalProps {
  tenantId: string;
  bankAccounts: BankAccountOption[];
  mode: 'add' | 'edit';
  order?: StandingOrderRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function OrderFormModal({
  tenantId,
  bankAccounts,
  mode,
  order,
  onClose,
  onSuccess,
}: OrderFormModalProps) {
  const editing = mode === 'edit';
  const [bankAccountId, setBankAccountId] = useState(
    order?.bank_account_id ?? bankAccounts[0]?.id ?? '',
  );
  const [payeeName, setPayeeName] = useState(order?.payee_name ?? '');
  const [amount, setAmount] = useState(order ? String(order.amount) : '');
  const [frequency, setFrequency] = useState<StandingOrderFrequency>(
    order?.frequency ?? 'monthly',
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    order?.day_of_month != null ? String(order.day_of_month) : '1',
  );
  const [category, setCategory] = useState(order?.category ?? '');
  const [description, setDescription] = useState(order?.description ?? '');
  const [startDate, setStartDate] = useState(
    order?.start_date.slice(0, 10) ?? todayIso(),
  );
  const [endDate, setEndDate] = useState(order?.end_date?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showDayOfMonth =
    frequency === 'monthly' ||
    frequency === 'bimonthly' ||
    frequency === 'quarterly';

  const noBanks = bankAccounts.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!bankAccountId) {
      setError('חשבון בנק חובה');
      return;
    }
    if (!payeeName.trim()) {
      setError('שם המוטב חובה');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('סכום לא חוקי');
      return;
    }
    if (!startDate) {
      setError('תאריך התחלה חובה');
      return;
    }

    const payload: StandingOrderPayload = {
      bankAccountId,
      payeeName,
      amount,
      frequency,
      dayOfMonth: showDayOfMonth ? dayOfMonth : '',
      category,
      description,
      startDate,
      endDate,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateStandingOrderAction(tenantId, order!.id, payload)
        : await addStandingOrderAction(tenantId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(
        editing ? 'הוראת הקבע עודכנה בהצלחה' : 'הוראת הקבע נוספה בהצלחה',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת הוראת קבע' : 'הוספת הוראת קבע'}
      </h3>
      {noBanks && !editing ? (
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          יש להוסיף חשבון בנק לפני הגדרת הוראת קבע.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          data-testid="standing-orders-form"
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              חשבון בנק <span className="text-red-500">*</span>
            </label>
            <select
              data-testid="standing-orders-form-bank-account-id"
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              required
              className={INPUT_CLASS}
            >
              <option value="">בחר חשבון</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} ({b.account_number})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם המוטב <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="standing-orders-form-payee-name"
                value={payeeName}
                onChange={(e) => setPayeeName(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סכום <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                data-testid="standing-orders-form-amount"
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
                תדירות
              </label>
              <select
                data-testid="standing-orders-form-frequency"
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as StandingOrderFrequency)
                }
                className={INPUT_CLASS}
              >
                {(
                  [
                    'weekly',
                    'monthly',
                    'bimonthly',
                    'quarterly',
                    'yearly',
                  ] as const
                ).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
            {showDayOfMonth && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  יום בחודש (1-31)
                </label>
                <input
                  type="number"
                  data-testid="standing-orders-form-day-of-month"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  min="1"
                  max="31"
                  step="1"
                  dir="ltr"
                  className={INPUT_CLASS}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                קטגוריה
              </label>
              <select
                data-testid="standing-orders-form-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">ללא</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תיאור
              </label>
              <input
                type="text"
                data-testid="standing-orders-form-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך התחלה <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                data-testid="standing-orders-form-start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך סיום
              </label>
              <input
                type="date"
                data-testid="standing-orders-form-end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
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
              data-testid="standing-orders-form-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={INPUT_CLASS}
            />
          </div>

          {error && (
            <div
              role="alert"
              data-testid="standing-orders-form-error"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <GhostButton
              onClick={onClose}
              disabled={submitting}
              testId="standing-orders-form-cancel"
            >
              ביטול
            </GhostButton>
            <PrimaryButton
              type="submit"
              disabled={submitting}
              testId="standing-orders-form-submit"
            >
              {submitting ? 'שומר...' : 'שמור'}
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ToggleModal({
  tenantId,
  order,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  order: StandingOrderRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activating = order.is_active !== 1;

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await toggleStandingOrderAction(tenantId, order.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(
        activating
          ? 'הוראת הקבע הופעלה בהצלחה'
          : 'הוראת הקבע הושבתה בהצלחה',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div data-testid="standing-orders-toggle-modal">
        <h3 className="text-lg font-bold text-gray-900">
          {activating ? 'הפעלת הוראת קבע' : 'השבתת הוראת קבע'}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {activating
            ? `להפעיל מחדש את ${order.payee_name}?`
            : `להשבית את ${order.payee_name}?`}
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
            testId="standing-orders-toggle-cancel"
          >
            ביטול
          </GhostButton>
          <button
            type="button"
            data-testid="standing-orders-toggle-confirm"
            onClick={handleConfirm}
            disabled={submitting}
            className={`px-4 py-2 rounded-md text-white font-bold text-sm transition-colors disabled:opacity-60 ${
              activating
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {submitting ? '...' : activating ? 'הפעל' : 'השבת'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function OrderCard({
  order,
  onEdit,
  onToggle,
}: {
  order: StandingOrderRow;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const active = order.is_active === 1;
  return (
    <div
      data-testid="standing-orders-row"
      data-order-id={order.id}
      data-standing-orders-active={active ? '1' : '0'}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 ${
        active ? '' : 'opacity-60'
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            data-testid="standing-orders-row-payee"
            className="font-bold text-gray-900 truncate"
          >
            {order.payee_name}
          </h3>
          <p
            data-testid="standing-orders-row-frequency"
            className="text-xs text-gray-500 mt-0.5"
          >
            {FREQUENCY_LABELS[order.frequency]}
            {order.day_of_month != null
              ? ` · ${order.day_of_month} בחודש`
              : ''}
          </p>
        </div>
        <StatusBadge active={active} />
      </header>
      <p
        data-testid="standing-orders-row-amount"
        className="mt-2 font-bold text-gray-900"
        dir="ltr"
      >
        {formatILS(order.amount)}
      </p>
      <dl className="mt-2 space-y-0.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">חשבון:</dt>
          <dd className="truncate">{order.bank_name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">החיוב הבא:</dt>
          <dd data-testid="standing-orders-row-next-execution">
            <NextExecutionCell date={order.next_execution} active={active} />
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-end gap-1">
        <GhostButton onClick={onEdit} testId="standing-orders-row-edit">
          עריכה
        </GhostButton>
        <button
          type="button"
          data-testid="standing-orders-row-toggle"
          onClick={onToggle}
          className={`px-3 py-2 rounded-md text-sm transition-colors ${
            active
              ? 'text-red-600 hover:bg-red-50'
              : 'text-green-700 hover:bg-green-50'
          }`}
        >
          {active ? 'השבתה' : 'הפעלה'}
        </button>
      </div>
    </div>
  );
}

export function StandingOrdersManager({
  tenantId,
  orders,
  bankAccounts,
}: StandingOrdersManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);

  const stats = useMemo(() => {
    let activeCount = 0;
    let monthlyTotal = 0;
    let nextExec: { date: string; amount: number } | null = null;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (o.is_active !== 1) continue;
      activeCount += 1;
      if (o.frequency === 'monthly') monthlyTotal += o.amount;
      else if (o.frequency === 'weekly') monthlyTotal += o.amount * 4;
      else if (o.frequency === 'bimonthly') monthlyTotal += o.amount / 2;
      else if (o.frequency === 'quarterly') monthlyTotal += o.amount / 3;
      else if (o.frequency === 'yearly') monthlyTotal += o.amount / 12;

      if (o.next_execution) {
        if (!nextExec || o.next_execution < nextExec.date) {
          nextExec = { date: o.next_execution, amount: o.amount };
        }
      }
    }
    return {
      activeCount,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      nextExec,
    };
  }, [orders]);

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
            🔄
          </span>
          הוראות קבע
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatBox label="הוראות פעילות" value={String(stats.activeCount)} />
        <StatBox
          label="חיוב חודשי משוער"
          value={formatILS(stats.monthlyTotal)}
        />
        <StatBox
          label="החיוב הקרוב"
          value={
            stats.nextExec
              ? `${formatDateIL(stats.nextExec.date)} · ${formatILS(stats.nextExec.amount)}`
              : '—'
          }
        />
      </div>

      <div>
        <PrimaryButton
          onClick={() => setModal({ kind: 'add' })}
          testId="standing-orders-add-button"
        >
          + הוסף הוראת קבע
        </PrimaryButton>
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

      {orders.length === 0 ? (
        <div
          data-testid="standing-orders-empty"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center"
        >
          <p className="text-gray-600">אין הוראות קבע.</p>
        </div>
      ) : (
        <>
          <div
            data-testid="standing-orders-list"
            className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    שם המוטב
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סכום</th>
                  <th className="px-4 py-3 font-medium text-gray-700">תדירות</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    יום בחודש
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">חשבון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    החיוב הבא
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => {
                  const active = o.is_active === 1;
                  return (
                    <tr
                      key={o.id}
                      data-testid="standing-orders-row"
                      data-order-id={o.id}
                      data-standing-orders-active={active ? '1' : '0'}
                      className={active ? '' : 'opacity-60'}
                    >
                      <td
                        data-testid="standing-orders-row-payee"
                        className="px-4 py-3 text-gray-900 font-medium"
                      >
                        {o.payee_name}
                      </td>
                      <td
                        data-testid="standing-orders-row-amount"
                        className="px-4 py-3 font-medium"
                        dir="ltr"
                      >
                        {formatILS(o.amount)}
                      </td>
                      <td
                        data-testid="standing-orders-row-frequency"
                        className="px-4 py-3"
                      >
                        {FREQUENCY_LABELS[o.frequency]}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {o.day_of_month ?? '—'}
                      </td>
                      <td className="px-4 py-3 truncate">{o.bank_name}</td>
                      <td
                        data-testid="standing-orders-row-next-execution"
                        className="px-4 py-3"
                      >
                        <NextExecutionCell
                          date={o.next_execution}
                          active={active}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <GhostButton
                            onClick={() =>
                              setModal({ kind: 'edit', order: o })
                            }
                            testId="standing-orders-row-edit"
                          >
                            עריכה
                          </GhostButton>
                          <button
                            type="button"
                            data-testid="standing-orders-row-toggle"
                            onClick={() =>
                              setModal({ kind: 'toggle', order: o })
                            }
                            className={`px-3 py-2 rounded-md text-sm transition-colors ${
                              active
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-700 hover:bg-green-50'
                            }`}
                          >
                            {active ? 'השבתה' : 'הפעלה'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div data-testid="standing-orders-list" className="md:hidden space-y-3">
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onEdit={() => setModal({ kind: 'edit', order: o })}
                onToggle={() => setModal({ kind: 'toggle', order: o })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.kind === 'add' && (
        <OrderFormModal
          tenantId={tenantId}
          bankAccounts={bankAccounts}
          mode="add"
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <OrderFormModal
          key={modal.order.id}
          tenantId={tenantId}
          bankAccounts={bankAccounts}
          mode="edit"
          order={modal.order}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'toggle' && (
        <ToggleModal
          key={modal.order.id}
          tenantId={tenantId}
          order={modal.order}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
