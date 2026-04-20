'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type CheckDirection,
  type CheckPayload,
  type CheckStatus,
  addCheckAction,
  updateCheckAction,
  updateCheckStatusAction,
} from '../actions';

export interface CheckRow {
  id: string;
  check_number: string;
  bank_account_id: string;
  direction: CheckDirection;
  amount: number;
  payee_or_payer: string;
  issue_date: string;
  due_date: string;
  status: CheckStatus;
  category: string | null;
  description: string | null;
  bounce_reason: string | null;
  notes: string | null;
  updated_at: string;
  bank_name: string;
  account_number: string;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  account_number: string;
}

interface ChecksManagerProps {
  tenantId: string;
  userId: string;
  checks: CheckRow[];
  bankAccounts: BankAccountOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'add'; direction: CheckDirection }
  | { kind: 'edit'; check: CheckRow }
  | { kind: 'status'; check: CheckRow }
  | { kind: 'view'; check: CheckRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const STATUS_CONFIG: Record<CheckStatus, { label: string; badge: string }> = {
  pending: { label: 'ממתין', badge: 'bg-gray-200 text-gray-800' },
  deposited: { label: 'הופקד', badge: 'bg-blue-100 text-blue-800' },
  cleared: { label: 'נפרע', badge: 'bg-green-100 text-green-800' },
  bounced: { label: 'חזר', badge: 'bg-red-100 text-red-800' },
  cancelled: { label: 'בוטל', badge: 'bg-gray-400 text-gray-900' },
  post_dated: { label: 'דחוי', badge: 'bg-purple-100 text-purple-800' },
};

const DIRECTION_CONFIG: Record<
  CheckDirection,
  { label: string; badge: string }
> = {
  outgoing: { label: 'יוצא', badge: 'bg-red-50 text-red-700 border border-red-200' },
  incoming: {
    label: 'נכנס',
    badge: 'bg-green-50 text-green-700 border border-green-200',
  },
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

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}
    >
      {c.label}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: CheckDirection }) {
  const c = DIRECTION_CONFIG[direction];
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}
    >
      {c.label}
    </span>
  );
}

function DueDateCell({
  date,
  active,
}: {
  date: string | null;
  active: boolean;
}) {
  if (!date) return <span className="text-gray-400">—</span>;
  const days = daysUntil(date);
  const display = formatDateIL(date);
  if (active && days !== null && days <= 7) {
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
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
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
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function StatBox({
  label,
  value,
  sub,
  emphasis = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  emphasis?: 'default' | 'alert';
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`text-lg font-bold mt-0.5 ${
          emphasis === 'alert' ? 'text-red-700' : 'text-gray-900'
        }`}
        dir="ltr"
      >
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

interface CheckFormModalProps {
  tenantId: string;
  userId: string;
  bankAccounts: BankAccountOption[];
  mode: 'add' | 'edit';
  initialDirection?: CheckDirection;
  check?: CheckRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function CheckFormModal({
  tenantId,
  userId,
  bankAccounts,
  mode,
  initialDirection,
  check,
  onClose,
  onSuccess,
}: CheckFormModalProps) {
  const editing = mode === 'edit';
  const direction: CheckDirection =
    check?.direction ?? initialDirection ?? 'outgoing';

  const [checkNumber, setCheckNumber] = useState(check?.check_number ?? '');
  const [bankAccountId, setBankAccountId] = useState(
    check?.bank_account_id ?? bankAccounts[0]?.id ?? '',
  );
  const [amount, setAmount] = useState(
    check ? String(check.amount) : '',
  );
  const [payeeOrPayer, setPayeeOrPayer] = useState(check?.payee_or_payer ?? '');
  const [issueDate, setIssueDate] = useState(
    check?.issue_date.slice(0, 10) ?? todayIso(),
  );
  const [dueDate, setDueDate] = useState(check?.due_date.slice(0, 10) ?? '');
  const [category, setCategory] = useState(check?.category ?? '');
  const [description, setDescription] = useState(check?.description ?? '');
  const [notes, setNotes] = useState(check?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const counterpartyLabel = direction === 'outgoing' ? 'לטובת' : 'מאת';
  const noBanks = bankAccounts.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!checkNumber.trim()) {
      setError('מספר שיק חובה');
      return;
    }
    if (!bankAccountId) {
      setError('חשבון בנק חובה');
      return;
    }
    if (!payeeOrPayer.trim()) {
      setError(`${counterpartyLabel} חובה`);
      return;
    }
    if (!dueDate) {
      setError('תאריך פירעון חובה');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('סכום לא חוקי');
      return;
    }

    const payload: CheckPayload = {
      checkNumber,
      bankAccountId,
      direction,
      amount,
      payeeOrPayer,
      issueDate,
      dueDate,
      category,
      description,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateCheckAction(tenantId, check!.id, payload)
        : await addCheckAction(tenantId, userId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'השיק עודכן בהצלחה' : 'השיק נוסף בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <header className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          {editing ? 'עריכת שיק' : 'הוספת שיק'}
        </h3>
        <DirectionBadge direction={direction} />
      </header>

      {noBanks && !editing ? (
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          יש להוסיף חשבון בנק לפני רישום שיק.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מספר שיק <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                required
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                חשבון בנק <span className="text-red-500">*</span>
              </label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                required
                className={INPUT_CLASS}
              >
                <option value="">בחר חשבון בנק</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} ({b.account_number})
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
                {counterpartyLabel} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={payeeOrPayer}
                onChange={(e) => setPayeeOrPayer(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך הנפקה
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך פירעון <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                קטגוריה
              </label>
              <select
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              הערות
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={INPUT_CLASS}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <GhostButton onClick={onClose} disabled={submitting}>
              ביטול
            </GhostButton>
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? 'שומר...' : 'שמור'}
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

interface StatusModalProps {
  tenantId: string;
  check: CheckRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function StatusModal({
  tenantId,
  check,
  onClose,
  onSuccess,
}: StatusModalProps) {
  const [status, setStatus] = useState<CheckStatus>(check.status);
  const [bounceReason, setBounceReason] = useState(check.bounce_reason ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (status === 'bounced' && !bounceReason.trim()) {
      setError('יש להזין סיבת חזרה');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await updateCheckStatusAction(
        tenantId,
        check.id,
        status,
        status === 'bounced' ? bounceReason : undefined,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('הסטטוס עודכן בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <h3 className="text-lg font-bold text-gray-900">עדכון סטטוס</h3>
      <p className="mt-1 text-sm text-gray-600" dir="ltr">
        שיק #{check.check_number}
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סטטוס חדש
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CheckStatus)}
            className={INPUT_CLASS}
          >
            {(
              [
                'pending',
                'deposited',
                'cleared',
                'bounced',
                'cancelled',
                'post_dated',
              ] as const
            ).map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>
        {status === 'bounced' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סיבת חזרה <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bounceReason}
              onChange={(e) => setBounceReason(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton onClick={onClose} disabled={submitting}>
            ביטול
          </GhostButton>
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? 'שומר...' : 'עדכן'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function ViewModal({
  check,
  onClose,
}: {
  check: CheckRow;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} size="lg">
      <header className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-bold text-gray-900" dir="ltr">
          שיק #{check.check_number}
        </h3>
        <DirectionBadge direction={check.direction} />
        <StatusBadge status={check.status} />
      </header>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">
            {check.direction === 'outgoing' ? 'לטובת' : 'מאת'}:
          </dt>
          <dd className="font-medium">{check.payee_or_payer}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">סכום:</dt>
          <dd className="font-bold text-gray-900" dir="ltr">
            {formatILS(check.amount)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">תאריך הנפקה:</dt>
          <dd dir="ltr">{formatDateIL(check.issue_date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">תאריך פירעון:</dt>
          <dd dir="ltr">{formatDateIL(check.due_date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">חשבון בנק:</dt>
          <dd>
            {check.bank_name}{' '}
            <span className="text-gray-500" dir="ltr">
              ({check.account_number})
            </span>
          </dd>
        </div>
        {check.category && (
          <div className="flex justify-between">
            <dt className="text-gray-600">קטגוריה:</dt>
            <dd>{CATEGORY_LABELS[check.category] ?? check.category}</dd>
          </div>
        )}
        {check.description && (
          <div className="flex justify-between">
            <dt className="text-gray-600">תיאור:</dt>
            <dd>{check.description}</dd>
          </div>
        )}
        {check.status === 'bounced' && check.bounce_reason && (
          <div className="mt-2 p-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
            <strong>סיבת חזרה:</strong> {check.bounce_reason}
          </div>
        )}
        {check.notes && (
          <div className="mt-2">
            <dt className="text-gray-600 text-xs">הערות:</dt>
            <dd className="text-gray-700 mt-0.5 whitespace-pre-wrap">
              {check.notes}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex justify-end">
        <GhostButton onClick={onClose}>סגור</GhostButton>
      </div>
    </Modal>
  );
}

function CheckCard({
  check,
  onView,
  onStatus,
  onEdit,
}: {
  check: CheckRow;
  onView: () => void;
  onStatus: () => void;
  onEdit: () => void;
}) {
  const editable = check.status === 'pending';
  const active =
    check.status === 'pending' || check.status === 'post_dated';
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900" dir="ltr">
              #{check.check_number}
            </p>
            <DirectionBadge direction={check.direction} />
          </div>
          <p className="text-sm text-gray-700 mt-0.5 truncate">
            {check.payee_or_payer}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{check.bank_name}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <StatusBadge status={check.status} />
          <p className="font-bold text-gray-900" dir="ltr">
            {formatILS(check.amount)}
          </p>
        </div>
      </header>
      <dl className="mt-2 text-sm space-y-0.5">
        <div className="flex justify-between">
          <dt className="text-gray-600">תאריך פירעון:</dt>
          <dd>
            <DueDateCell date={check.due_date} active={active} />
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-end gap-1 flex-wrap">
        <GhostButton onClick={onView}>צפייה</GhostButton>
        <GhostButton onClick={onStatus}>עדכון סטטוס</GhostButton>
        {editable && <GhostButton onClick={onEdit}>עריכה</GhostButton>}
      </div>
    </div>
  );
}

export function ChecksManager({
  tenantId,
  userId,
  checks,
  bankAccounts,
}: ChecksManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);
  const [filterDirection, setFilterDirection] = useState<'all' | CheckDirection>(
    'all',
  );
  const [filterStatus, setFilterStatus] = useState<'all' | CheckStatus>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const filtered = useMemo(() => {
    return checks.filter((c) => {
      if (filterDirection !== 'all' && c.direction !== filterDirection)
        return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      if (fromDate && c.due_date < fromDate) return false;
      if (toDate && c.due_date > toDate) return false;
      return true;
    });
  }, [checks, filterDirection, filterStatus, fromDate, toDate]);

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let outgoingPendingCount = 0;
    let outgoingPendingSum = 0;
    let incomingPendingCount = 0;
    let incomingPendingSum = 0;
    let bouncedThisMonth = 0;
    let activeTotal = 0;
    for (let i = 0; i < checks.length; i++) {
      const c = checks[i];
      const isPending =
        c.status === 'pending' || c.status === 'post_dated';
      if (isPending || c.status === 'deposited') {
        activeTotal += c.amount;
      }
      if (isPending) {
        if (c.direction === 'outgoing') {
          outgoingPendingCount += 1;
          outgoingPendingSum += c.amount;
        } else {
          incomingPendingCount += 1;
          incomingPendingSum += c.amount;
        }
      }
      if (c.status === 'bounced' && c.updated_at) {
        const d = new Date(c.updated_at.replace(' ', 'T') + 'Z');
        if (
          !Number.isNaN(d.getTime()) &&
          d.getFullYear() === y &&
          d.getMonth() === m
        ) {
          bouncedThisMonth += 1;
        }
      }
    }
    return {
      outgoingPendingCount,
      outgoingPendingSum,
      incomingPendingCount,
      incomingPendingSum,
      bouncedThisMonth,
      activeTotal,
    };
  }, [checks]);

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
            📝
          </span>
          שיקים
        </h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox
          label="שיקים יוצאים ממתינים"
          value={formatILS(stats.outgoingPendingSum)}
          sub={`${stats.outgoingPendingCount} שיקים`}
        />
        <StatBox
          label="שיקים נכנסים ממתינים"
          value={formatILS(stats.incomingPendingSum)}
          sub={`${stats.incomingPendingCount} שיקים`}
        />
        <StatBox
          label="חזרו החודש"
          value={String(stats.bouncedThisMonth)}
          emphasis={stats.bouncedThisMonth > 0 ? 'alert' : 'default'}
        />
        <StatBox label='סה״כ פעיל' value={formatILS(stats.activeTotal)} />
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-end flex-wrap">
        <button
          type="button"
          onClick={() => setModal({ kind: 'add', direction: 'outgoing' })}
          className="px-4 py-2 rounded-md bg-[#f59e0b] text-black font-bold text-sm hover:bg-[#d97706] transition-colors"
        >
          + שיק יוצא
        </button>
        <button
          type="button"
          onClick={() => setModal({ kind: 'add', direction: 'incoming' })}
          className="px-4 py-2 rounded-md bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors"
        >
          + שיק נכנס
        </button>
        <div>
          <label className="block text-xs text-gray-600 mb-1">כיוון</label>
          <select
            value={filterDirection}
            onChange={(e) =>
              setFilterDirection(e.target.value as 'all' | CheckDirection)
            }
            className={`${INPUT_CLASS} md:w-36`}
          >
            <option value="all">הכל</option>
            <option value="incoming">נכנסים</option>
            <option value="outgoing">יוצאים</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">סטטוס</label>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | CheckStatus)
            }
            className={`${INPUT_CLASS} md:w-36`}
          >
            <option value="all">הכל</option>
            <option value="pending">ממתין</option>
            <option value="deposited">הופקד</option>
            <option value="cleared">נפרע</option>
            <option value="bounced">חזר</option>
            <option value="cancelled">בוטל</option>
            <option value="post_dated">דחוי</option>
          </select>
        </div>
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

      {checks.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-gray-600">אין שיקים רשומים.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            אין שיקים התואמים לסינון שנבחר
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">מספר</th>
                  <th className="px-4 py-3 font-medium text-gray-700">כיוון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    לטובת/מאת
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סכום</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    תאריך הנפקה
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    תאריך פירעון
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">חשבון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => {
                  const editable = c.status === 'pending';
                  const active =
                    c.status === 'pending' || c.status === 'post_dated';
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium" dir="ltr">
                        {c.check_number}
                      </td>
                      <td className="px-4 py-3">
                        <DirectionBadge direction={c.direction} />
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {c.payee_or_payer}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900" dir="ltr">
                        {formatILS(c.amount)}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {formatDateIL(c.issue_date)}
                      </td>
                      <td className="px-4 py-3">
                        <DueDateCell date={c.due_date} active={active} />
                      </td>
                      <td className="px-4 py-3 text-gray-700 truncate">
                        {c.bank_name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <GhostButton
                            onClick={() => setModal({ kind: 'view', check: c })}
                          >
                            צפייה
                          </GhostButton>
                          <GhostButton
                            onClick={() => setModal({ kind: 'status', check: c })}
                          >
                            עדכון סטטוס
                          </GhostButton>
                          {editable && (
                            <GhostButton
                              onClick={() => setModal({ kind: 'edit', check: c })}
                            >
                              עריכה
                            </GhostButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((c) => (
              <CheckCard
                key={c.id}
                check={c}
                onView={() => setModal({ kind: 'view', check: c })}
                onStatus={() => setModal({ kind: 'status', check: c })}
                onEdit={() => setModal({ kind: 'edit', check: c })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.kind === 'add' && (
        <CheckFormModal
          key={`add-${modal.direction}`}
          tenantId={tenantId}
          userId={userId}
          bankAccounts={bankAccounts}
          mode="add"
          initialDirection={modal.direction}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <CheckFormModal
          key={modal.check.id}
          tenantId={tenantId}
          userId={userId}
          bankAccounts={bankAccounts}
          mode="edit"
          check={modal.check}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'status' && (
        <StatusModal
          key={modal.check.id}
          tenantId={tenantId}
          check={modal.check}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'view' && (
        <ViewModal
          key={modal.check.id}
          check={modal.check}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
