'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useState,
} from 'react';
import {
  type ReconciliationStatus,
  createReconciliationAction,
  updateReconciliationStatusAction,
} from '../actions';

export interface ReconciliationRow {
  id: string;
  bank_account_id: string;
  reconciliation_date: string;
  statement_balance: number;
  system_balance: number;
  difference: number;
  status: ReconciliationStatus;
  notes: string | null;
  bank_name: string;
  account_number: string;
}

export interface BankAccountOption {
  id: string;
  bank_name: string;
  account_number: string;
  current_balance: number;
}

interface ReconciliationManagerProps {
  tenantId: string;
  userId: string;
  bankAccounts: BankAccountOption[];
  reconciliations: ReconciliationRow[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'new' }
  | { kind: 'view'; rec: ReconciliationRow }
  | { kind: 'status'; rec: ReconciliationRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const STATUS_CONFIG: Record<
  ReconciliationStatus,
  { label: string; badge: string }
> = {
  pending: { label: 'ממתין', badge: 'bg-gray-200 text-gray-800' },
  matched: { label: 'מותאם', badge: 'bg-green-100 text-green-800' },
  discrepancy: { label: 'פער', badge: 'bg-red-100 text-red-800' },
  resolved: { label: 'טופל', badge: 'bg-blue-100 text-blue-800' },
};

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function StatusBadge({ status }: { status: ReconciliationStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}
    >
      {c.label}
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

function DifferenceDisplay({ diff }: { diff: number }) {
  const isZero = Math.abs(diff) < 0.01;
  return (
    <span
      className={`font-bold ${isZero ? 'text-green-700' : 'text-red-700'}`}
      dir="ltr"
    >
      {isZero ? formatILS(0) : formatILS(diff)}
    </span>
  );
}

interface NewReconciliationModalProps {
  tenantId: string;
  userId: string;
  bankAccounts: BankAccountOption[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function NewReconciliationModal({
  tenantId,
  userId,
  bankAccounts,
  onClose,
  onSuccess,
}: NewReconciliationModalProps) {
  const [bankAccountId, setBankAccountId] = useState(
    bankAccounts[0]?.id ?? '',
  );
  const [date, setDate] = useState(todayIso());
  const [statementBalance, setStatementBalance] = useState('');
  const [step, setStep] = useState<'form' | 'compare'>('form');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedAccount = bankAccounts.find((b) => b.id === bankAccountId);
  const systemBalance = selectedAccount?.current_balance ?? 0;
  const statementNum = Number(statementBalance);
  const difference = Number.isFinite(statementNum)
    ? round2(statementNum - systemBalance)
    : 0;
  const isMatch = Math.abs(difference) < 0.01;

  const noBanks = bankAccounts.length === 0;

  function handleCompare(): void {
    setError(null);
    if (!bankAccountId) {
      setError('חשבון בנק חובה');
      return;
    }
    if (!date) {
      setError('תאריך חובה');
      return;
    }
    if (!statementBalance.trim() || !Number.isFinite(statementNum)) {
      setError('יש להזין יתרה מדף הבנק');
      return;
    }
    setStep('compare');
  }

  function handleBack(): void {
    setStep('form');
  }

  async function handleSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await createReconciliationAction(
        tenantId,
        userId,
        bankAccountId,
        date,
        statementBalance,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('ההתאמה נשמרה בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {step === 'form' ? 'התאמה חדשה' : 'תוצאות ההתאמה'}
      </h3>

      {noBanks ? (
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          יש להוסיף חשבון בנק לפני ביצוע התאמה.
        </div>
      ) : step === 'form' ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              חשבון בנק <span className="text-red-500">*</span>
            </label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך התאמה <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              יתרה בדף הבנק <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={statementBalance}
              onChange={(e) => setStatementBalance(e.target.value)}
              step="0.01"
              dir="ltr"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">
              הכנס את היתרה כפי שמופיעה בדף החשבון מהבנק
            </p>
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
            <GhostButton onClick={onClose}>ביטול</GhostButton>
            <PrimaryButton onClick={handleCompare}>השווה</PrimaryButton>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <section className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-700">חשבון:</dt>
                <dd className="font-medium">
                  {selectedAccount?.bank_name}{' '}
                  <span className="text-gray-500" dir="ltr">
                    ({selectedAccount?.account_number})
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">תאריך:</dt>
                <dd dir="ltr">{formatDateIL(date)}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="text-gray-700">יתרה בבנק:</dt>
                <dd className="font-medium" dir="ltr">
                  {formatILS(statementNum)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">יתרה במערכת:</dt>
                <dd className="font-medium" dir="ltr">
                  {formatILS(systemBalance)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <dt className="text-gray-800 font-bold">הפרש:</dt>
                <dd>
                  <DifferenceDisplay diff={difference} />
                </dd>
              </div>
            </dl>
          </section>

          {isMatch ? (
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm text-center font-bold">
              <span aria-hidden className="me-2">
                ✓
              </span>
              מצוין! אין פערים
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm text-center font-bold">
              <span aria-hidden className="me-2">
                ⚠️
              </span>
              קיים פער של {formatILS(Math.abs(difference))} — בדוק תנועות חסרות
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

          <div className="flex items-center justify-between gap-2 pt-2">
            <GhostButton onClick={handleBack} disabled={submitting}>
              חזור
            </GhostButton>
            <div className="flex items-center gap-2">
              <GhostButton onClick={onClose} disabled={submitting}>
                ביטול
              </GhostButton>
              <PrimaryButton type="submit" disabled={submitting}>
                {submitting ? 'שומר...' : 'שמור התאמה'}
              </PrimaryButton>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

interface StatusModalProps {
  tenantId: string;
  rec: ReconciliationRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function StatusModal({ tenantId, rec, onClose, onSuccess }: StatusModalProps) {
  const [status, setStatus] = useState<ReconciliationStatus>(rec.status);
  const [notes, setNotes] = useState(rec.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await updateReconciliationStatusAction(
        tenantId,
        rec.id,
        status,
        notes,
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
      <p className="mt-1 text-sm text-gray-600">
        {rec.bank_name}{' '}
        <span className="text-gray-500" dir="ltr">
          ({formatDateIL(rec.reconciliation_date)})
        </span>
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סטטוס חדש
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReconciliationStatus)}
            className={INPUT_CLASS}
          >
            {(
              ['pending', 'matched', 'discrepancy', 'resolved'] as const
            ).map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            הערות
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
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
            {submitting ? 'שומר...' : 'עדכן'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function ViewModal({
  rec,
  onClose,
}: {
  rec: ReconciliationRow;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} size="lg">
      <header className="flex items-center gap-2 mb-4 flex-wrap">
        <h3 className="text-lg font-bold text-gray-900">התאמת בנק</h3>
        <StatusBadge status={rec.status} />
      </header>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">חשבון:</dt>
          <dd>
            {rec.bank_name}{' '}
            <span className="text-gray-500" dir="ltr">
              ({rec.account_number})
            </span>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">תאריך:</dt>
          <dd dir="ltr">{formatDateIL(rec.reconciliation_date)}</dd>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          <dt className="text-gray-700">יתרה בבנק:</dt>
          <dd className="font-medium" dir="ltr">
            {formatILS(rec.statement_balance)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-700">יתרה במערכת:</dt>
          <dd className="font-medium" dir="ltr">
            {formatILS(rec.system_balance)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          <dt className="text-gray-800 font-bold">הפרש:</dt>
          <dd>
            <DifferenceDisplay diff={rec.difference} />
          </dd>
        </div>
        {rec.notes && (
          <div className="mt-3">
            <dt className="text-gray-700 text-xs mb-1">הערות:</dt>
            <dd className="text-gray-700 whitespace-pre-wrap">{rec.notes}</dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex justify-end">
        <GhostButton onClick={onClose}>סגור</GhostButton>
      </div>
    </Modal>
  );
}

function ReconciliationCard({
  rec,
  onView,
  onStatus,
}: {
  rec: ReconciliationRow;
  onView: () => void;
  onStatus: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-gray-900" dir="ltr">
            {formatDateIL(rec.reconciliation_date)}
          </p>
          <p className="text-sm text-gray-600 truncate">{rec.bank_name}</p>
        </div>
        <StatusBadge status={rec.status} />
      </header>
      <dl className="mt-2 space-y-0.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">יתרה בבנק:</dt>
          <dd dir="ltr">{formatILS(rec.statement_balance)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">יתרה במערכת:</dt>
          <dd dir="ltr">{formatILS(rec.system_balance)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">הפרש:</dt>
          <dd>
            <DifferenceDisplay diff={rec.difference} />
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-end gap-1">
        <GhostButton onClick={onView}>צפייה</GhostButton>
        <GhostButton onClick={onStatus}>עדכון סטטוס</GhostButton>
      </div>
    </div>
  );
}

export function ReconciliationManager({
  tenantId,
  userId,
  bankAccounts,
  reconciliations,
}: ReconciliationManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);

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
            🔍
          </span>
          התאמת בנק
        </h1>
      </header>

      <p className="text-sm text-gray-600 bg-white rounded-lg border border-gray-200 p-3">
        השוואה בין כסף הבנק האמיתי לבין התנועות במערכת. מומלץ לבצע אחת לחודש.
      </p>

      <div>
        <PrimaryButton onClick={() => setModal({ kind: 'new' })}>
          + התאמה חדשה
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

      {reconciliations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-gray-600">לא בוצעו התאמות בנק עדיין.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">תאריך</th>
                  <th className="px-4 py-3 font-medium text-gray-700">חשבון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    יתרה בבנק
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    יתרה במערכת
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">הפרש</th>
                  <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reconciliations.map((rec) => (
                  <tr key={rec.id}>
                    <td className="px-4 py-3" dir="ltr">
                      {formatDateIL(rec.reconciliation_date)}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {rec.bank_name}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {formatILS(rec.statement_balance)}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {formatILS(rec.system_balance)}
                    </td>
                    <td className="px-4 py-3">
                      <DifferenceDisplay diff={rec.difference} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={rec.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <GhostButton
                          onClick={() => setModal({ kind: 'view', rec })}
                        >
                          צפייה
                        </GhostButton>
                        <GhostButton
                          onClick={() => setModal({ kind: 'status', rec })}
                        >
                          עדכון סטטוס
                        </GhostButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {reconciliations.map((rec) => (
              <ReconciliationCard
                key={rec.id}
                rec={rec}
                onView={() => setModal({ kind: 'view', rec })}
                onStatus={() => setModal({ kind: 'status', rec })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.kind === 'new' && (
        <NewReconciliationModal
          tenantId={tenantId}
          userId={userId}
          bankAccounts={bankAccounts}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'view' && (
        <ViewModal
          key={modal.rec.id}
          rec={modal.rec}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'status' && (
        <StatusModal
          key={modal.rec.id}
          tenantId={tenantId}
          rec={modal.rec}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
