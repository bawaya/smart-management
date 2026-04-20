'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type DebtCounterpartyType,
  type DebtPayload,
  type DebtPaymentMethod,
  type DebtStatus,
  type DebtType,
  addDebtAction,
  addDebtPaymentAction,
  updateDebtAction,
} from '../actions';

export interface DebtRow {
  id: string;
  debt_type: DebtType;
  counterparty: string;
  counterparty_type: DebtCounterpartyType;
  worker_id: string | null;
  client_id: string | null;
  original_amount: number;
  remaining_amount: number;
  issue_date: string;
  due_date: string | null;
  description: string | null;
  status: DebtStatus;
  notes: string | null;
  worker_name: string | null;
  client_name: string | null;
}

export interface DebtPaymentRow {
  id: string;
  debt_id: string;
  payment_date: string;
  amount: number;
  payment_method: DebtPaymentMethod;
  notes: string | null;
}

export interface WorkerOption {
  id: string;
  full_name: string;
}

export interface ClientOption {
  id: string;
  name: string;
}

interface DebtsManagerProps {
  tenantId: string;
  debts: DebtRow[];
  payments: DebtPaymentRow[];
  workers: WorkerOption[];
  clients: ClientOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'add'; debtType: DebtType }
  | { kind: 'edit'; debt: DebtRow }
  | { kind: 'payment'; debt: DebtRow }
  | { kind: 'view'; debt: DebtRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const STATUS_LABELS: Record<DebtStatus, string> = {
  active: 'פעיל',
  partial: 'שולם חלקית',
  paid: 'שולם',
  written_off: 'נמחק',
};

const STATUS_BADGE: Record<DebtStatus, string> = {
  active: 'bg-blue-100 text-blue-800',
  partial: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  written_off: 'bg-gray-300 text-gray-800',
};

const PAYMENT_METHOD_LABELS: Record<DebtPaymentMethod, string> = {
  cash: 'מזומן',
  bank_transfer: 'העברה בנקאית',
  check: 'שיק',
  credit_card: 'כרטיס אשראי',
  salary_deduction: 'ניכוי משכר',
};

const COUNTERPARTY_TYPE_LABELS: Record<DebtCounterpartyType, string> = {
  worker: 'עובד',
  supplier: 'ספק',
  client: 'לקוח',
  other: 'אחר',
};

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

function DirectionBadge({ type }: { type: DebtType }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
        type === 'owed_to_me'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      {type === 'owed_to_me' ? 'חייבים לי' : 'אני חייב'}
    </span>
  );
}

function StatusBadge({ status }: { status: DebtStatus }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABELS[status]}
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
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'green' | 'red';
}) {
  const color =
    tone === 'green'
      ? 'text-green-700'
      : tone === 'red'
        ? 'text-red-700'
        : 'text-gray-900';
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

interface DebtFormModalProps {
  tenantId: string;
  workers: WorkerOption[];
  clients: ClientOption[];
  mode: 'add' | 'edit';
  initialDebtType?: DebtType;
  debt?: DebtRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function DebtFormModal({
  tenantId,
  workers,
  clients,
  mode,
  initialDebtType,
  debt,
  onClose,
  onSuccess,
}: DebtFormModalProps) {
  const editing = mode === 'edit';
  const debtType: DebtType = debt?.debt_type ?? initialDebtType ?? 'i_owe';

  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '');
  const [counterpartyType, setCounterpartyType] =
    useState<DebtCounterpartyType>(debt?.counterparty_type ?? 'other');
  const [workerId, setWorkerId] = useState(debt?.worker_id ?? '');
  const [clientId, setClientId] = useState(debt?.client_id ?? '');
  const [amount, setAmount] = useState(
    debt ? String(debt.original_amount) : '',
  );
  const [issueDate, setIssueDate] = useState(
    debt?.issue_date.slice(0, 10) ?? todayIso(),
  );
  const [dueDate, setDueDate] = useState(debt?.due_date?.slice(0, 10) ?? '');
  const [description, setDescription] = useState(debt?.description ?? '');
  const [notes, setNotes] = useState(debt?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleCounterpartyTypeChange(t: DebtCounterpartyType): void {
    setCounterpartyType(t);
    if (t !== 'worker') setWorkerId('');
    if (t !== 'client') setClientId('');
  }

  function handleWorkerChange(id: string): void {
    setWorkerId(id);
    if (id) {
      const w = workers.find((x) => x.id === id);
      if (w) setCounterparty(w.full_name);
    }
  }

  function handleClientChange(id: string): void {
    setClientId(id);
    if (id) {
      const c = clients.find((x) => x.id === id);
      if (c) setCounterparty(c.name);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const cleanCp = counterparty.trim();
    if (!cleanCp) {
      setError('שם הצד השני חובה');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('סכום לא חוקי');
      return;
    }
    if (!issueDate) {
      setError('תאריך חובה');
      return;
    }

    const payload: DebtPayload = {
      debtType,
      counterparty: cleanCp,
      counterpartyType,
      workerId: counterpartyType === 'worker' ? workerId : undefined,
      clientId: counterpartyType === 'client' ? clientId : undefined,
      amount,
      issueDate,
      dueDate,
      description,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateDebtAction(tenantId, debt!.id, payload)
        : await addDebtAction(tenantId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'החוב עודכן בהצלחה' : 'החוב נוסף בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <header className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-bold text-gray-900">
          {editing ? 'עריכת חוב' : 'הוספת חוב'}
        </h3>
        <DirectionBadge type={debtType} />
      </header>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סוג הצד השני
          </label>
          <div className="flex gap-2 flex-wrap">
            {(
              ['worker', 'supplier', 'client', 'other'] as DebtCounterpartyType[]
            ).map((t) => {
              const active = counterpartyType === t;
              return (
                <label
                  key={t}
                  className={`flex-1 min-w-[5rem] px-3 py-2 rounded-md border text-center cursor-pointer text-sm font-medium transition-colors ${
                    active
                      ? 'bg-amber-50 border-[#f59e0b] text-[#92400e]'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="counterpartyType"
                    value={t}
                    checked={active}
                    onChange={() => handleCounterpartyTypeChange(t)}
                    className="sr-only"
                  />
                  {COUNTERPARTY_TYPE_LABELS[t]}
                </label>
              );
            })}
          </div>
        </div>

        {counterpartyType === 'worker' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              בחר עובד
            </label>
            <select
              value={workerId}
              onChange={(e) => handleWorkerChange(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">בחר</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {counterpartyType === 'client' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              בחר לקוח
            </label>
            <select
              value={clientId}
              onChange={(e) => handleClientChange(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">בחר</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם הצד השני <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
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
              תאריך <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              required
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך פירעון
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
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
    </Modal>
  );
}

interface PaymentModalProps {
  tenantId: string;
  debt: DebtRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function PaymentModal({
  tenantId,
  debt,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const remaining = Math.max(0, debt.remaining_amount);
  const [amount, setAmount] = useState(String(remaining));
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [method, setMethod] = useState<DebtPaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('סכום לא חוקי');
      return;
    }
    if (!paymentDate) {
      setError('תאריך חובה');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await addDebtPaymentAction(
        tenantId,
        debt.id,
        amount,
        paymentDate,
        method,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('התשלום נרשם בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <h3 className="text-lg font-bold text-gray-900">רישום תשלום</h3>
      <p className="mt-1 text-sm text-gray-600">{debt.counterparty}</p>
      <p className="mt-1 text-sm text-gray-700">
        יתרה לתשלום:{' '}
        <span className="font-medium" dir="ltr">
          {formatILS(remaining)}
        </span>
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סכום <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min="0.01"
            step="0.01"
            dir="ltr"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            תאריך <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
            dir="ltr"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            אמצעי תשלום
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as DebtPaymentMethod)}
            className={INPUT_CLASS}
          >
            {(
              [
                'cash',
                'bank_transfer',
                'check',
                'credit_card',
                'salary_deduction',
              ] as const
            ).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
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
            {submitting ? 'רושם...' : 'רשום תשלום'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

interface ViewModalProps {
  debt: DebtRow;
  payments: DebtPaymentRow[];
  onClose: () => void;
}

function ViewModal({ debt, payments, onClose }: ViewModalProps) {
  return (
    <Modal onClose={onClose} size="lg">
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <h3 className="text-lg font-bold text-gray-900">{debt.counterparty}</h3>
        <DirectionBadge type={debt.debt_type} />
        <StatusBadge status={debt.status} />
      </header>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">סכום מקורי:</dt>
          <dd className="font-medium" dir="ltr">
            {formatILS(debt.original_amount)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">יתרה:</dt>
          <dd className="font-bold text-gray-900" dir="ltr">
            {formatILS(debt.remaining_amount)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">תאריך:</dt>
          <dd dir="ltr">{formatDateIL(debt.issue_date)}</dd>
        </div>
        {debt.due_date && (
          <div className="flex justify-between">
            <dt className="text-gray-600">תאריך פירעון:</dt>
            <dd dir="ltr">{formatDateIL(debt.due_date)}</dd>
          </div>
        )}
        {debt.description && (
          <div className="flex justify-between">
            <dt className="text-gray-600">תיאור:</dt>
            <dd>{debt.description}</dd>
          </div>
        )}
      </dl>

      <section className="mt-4">
        <h4 className="text-sm font-bold text-gray-900 mb-2">
          היסטוריית תשלומים
        </h4>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-500">אין תשלומים רשומים</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="py-2 flex justify-between gap-2">
                <span dir="ltr" className="text-gray-700">
                  {formatDateIL(p.payment_date)}
                </span>
                <span className="text-gray-500 text-xs">
                  {PAYMENT_METHOD_LABELS[p.payment_method]}
                </span>
                <span className="font-medium text-gray-900" dir="ltr">
                  {formatILS(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {debt.notes && (
        <section className="mt-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-1">הערות</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {debt.notes}
          </p>
        </section>
      )}

      <div className="mt-5 flex justify-end">
        <GhostButton onClick={onClose}>סגור</GhostButton>
      </div>
    </Modal>
  );
}

export function DebtsManager({
  tenantId,
  debts,
  payments,
  workers,
  clients,
}: DebtsManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);
  const [filterType, setFilterType] = useState<'all' | DebtType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | DebtStatus>('all');

  const filtered = useMemo(() => {
    return debts.filter((d) => {
      if (filterType !== 'all' && d.debt_type !== filterType) return false;
      if (filterStatus !== 'all' && d.status !== filterStatus) return false;
      return true;
    });
  }, [debts, filterType, filterStatus]);

  const stats = useMemo(() => {
    let owedToMe = 0;
    let iOwe = 0;
    for (let i = 0; i < debts.length; i++) {
      if (debts[i].status === 'paid' || debts[i].status === 'written_off')
        continue;
      if (debts[i].debt_type === 'owed_to_me') owedToMe += debts[i].remaining_amount;
      else iOwe += debts[i].remaining_amount;
    }
    return { owedToMe, iOwe, net: owedToMe - iOwe };
  }, [debts]);

  const paymentsByDebt = useMemo(() => {
    const map = new Map<string, DebtPaymentRow[]>();
    for (let i = 0; i < payments.length; i++) {
      const p = payments[i];
      const arr = map.get(p.debt_id) ?? [];
      arr.push(p);
      map.set(p.debt_id, arr);
    }
    return map;
  }, [payments]);

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
            💸
          </span>
          חובות והלוואות
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatBox
          label="חייבים לי"
          value={formatILS(stats.owedToMe)}
          tone="green"
        />
        <StatBox
          label="אני חייב"
          value={formatILS(stats.iOwe)}
          tone="red"
        />
        <StatBox
          label="נטו"
          value={formatILS(stats.net)}
          tone={stats.net >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-end flex-wrap">
        <button
          type="button"
          onClick={() => setModal({ kind: 'add', debtType: 'owed_to_me' })}
          className="px-4 py-2 rounded-md bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors"
        >
          + חוב שחייבים לי
        </button>
        <button
          type="button"
          onClick={() => setModal({ kind: 'add', debtType: 'i_owe' })}
          className="px-4 py-2 rounded-md bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors"
        >
          + חוב שאני חייב
        </button>
        <div>
          <label className="block text-xs text-gray-600 mb-1">סוג</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | DebtType)}
            className={`${INPUT_CLASS} md:w-36`}
          >
            <option value="all">הכל</option>
            <option value="owed_to_me">חייבים לי</option>
            <option value="i_owe">אני חייב</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">סטטוס</label>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | DebtStatus)
            }
            className={`${INPUT_CLASS} md:w-36`}
          >
            <option value="all">הכל</option>
            <option value="active">פעיל</option>
            <option value="partial">שולם חלקית</option>
            <option value="paid">שולם</option>
            <option value="written_off">נמחק</option>
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

      {debts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-gray-600">אין חובות רשומים.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">אין חובות התואמים לסינון</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-right">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-700">כיוון</th>
                <th className="px-4 py-3 font-medium text-gray-700">צד שני</th>
                <th className="px-4 py-3 font-medium text-gray-700">
                  סכום מקורי
                </th>
                <th className="px-4 py-3 font-medium text-gray-700">יתרה</th>
                <th className="px-4 py-3 font-medium text-gray-700">תאריך</th>
                <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((d) => {
                const canPay =
                  d.status === 'active' || d.status === 'partial';
                const canEdit =
                  d.status === 'active' || d.status === 'partial';
                return (
                  <tr key={d.id}>
                    <td className="px-4 py-3">
                      <DirectionBadge type={d.debt_type} />
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {d.counterparty}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {formatILS(d.original_amount)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900" dir="ltr">
                      {formatILS(d.remaining_amount)}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {formatDateIL(d.issue_date)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {canPay && (
                          <button
                            type="button"
                            onClick={() =>
                              setModal({ kind: 'payment', debt: d })
                            }
                            className="px-3 py-2 rounded-md text-sm text-green-700 hover:bg-green-50"
                          >
                            רישום תשלום
                          </button>
                        )}
                        <GhostButton
                          onClick={() => setModal({ kind: 'view', debt: d })}
                        >
                          צפייה
                        </GhostButton>
                        {canEdit && (
                          <GhostButton
                            onClick={() =>
                              setModal({ kind: 'edit', debt: d })
                            }
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
      )}

      {modal?.kind === 'add' && (
        <DebtFormModal
          key={`add-${modal.debtType}`}
          tenantId={tenantId}
          workers={workers}
          clients={clients}
          mode="add"
          initialDebtType={modal.debtType}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <DebtFormModal
          key={modal.debt.id}
          tenantId={tenantId}
          workers={workers}
          clients={clients}
          mode="edit"
          debt={modal.debt}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'payment' && (
        <PaymentModal
          key={modal.debt.id}
          tenantId={tenantId}
          debt={modal.debt}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'view' && (
        <ViewModal
          key={modal.debt.id}
          debt={modal.debt}
          payments={paymentsByDebt.get(modal.debt.id) ?? []}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
