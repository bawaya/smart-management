'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type WorkerPayload,
  addWorkerAction,
  toggleWorkerAction,
  updateWorkerAction,
} from './actions';

export interface WorkerRow {
  id: string;
  full_name: string;
  id_number: string | null;
  phone: string | null;
  daily_rate: number | null;
  notes: string | null;
  is_active: number;
}

interface WorkersManagerProps {
  tenantId: string;
  defaultRate: number;
  workers: WorkerRow[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type FormMode = { mode: 'add' } | { mode: 'edit'; worker: WorkerRow };
type StatusFilter = 'all' | 'active' | 'inactive';

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

function formatRate(n: number): string {
  return `₪${n.toLocaleString('he-IL')}/יום`;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}
    >
      {active ? 'פעיל' : 'מושבת'}
    </span>
  );
}

function RateCell({
  rate,
  defaultRate,
}: {
  rate: number | null;
  defaultRate: number;
}) {
  if (rate != null) {
    return (
      <span className="text-gray-900" dir="ltr">
        {formatRate(rate)}
      </span>
    );
  }
  return (
    <span className="text-gray-500 text-xs" dir="ltr">
      {formatRate(defaultRate)} (ברירת מחדל)
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

function rateToInputValue(n: number | null): string {
  return n == null ? '' : String(n);
}

interface WorkerFormModalProps {
  tenantId: string;
  defaultRate: number;
  state: FormMode;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function WorkerFormModal({
  tenantId,
  defaultRate,
  state,
  onClose,
  onSuccess,
}: WorkerFormModalProps) {
  const editing = state.mode === 'edit';
  const initial = editing ? state.worker : null;

  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [idNumber, setIdNumber] = useState(initial?.id_number ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [dailyRate, setDailyRate] = useState(
    rateToInputValue(initial?.daily_rate ?? null),
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const cleanName = fullName.trim();
    if (!cleanName) {
      setError('שם מלא חובה');
      return;
    }

    const payload: WorkerPayload = {
      fullName: cleanName,
      idNumber,
      phone,
      dailyRate,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateWorkerAction(tenantId, state.worker.id, payload)
        : await addWorkerAction(tenantId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'הפרטים עודכנו בהצלחה' : 'העובד נוסף בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="lg">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת עובד' : 'הוספת עובד'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שם מלא <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תעודת זהות
            </label>
            <input
              type="text"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              טלפון
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            שכר יומי
          </label>
          <input
            type="number"
            value={dailyRate}
            onChange={(e) => setDailyRate(e.target.value)}
            min="0"
            step="0.01"
            dir="ltr"
            placeholder={`ברירת מחדל (₪${defaultRate.toLocaleString('he-IL')})`}
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-xs text-gray-500">
            השאר ריק לשימוש בשכר ברירת המחדל
          </p>
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
            {submitting ? 'שומר...' : 'שמור'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

interface ToggleModalProps {
  tenantId: string;
  worker: WorkerRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ToggleModal({
  tenantId,
  worker,
  onClose,
  onSuccess,
}: ToggleModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activating = worker.is_active !== 1;

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await toggleWorkerAction(tenantId, worker.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(activating ? 'העובד הופעל בהצלחה' : 'העובד הושבת בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <h3 className="text-lg font-bold text-gray-900">
        {activating ? 'הפעלת עובד' : 'השבתת עובד'}
      </h3>
      <p className="mt-2 text-sm text-gray-600">
        {activating
          ? `האם להפעיל מחדש את ${worker.full_name}?`
          : `האם להשבית את ${worker.full_name}? לא ניתן יהיה לצרף אותו לרישומים חדשים.`}
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
          className={`px-4 py-2 rounded-md text-white font-bold text-sm transition-colors disabled:opacity-60 ${
            activating
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {submitting ? '...' : activating ? 'הפעל' : 'השבת'}
        </button>
      </div>
    </Modal>
  );
}

function WorkerCard({
  worker,
  defaultRate,
  onEdit,
  onToggle,
}: {
  worker: WorkerRow;
  defaultRate: number;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const active = worker.is_active === 1;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 truncate">
            {worker.full_name}
          </h3>
          {worker.id_number && (
            <p className="text-xs text-gray-500" dir="ltr">
              ת.ז {worker.id_number}
            </p>
          )}
        </div>
        <StatusBadge active={active} />
      </header>

      {worker.phone && (
        <p className="mt-2 text-sm text-gray-700" dir="ltr">
          {worker.phone}
        </p>
      )}

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">שכר יומי:</dt>
          <dd>
            <RateCell rate={worker.daily_rate} defaultRate={defaultRate} />
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-end gap-1">
        <GhostButton onClick={onEdit}>עריכה</GhostButton>
        <button
          type="button"
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

export function WorkersManager({
  tenantId,
  defaultRate,
  workers,
}: WorkersManagerProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormMode | null>(null);
  const [toggleWorker, setToggleWorker] = useState<WorkerRow | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(
    () =>
      workers.filter((w) => {
        if (filterStatus === 'active') return w.is_active === 1;
        if (filterStatus === 'inactive') return w.is_active !== 1;
        return true;
      }),
    [workers, filterStatus],
  );

  function handleSuccess(text: string): void {
    setFormState(null);
    setToggleWorker(null);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            👷
          </span>
          ניהול עובדים
        </h1>
      </header>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <PrimaryButton onClick={() => setFormState({ mode: 'add' })}>
          + הוסף עובד
        </PrimaryButton>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className={`${INPUT_CLASS} md:w-40`}
          aria-label="סינון לפי סטטוס"
        >
          <option value="all">הכל</option>
          <option value="active">פעילים</option>
          <option value="inactive">מושבתים</option>
        </select>
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

      {workers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-gray-600">
            אין עובדים עדיין. הוסף את העובד הראשון שלך.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            אין עובדים התואמים לסינון שנבחר
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">שם מלא</th>
                  <th className="px-4 py-3 font-medium text-gray-700">ת.ז</th>
                  <th className="px-4 py-3 font-medium text-gray-700">טלפון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    שכר יומי
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((worker) => {
                  const active = worker.is_active === 1;
                  return (
                    <tr key={worker.id}>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {worker.full_name}
                      </td>
                      <td className="px-4 py-3 text-gray-700" dir="ltr">
                        {worker.id_number ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700" dir="ltr">
                        {worker.phone ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <RateCell
                          rate={worker.daily_rate}
                          defaultRate={defaultRate}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={active} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <GhostButton
                            onClick={() =>
                              setFormState({ mode: 'edit', worker })
                            }
                          >
                            עריכה
                          </GhostButton>
                          <button
                            type="button"
                            onClick={() => setToggleWorker(worker)}
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

          <div className="md:hidden space-y-3">
            {filtered.map((worker) => (
              <WorkerCard
                key={worker.id}
                worker={worker}
                defaultRate={defaultRate}
                onEdit={() => setFormState({ mode: 'edit', worker })}
                onToggle={() => setToggleWorker(worker)}
              />
            ))}
          </div>
        </>
      )}

      {formState && (
        <WorkerFormModal
          key={formState.mode === 'edit' ? formState.worker.id : 'add'}
          tenantId={tenantId}
          defaultRate={defaultRate}
          state={formState}
          onClose={() => setFormState(null)}
          onSuccess={handleSuccess}
        />
      )}

      {toggleWorker && (
        <ToggleModal
          key={toggleWorker.id}
          tenantId={tenantId}
          worker={toggleWorker}
          onClose={() => setToggleWorker(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
