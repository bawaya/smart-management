'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type TransactionDirection,
  type TransactionPayload,
  type TransactionType,
  addTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from '../actions';

export interface TransactionRow {
  id: string;
  transaction_date: string;
  transaction_type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  bank_account_id: string | null;
  credit_card_id: string | null;
  counterparty: string | null;
  category: string | null;
  description: string | null;
  reference_number: string | null;
  notes: string | null;
  bank_name: string | null;
  card_name: string | null;
  last_four_digits: string | null;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  account_number: string;
}

export interface CreditCardOption {
  id: string;
  card_name: string;
  last_four_digits: string;
}

interface TransactionsManagerProps {
  tenantId: string;
  userId: string;
  transactions: TransactionRow[];
  bankAccounts: BankAccountOption[];
  creditCards: CreditCardOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; transaction: TransactionRow }
  | { kind: 'view'; transaction: TransactionRow }
  | { kind: 'delete'; transaction: TransactionRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const TRANSACTION_TYPES: TransactionType[] = [
  'bank_deposit',
  'bank_withdrawal',
  'bank_transfer',
  'credit_card_charge',
  'credit_card_payment',
  'check_incoming',
  'check_outgoing',
  'standing_order',
  'cash_in',
  'cash_out',
  'invoice_payment',
  'expense_payment',
  'salary_payment',
  'debt_given',
  'debt_received',
  'debt_repayment',
];

const TYPE_LABELS: Record<TransactionType, string> = {
  bank_deposit: 'הפקדה',
  bank_withdrawal: 'משיכה',
  bank_transfer: 'העברה בנקאית',
  credit_card_charge: 'חיוב כרטיס',
  credit_card_payment: 'תשלום כרטיס',
  check_incoming: 'שיק נכנס',
  check_outgoing: 'שיק יוצא',
  standing_order: 'הוראת קבע',
  cash_in: 'מזומן נכנס',
  cash_out: 'מזומן יוצא',
  invoice_payment: 'תשלום חשבונית',
  expense_payment: 'תשלום הוצאה',
  salary_payment: 'תשלום שכר',
  debt_given: 'הלוואה שניתנה',
  debt_received: 'הלוואה שהתקבלה',
  debt_repayment: 'החזר הלוואה',
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

const IN_TYPES = new Set<TransactionType>([
  'bank_deposit',
  'check_incoming',
  'cash_in',
  'invoice_payment',
  'debt_received',
  'debt_repayment',
]);
const OUT_TYPES = new Set<TransactionType>([
  'bank_withdrawal',
  'credit_card_charge',
  'credit_card_payment',
  'check_outgoing',
  'standing_order',
  'cash_out',
  'expense_payment',
  'salary_payment',
  'debt_given',
]);

function defaultDirectionForType(
  type: TransactionType,
): TransactionDirection | null {
  if (IN_TYPES.has(type)) return 'in';
  if (OUT_TYPES.has(type)) return 'out';
  return null;
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

function DirectionBadge({ direction }: { direction: TransactionDirection }) {
  const isIn = direction === 'in';
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
        isIn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {isIn ? 'נכנס' : 'יוצא'}
    </span>
  );
}

function StatBox({
  label,
  value,
  color = 'default',
}: {
  label: string;
  value: string;
  color?: 'default' | 'green' | 'red';
}) {
  const colorClass =
    color === 'green'
      ? 'text-green-700'
      : color === 'red'
        ? 'text-red-700'
        : 'text-gray-900';
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${colorClass}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

function accountOrCardLabel(t: TransactionRow): string {
  if (t.bank_name) return t.bank_name;
  if (t.card_name) {
    return `${t.card_name} ···· ${t.last_four_digits ?? ''}`.trim();
  }
  return '—';
}

interface TransactionFormModalProps {
  tenantId: string;
  userId: string;
  bankAccounts: BankAccountOption[];
  creditCards: CreditCardOption[];
  mode: 'add' | 'edit';
  transaction?: TransactionRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function TransactionFormModal({
  tenantId,
  userId,
  bankAccounts,
  creditCards,
  mode,
  transaction,
  onClose,
  onSuccess,
}: TransactionFormModalProps) {
  const editing = mode === 'edit';
  const [transactionDate, setTransactionDate] = useState(
    transaction?.transaction_date.slice(0, 10) ?? todayIso(),
  );
  const [transactionType, setTransactionType] = useState<TransactionType>(
    transaction?.transaction_type ?? 'bank_deposit',
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : '',
  );
  const [direction, setDirection] = useState<TransactionDirection>(
    transaction?.direction ?? defaultDirectionForType('bank_deposit') ?? 'in',
  );
  const [bankAccountId, setBankAccountId] = useState(
    transaction?.bank_account_id ?? '',
  );
  const [creditCardId, setCreditCardId] = useState(
    transaction?.credit_card_id ?? '',
  );
  const [counterparty, setCounterparty] = useState(
    transaction?.counterparty ?? '',
  );
  const [category, setCategory] = useState(transaction?.category ?? '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [referenceNumber, setReferenceNumber] = useState(
    transaction?.reference_number ?? '',
  );
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleTypeChange(newType: TransactionType): void {
    setTransactionType(newType);
    const autoDir = defaultDirectionForType(newType);
    if (autoDir) setDirection(autoDir);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!transactionDate) {
      setError('תאריך חובה');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('סכום לא חוקי');
      return;
    }

    const payload: TransactionPayload = {
      transactionDate,
      transactionType,
      amount,
      direction,
      bankAccountId: bankAccountId || undefined,
      creditCardId: creditCardId || undefined,
      counterparty,
      category,
      description,
      referenceNumber,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateTransactionAction(tenantId, transaction!.id, payload)
        : await addTransactionAction(tenantId, userId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'התנועה עודכנה בהצלחה' : 'התנועה נוספה בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת תנועה' : 'רישום תנועה'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סוג <span className="text-red-500">*</span>
            </label>
            <select
              value={transactionType}
              onChange={(e) =>
                handleTypeChange(e.target.value as TransactionType)
              }
              className={INPUT_CLASS}
            >
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
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
              כיוון
            </label>
            <div className="flex gap-2">
              {(['in', 'out'] as const).map((d) => {
                const active = direction === d;
                return (
                  <label
                    key={d}
                    className={`flex-1 px-3 py-2 rounded-md border text-center cursor-pointer text-sm font-medium transition-colors ${
                      active
                        ? d === 'in'
                          ? 'bg-green-50 border-green-500 text-green-800'
                          : 'bg-red-50 border-red-500 text-red-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="direction"
                      value={d}
                      checked={active}
                      onChange={() => setDirection(d)}
                      className="sr-only"
                    />
                    {d === 'in' ? 'נכנס' : 'יוצא'}
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              חשבון בנק
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">ללא</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bank_name} ({b.account_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              כרטיס אשראי
            </label>
            <select
              value={creditCardId}
              onChange={(e) => setCreditCardId(e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">ללא</option>
              {creditCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.card_name} ···· {c.last_four_digits}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              צד שני
            </label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
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
          <div className="md:col-span-2">
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
              מספר אסמכתא
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
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

function ViewModal({
  transaction,
  onClose,
}: {
  transaction: TransactionRow;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} size="lg">
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <h3 className="text-lg font-bold text-gray-900">
          {TYPE_LABELS[transaction.transaction_type]}
        </h3>
        <DirectionBadge direction={transaction.direction} />
      </header>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">תאריך:</dt>
          <dd dir="ltr">{formatDateIL(transaction.transaction_date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">סכום:</dt>
          <dd
            className={`font-bold ${
              transaction.direction === 'in' ? 'text-green-700' : 'text-red-700'
            }`}
            dir="ltr"
          >
            {formatILS(transaction.amount)}
          </dd>
        </div>
        {transaction.counterparty && (
          <div className="flex justify-between">
            <dt className="text-gray-600">צד שני:</dt>
            <dd>{transaction.counterparty}</dd>
          </div>
        )}
        {transaction.bank_name && (
          <div className="flex justify-between">
            <dt className="text-gray-600">חשבון בנק:</dt>
            <dd>{transaction.bank_name}</dd>
          </div>
        )}
        {transaction.card_name && (
          <div className="flex justify-between">
            <dt className="text-gray-600">כרטיס:</dt>
            <dd>
              {transaction.card_name} ····{' '}
              <span dir="ltr">{transaction.last_four_digits}</span>
            </dd>
          </div>
        )}
        {transaction.category && (
          <div className="flex justify-between">
            <dt className="text-gray-600">קטגוריה:</dt>
            <dd>
              {CATEGORY_LABELS[transaction.category] ?? transaction.category}
            </dd>
          </div>
        )}
        {transaction.description && (
          <div className="flex justify-between">
            <dt className="text-gray-600">תיאור:</dt>
            <dd>{transaction.description}</dd>
          </div>
        )}
        {transaction.reference_number && (
          <div className="flex justify-between">
            <dt className="text-gray-600">אסמכתא:</dt>
            <dd dir="ltr">{transaction.reference_number}</dd>
          </div>
        )}
        {transaction.notes && (
          <div className="mt-2">
            <dt className="text-gray-600 text-xs">הערות:</dt>
            <dd className="text-gray-700 mt-0.5 whitespace-pre-wrap">
              {transaction.notes}
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

function DeleteModal({
  tenantId,
  transaction,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  transaction: TransactionRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await deleteTransactionAction(tenantId, transaction.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('התנועה נמחקה בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <h3 className="text-lg font-bold text-gray-900">מחיקת תנועה</h3>
      <p className="mt-2 text-sm text-gray-600">
        למחוק את התנועה {TYPE_LABELS[transaction.transaction_type]} מתאריך{' '}
        <span dir="ltr">{formatDateIL(transaction.transaction_date)}</span> על
        סך{' '}
        <span dir="ltr">{formatILS(transaction.amount)}</span>? פעולה זו אינה
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
        <GhostButton onClick={onClose} disabled={submitting}>
          ביטול
        </GhostButton>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {submitting ? 'מוחק...' : 'מחק'}
        </button>
      </div>
    </Modal>
  );
}

function TransactionCard({
  transaction,
  onView,
  onEdit,
  onDelete,
}: {
  transaction: TransactionRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900">
              {TYPE_LABELS[transaction.transaction_type]}
            </p>
            <DirectionBadge direction={transaction.direction} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5" dir="ltr">
            {formatDateIL(transaction.transaction_date)}
          </p>
        </div>
        <p
          className={`font-bold ${
            transaction.direction === 'in' ? 'text-green-700' : 'text-red-700'
          }`}
          dir="ltr"
        >
          {formatILS(transaction.amount)}
        </p>
      </header>
      {transaction.counterparty && (
        <p className="mt-2 text-sm text-gray-700 truncate">
          {transaction.counterparty}
        </p>
      )}
      <p className="text-xs text-gray-500 truncate mt-0.5">
        {accountOrCardLabel(transaction)}
      </p>
      <div className="mt-3 flex items-center justify-end gap-1 flex-wrap">
        <GhostButton onClick={onView}>צפייה</GhostButton>
        <GhostButton onClick={onEdit}>עריכה</GhostButton>
        <button
          type="button"
          onClick={onDelete}
          className="px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50"
        >
          מחיקה
        </button>
      </div>
    </div>
  );
}

export function TransactionsManager({
  tenantId,
  userId,
  transactions,
  bankAccounts,
  creditCards,
}: TransactionsManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDirection, setFilterDirection] = useState<
    'all' | TransactionDirection
  >('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (fromDate && t.transaction_date < fromDate) return false;
      if (toDate && t.transaction_date > toDate) return false;
      if (filterType !== 'all' && t.transaction_type !== filterType)
        return false;
      if (filterDirection !== 'all' && t.direction !== filterDirection)
        return false;
      if (filterAccount !== 'all' && t.bank_account_id !== filterAccount)
        return false;
      return true;
    });
  }, [
    transactions,
    fromDate,
    toDate,
    filterType,
    filterDirection,
    filterAccount,
  ]);

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let inSum = 0;
    let outSum = 0;
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const d = new Date(t.transaction_date);
      if (
        Number.isNaN(d.getTime()) ||
        d.getFullYear() !== y ||
        d.getMonth() !== m
      )
        continue;
      if (t.direction === 'in') inSum += t.amount;
      else outSum += t.amount;
    }
    return { inSum, outSum, net: inSum - outSum };
  }, [transactions]);

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
            📊
          </span>
          תנועות כספיות
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatBox
          label="נכנס החודש"
          value={formatILS(stats.inSum)}
          color="green"
        />
        <StatBox
          label="יוצא החודש"
          value={formatILS(stats.outSum)}
          color="red"
        />
        <StatBox
          label="נטו"
          value={formatILS(stats.net)}
          color={stats.net >= 0 ? 'green' : 'red'}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-end flex-wrap">
        <PrimaryButton onClick={() => setModal({ kind: 'add' })}>
          + רישום תנועה
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
          <label className="block text-xs text-gray-600 mb-1">סוג</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`${INPUT_CLASS} md:w-48`}
          >
            <option value="all">הכל</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">כיוון</label>
          <select
            value={filterDirection}
            onChange={(e) =>
              setFilterDirection(
                e.target.value as 'all' | TransactionDirection,
              )
            }
            className={`${INPUT_CLASS} md:w-32`}
          >
            <option value="all">הכל</option>
            <option value="in">נכנס</option>
            <option value="out">יוצא</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">חשבון</label>
          <select
            value={filterAccount}
            onChange={(e) => setFilterAccount(e.target.value)}
            className={`${INPUT_CLASS} md:w-40`}
          >
            <option value="all">הכל</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bank_name}
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

      {transactions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-gray-600">אין תנועות כספיות.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            אין תנועות התואמות לסינון שנבחר
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">תאריך</th>
                  <th className="px-4 py-3 font-medium text-gray-700">סוג</th>
                  <th className="px-4 py-3 font-medium text-gray-700">כיוון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">סכום</th>
                  <th className="px-4 py-3 font-medium text-gray-700">צד שני</th>
                  <th className="px-4 py-3 font-medium text-gray-700">חשבון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">תיאור</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3" dir="ltr">
                      {formatDateIL(t.transaction_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {TYPE_LABELS[t.transaction_type]}
                    </td>
                    <td className="px-4 py-3">
                      <DirectionBadge direction={t.direction} />
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        t.direction === 'in' ? 'text-green-700' : 'text-red-700'
                      }`}
                      dir="ltr"
                    >
                      {formatILS(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 truncate">
                      {t.counterparty ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700 truncate">
                      {accountOrCardLabel(t)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                      {t.description ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <GhostButton
                          onClick={() =>
                            setModal({ kind: 'view', transaction: t })
                          }
                        >
                          צפייה
                        </GhostButton>
                        <GhostButton
                          onClick={() =>
                            setModal({ kind: 'edit', transaction: t })
                          }
                        >
                          עריכה
                        </GhostButton>
                        <button
                          type="button"
                          onClick={() =>
                            setModal({ kind: 'delete', transaction: t })
                          }
                          className="px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50"
                        >
                          מחיקה
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((t) => (
              <TransactionCard
                key={t.id}
                transaction={t}
                onView={() => setModal({ kind: 'view', transaction: t })}
                onEdit={() => setModal({ kind: 'edit', transaction: t })}
                onDelete={() => setModal({ kind: 'delete', transaction: t })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.kind === 'add' && (
        <TransactionFormModal
          tenantId={tenantId}
          userId={userId}
          bankAccounts={bankAccounts}
          creditCards={creditCards}
          mode="add"
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <TransactionFormModal
          key={modal.transaction.id}
          tenantId={tenantId}
          userId={userId}
          bankAccounts={bankAccounts}
          creditCards={creditCards}
          mode="edit"
          transaction={modal.transaction}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'view' && (
        <ViewModal
          key={modal.transaction.id}
          transaction={modal.transaction}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'delete' && (
        <DeleteModal
          key={modal.transaction.id}
          tenantId={tenantId}
          transaction={modal.transaction}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
