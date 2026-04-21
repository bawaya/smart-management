'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type InvoiceStatus,
  type InvoiceSummary,
  generateInvoiceAction,
  recordPaymentAction,
  searchLogsForInvoiceAction,
  updateInvoiceStatusAction,
} from './actions';

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  client_id: string;
  period_start: string;
  period_end: string;
  total_equipment_days: number;
  total_equipment_revenue: number;
  total_worker_days: number;
  total_worker_revenue: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: InvoiceStatus;
  paid_amount: number | null;
  paid_date: string | null;
  created_at: string;
  client_name: string;
}

export interface ClientOption {
  id: string;
  name: string;
}

interface InvoicesManagerProps {
  tenantId: string;
  userId: string;
  equipmentLabel: string;
  invoices: InvoiceRow[];
  clients: ClientOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'generate' }
  | { kind: 'view'; invoice: InvoiceRow }
  | { kind: 'send'; invoice: InvoiceRow }
  | { kind: 'payment'; invoice: InvoiceRow }
  | { kind: 'cancel'; invoice: InvoiceRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; badge: string }
> = {
  draft: { label: 'טיוטה', badge: 'bg-gray-200 text-gray-800' },
  sent: { label: 'נשלחה', badge: 'bg-blue-100 text-blue-800' },
  paid: { label: 'שולמה', badge: 'bg-green-100 text-green-800' },
  partial: { label: 'שולמה חלקית', badge: 'bg-yellow-100 text-yellow-800' },
  cancelled: { label: 'בוטלה', badge: 'bg-red-100 text-red-800' },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}
    >
      {c.label}
    </span>
  );
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

function formatPeriod(start: string, end: string): string {
  const s = (start ?? '').slice(0, 10).split('-');
  const e = (end ?? '').slice(0, 10).split('-');
  if (s.length !== 3 || e.length !== 3) return `${start} — ${end}`;
  return `${s[2]}/${s[1]} — ${e[2]}/${e[1]}/${e[0]}`;
}

function firstDayOfPrevMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return toIso(d);
}

function lastDayOfPrevMonth(): string {
  const d = new Date();
  d.setDate(0);
  return toIso(d);
}

function todayIso(): string {
  return toIso(new Date());
}

function toIso(d: Date): string {
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

interface GenerateModalProps {
  tenantId: string;
  userId: string;
  clients: ClientOption[];
  equipmentLabel: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function GenerateInvoiceModal({
  tenantId,
  userId,
  clients,
  equipmentLabel,
  onClose,
  onSuccess,
}: GenerateModalProps) {
  const [clientId, setClientId] = useState('');
  const [periodStart, setPeriodStart] = useState(firstDayOfPrevMonth());
  const [periodEnd, setPeriodEnd] = useState(lastDayOfPrevMonth());
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(): Promise<void> {
    if (searching) return;
    setError(null);
    if (!clientId) {
      setError('יש לבחור לקוח');
      return;
    }
    if (!periodStart || !periodEnd) {
      setError('יש לבחור תקופה');
      return;
    }
    setSearching(true);
    try {
      const res = await searchLogsForInvoiceAction(
        tenantId,
        clientId,
        periodStart,
        periodEnd,
      );
      if (!res.success) {
        setError(res.error);
        setSummary(null);
        return;
      }
      setSummary(res.summary);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  }

  function handleFormChange(): void {
    setSummary(null);
    setSearched(false);
  }

  async function handleGenerate(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await generateInvoiceAction(
        tenantId,
        userId,
        clientId,
        periodStart,
        periodEnd,
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('החשבונית הופקה בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  const hasRecords = summary != null && summary.logIds.length > 0;
  const equipmentUnit =
    summary && summary.equipmentDays > 0
      ? summary.equipmentRevenue / summary.equipmentDays
      : 0;
  const workerUnit =
    summary && summary.workerDays > 0
      ? summary.workersRevenue / summary.workerDays
      : 0;

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        הפקת חשבונית חודשית
      </h3>

      <div data-testid="invoices-generate-form" className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            לקוח <span className="text-red-500">*</span>
          </label>
          <select
            data-testid="invoices-generate-client-id"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              handleFormChange();
            }}
            className={INPUT_CLASS}
          >
            <option value="">בחר לקוח</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תקופה מ
            </label>
            <input
              type="date"
              data-testid="invoices-generate-period-start"
              value={periodStart}
              onChange={(e) => {
                setPeriodStart(e.target.value);
                handleFormChange();
              }}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תקופה עד
            </label>
            <input
              type="date"
              data-testid="invoices-generate-period-end"
              value={periodEnd}
              onChange={(e) => {
                setPeriodEnd(e.target.value);
                handleFormChange();
              }}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <PrimaryButton
            onClick={handleSearch}
            disabled={searching}
            testId="invoices-generate-search"
          >
            {searching ? 'מחפש...' : 'חפש רישומים'}
          </PrimaryButton>
        </div>

        {searched && summary && !hasRecords && (
          <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm text-center">
            לא נמצאו רישומים מאושרים בתקופה זו
          </div>
        )}

        {hasRecords && summary && (
          <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-amber-900 mb-3">סיכום</h4>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-700">
                  ימי {equipmentLabel}:{' '}
                  <span dir="ltr">
                    {summary.equipmentDays} × {formatILS(equipmentUnit)}
                  </span>
                </dt>
                <dd className="font-medium text-gray-900" dir="ltr">
                  {formatILS(summary.equipmentRevenue)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">
                  ימי עובדים:{' '}
                  <span dir="ltr">
                    {summary.workerDays} × {formatILS(workerUnit)}
                  </span>
                </dt>
                <dd className="font-medium text-gray-900" dir="ltr">
                  {formatILS(summary.workersRevenue)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
                <dt className="text-gray-800 font-semibold">
                  סה״כ לפני מע״מ:
                </dt>
                <dd className="font-medium" dir="ltr">
                  {formatILS(summary.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">
                  מע״מ (<span dir="ltr">{summary.vatRate}%</span>):
                </dt>
                <dd className="font-medium" dir="ltr">
                  {formatILS(summary.vatAmount)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
                <dt className="text-gray-900 font-bold">סה״כ כולל מע״מ:</dt>
                <dd className="font-bold text-gray-900" dir="ltr">
                  {formatILS(summary.total)}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {error && (
          <div
            role="alert"
            data-testid="invoices-generate-error"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton
            onClick={onClose}
            disabled={submitting || searching}
            testId="invoices-generate-cancel"
          >
            ביטול
          </GhostButton>
          {hasRecords && (
            <PrimaryButton
              onClick={handleGenerate}
              disabled={submitting}
              testId="invoices-generate-submit"
            >
              {submitting ? 'מפיק...' : 'הפק חשבונית'}
            </PrimaryButton>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ViewModal({
  invoice,
  equipmentLabel,
  onClose,
}: {
  invoice: InvoiceRow;
  equipmentLabel: string;
  onClose: () => void;
}) {
  const remaining =
    invoice.total - (invoice.paid_amount ?? 0);
  const showRemaining = remaining > 0.01;

  return (
    <Modal onClose={onClose} size="lg">
      <header className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900" dir="ltr">
            {invoice.invoice_number}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{invoice.client_name}</p>
          <p className="text-xs text-gray-500 mt-0.5" dir="ltr">
            {formatPeriod(invoice.period_start, invoice.period_end)}
          </p>
        </div>
        <StatusBadge status={invoice.status} />
      </header>

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-700">
            ימי {equipmentLabel}:{' '}
            <span dir="ltr">{invoice.total_equipment_days}</span>
          </dt>
          <dd className="font-medium" dir="ltr">
            {formatILS(invoice.total_equipment_revenue)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-700">
            ימי עובדים: <span dir="ltr">{invoice.total_worker_days}</span>
          </dt>
          <dd className="font-medium" dir="ltr">
            {formatILS(invoice.total_worker_revenue)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          <dt className="text-gray-800 font-semibold">סה״כ לפני מע״מ:</dt>
          <dd dir="ltr">{formatILS(invoice.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-700">
            מע״מ (<span dir="ltr">{invoice.vat_rate}%</span>):
          </dt>
          <dd dir="ltr">{formatILS(invoice.vat_amount)}</dd>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
          <dt className="text-gray-900 font-bold">סה״כ כולל מע״מ:</dt>
          <dd className="font-bold text-gray-900" dir="ltr">
            {formatILS(invoice.total)}
          </dd>
        </div>
        {invoice.paid_amount != null && invoice.paid_amount > 0 && (
          <>
            <div className="flex justify-between">
              <dt className="text-gray-700">שולם:</dt>
              <dd className="text-green-700 font-medium" dir="ltr">
                {formatILS(invoice.paid_amount)}
              </dd>
            </div>
            {showRemaining && (
              <div className="flex justify-between">
                <dt className="text-gray-700">יתרה:</dt>
                <dd className="text-red-600 font-medium" dir="ltr">
                  {formatILS(remaining)}
                </dd>
              </div>
            )}
            {invoice.paid_date && (
              <div className="flex justify-between">
                <dt className="text-gray-700">תאריך תשלום:</dt>
                <dd dir="ltr">{formatDateIL(invoice.paid_date)}</dd>
              </div>
            )}
          </>
        )}
      </dl>

      <div className="mt-5 flex justify-end">
        <GhostButton onClick={onClose}>סגור</GhostButton>
      </div>
    </Modal>
  );
}

function SendModal({
  tenantId,
  invoice,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  invoice: InvoiceRow;
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
      const res = await updateInvoiceStatusAction(tenantId, invoice.id, 'sent');
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('החשבונית סומנה כנשלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div data-testid="invoices-send-modal">
        <h3 className="text-lg font-bold text-gray-900">סימון כנשלחה</h3>
        <p className="mt-2 text-sm text-gray-600">
          לסמן את חשבונית <span dir="ltr">{invoice.invoice_number}</span>{' '}
          כנשלחה ללקוח?
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
            testId="invoices-send-cancel"
          >
            ביטול
          </GhostButton>
          <button
            type="button"
            data-testid="invoices-send-confirm"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {submitting ? '...' : 'סמן כנשלחה'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PaymentModal({
  tenantId,
  invoice,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  invoice: InvoiceRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const remaining = Math.max(0, invoice.total - (invoice.paid_amount ?? 0));
  const [amount, setAmount] = useState(String(remaining));
  const [paymentDate, setPaymentDate] = useState(todayIso());
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
      const res = await recordPaymentAction(
        tenantId,
        invoice.id,
        amount,
        paymentDate,
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
      <p className="mt-1 text-sm text-gray-600" dir="ltr">
        {invoice.invoice_number}
      </p>
      <p className="mt-1 text-sm text-gray-700">
        יתרה לתשלום:{' '}
        <span className="font-medium" dir="ltr">
          {formatILS(remaining)}
        </span>
      </p>

      <form
        onSubmit={handleSubmit}
        data-testid="invoices-payment-modal"
        className="mt-4 space-y-3"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            סכום ששולם <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            data-testid="invoices-payment-amount"
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
            תאריך תשלום <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            data-testid="invoices-payment-date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
            dir="ltr"
            className={INPUT_CLASS}
          />
        </div>

        {error && (
          <div
            role="alert"
            data-testid="invoices-payment-error"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton
            onClick={onClose}
            disabled={submitting}
            testId="invoices-payment-cancel"
          >
            ביטול
          </GhostButton>
          <PrimaryButton
            type="submit"
            disabled={submitting}
            testId="invoices-payment-submit"
          >
            {submitting ? 'רושם...' : 'רשום תשלום'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

function CancelModal({
  tenantId,
  invoice,
  onClose,
  onSuccess,
}: {
  tenantId: string;
  invoice: InvoiceRow;
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
      const res = await updateInvoiceStatusAction(
        tenantId,
        invoice.id,
        'cancelled',
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('החשבונית בוטלה והרישומים שוחזרו');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div data-testid="invoices-cancel-modal">
        <h3 className="text-lg font-bold text-gray-900">ביטול חשבונית</h3>
        <p className="mt-2 text-sm text-gray-600">
          לבטל את חשבונית <span dir="ltr">{invoice.invoice_number}</span>?
          הרישומים המשויכים יחזרו לסטטוס מאושר.
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
            testId="invoices-cancel-cancel"
          >
            ביטול
          </GhostButton>
          <button
            type="button"
            data-testid="invoices-cancel-confirm"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {submitting ? 'מבטל...' : 'בטל חשבונית'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function InvoiceCard({
  invoice,
  onView,
  onSend,
  onPayment,
  onCancel,
}: {
  invoice: InvoiceRow;
  onView: () => void;
  onSend: () => void;
  onPayment: () => void;
  onCancel: () => void;
}) {
  const canSend = invoice.status === 'draft';
  const canPayment =
    invoice.status === 'sent' || invoice.status === 'partial';
  const canCancel =
    invoice.status === 'draft' || invoice.status === 'sent';

  return (
    <div
      data-testid="invoices-row"
      data-invoice-id={invoice.id}
      data-invoice-status={invoice.status}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            data-testid="invoices-row-number"
            className="font-bold text-gray-900"
            dir="ltr"
          >
            {invoice.invoice_number}
          </p>
          <p
            data-testid="invoices-row-client"
            className="text-sm text-gray-600 truncate"
          >
            {invoice.client_name}
          </p>
          <p className="text-xs text-gray-500 mt-0.5" dir="ltr">
            {formatPeriod(invoice.period_start, invoice.period_end)}
          </p>
        </div>
        <div data-testid="invoices-row-status">
          <StatusBadge status={invoice.status} />
        </div>
      </header>

      <p
        data-testid="invoices-row-total"
        className="mt-2 text-lg font-bold text-gray-900"
        dir="ltr"
      >
        {formatILS(invoice.total)}
      </p>

      <div className="mt-3 flex items-center justify-end gap-1 flex-wrap">
        <GhostButton onClick={onView} testId="invoices-row-view">
          צפייה
        </GhostButton>
        {canSend && (
          <GhostButton onClick={onSend} testId="invoices-row-send">
            שליחה
          </GhostButton>
        )}
        {canPayment && (
          <button
            type="button"
            data-testid="invoices-row-payment"
            onClick={onPayment}
            className="px-3 py-2 rounded-md text-sm text-green-700 hover:bg-green-50"
          >
            רישום תשלום
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            data-testid="invoices-row-cancel"
            onClick={onCancel}
            className="px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50"
          >
            ביטול
          </button>
        )}
      </div>
    </div>
  );
}

export function InvoicesManager({
  tenantId,
  userId,
  equipmentLabel,
  invoices,
  clients,
}: InvoicesManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | InvoiceStatus>(
    'all',
  );
  const [filterClient, setFilterClient] = useState<string>('all');

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
      if (filterClient !== 'all' && inv.client_id !== filterClient)
        return false;
      return true;
    });
  }, [invoices, filterStatus, filterClient]);

  const stats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let openCount = 0;
    let pendingTotal = 0;
    let paidThisMonth = 0;
    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      if (inv.status === 'draft' || inv.status === 'sent') openCount += 1;
      if (inv.status === 'sent') pendingTotal += inv.total;
      if (inv.paid_date && inv.paid_amount != null) {
        const d = new Date(inv.paid_date);
        if (
          !Number.isNaN(d.getTime()) &&
          d.getFullYear() === y &&
          d.getMonth() === m
        ) {
          paidThisMonth += inv.paid_amount;
        }
      }
    }
    return { openCount, pendingTotal, paidThisMonth };
  }, [invoices]);

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
            📄
          </span>
          חשבוניות
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatBox
          label="חשבוניות פתוחות"
          value={stats.openCount.toLocaleString('he-IL')}
        />
        <StatBox
          label="ממתין לתשלום"
          value={formatILS(stats.pendingTotal)}
        />
        <StatBox label="שולם החודש" value={formatILS(stats.paidThisMonth)} />
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-end flex-wrap">
        <PrimaryButton
          onClick={() => setModal({ kind: 'generate' })}
          testId="invoices-add-button"
        >
          + הפק חשבונית חודשית
        </PrimaryButton>
        <div>
          <label className="block text-xs text-gray-600 mb-1">סטטוס</label>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | InvoiceStatus)
            }
            className={`${INPUT_CLASS} md:w-44`}
          >
            <option value="all">הכל</option>
            <option value="draft">טיוטה</option>
            <option value="sent">נשלחה</option>
            <option value="paid">שולמה</option>
            <option value="partial">שולמה חלקית</option>
            <option value="cancelled">בוטלה</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">לקוח</label>
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className={`${INPUT_CLASS} md:w-44`}
          >
            <option value="all">כל הלקוחות</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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

      {invoices.length === 0 ? (
        <div
          data-testid="invoices-empty"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center"
        >
          <p className="text-gray-600">אין חשבוניות עדיין.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            אין חשבוניות התואמות לסינון שנבחר
          </p>
        </div>
      ) : (
        <>
          <div
            data-testid="invoices-list"
            className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">מספר</th>
                  <th className="px-4 py-3 font-medium text-gray-700">לקוח</th>
                  <th className="px-4 py-3 font-medium text-gray-700">תקופה</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    ימי ציוד
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    ימי עובדים
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סה״כ</th>
                  <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((inv) => {
                  const canSend = inv.status === 'draft';
                  const canPayment =
                    inv.status === 'sent' || inv.status === 'partial';
                  const canCancel =
                    inv.status === 'draft' || inv.status === 'sent';
                  return (
                    <tr
                      key={inv.id}
                      data-testid="invoices-row"
                      data-invoice-id={inv.id}
                      data-invoice-status={inv.status}
                    >
                      <td
                        data-testid="invoices-row-number"
                        className="px-4 py-3 font-medium"
                        dir="ltr"
                      >
                        {inv.invoice_number}
                      </td>
                      <td
                        data-testid="invoices-row-client"
                        className="px-4 py-3 text-gray-900"
                      >
                        {inv.client_name}
                      </td>
                      <td className="px-4 py-3 text-gray-700" dir="ltr">
                        {formatPeriod(inv.period_start, inv.period_end)}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {inv.total_equipment_days}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {inv.total_worker_days}
                      </td>
                      <td
                        data-testid="invoices-row-total"
                        className="px-4 py-3 font-medium"
                        dir="ltr"
                      >
                        {formatILS(inv.total)}
                      </td>
                      <td data-testid="invoices-row-status" className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <GhostButton
                            onClick={() =>
                              setModal({ kind: 'view', invoice: inv })
                            }
                            testId="invoices-row-view"
                          >
                            צפייה
                          </GhostButton>
                          {canSend && (
                            <GhostButton
                              onClick={() =>
                                setModal({ kind: 'send', invoice: inv })
                              }
                              testId="invoices-row-send"
                            >
                              שליחה
                            </GhostButton>
                          )}
                          {canPayment && (
                            <button
                              type="button"
                              data-testid="invoices-row-payment"
                              onClick={() =>
                                setModal({ kind: 'payment', invoice: inv })
                              }
                              className="px-3 py-2 rounded-md text-sm text-green-700 hover:bg-green-50"
                            >
                              רישום תשלום
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              data-testid="invoices-row-cancel"
                              onClick={() =>
                                setModal({ kind: 'cancel', invoice: inv })
                              }
                              className="px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50"
                            >
                              ביטול
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div data-testid="invoices-list" className="md:hidden space-y-3">
            {filtered.map((inv) => (
              <InvoiceCard
                key={inv.id}
                invoice={inv}
                onView={() => setModal({ kind: 'view', invoice: inv })}
                onSend={() => setModal({ kind: 'send', invoice: inv })}
                onPayment={() => setModal({ kind: 'payment', invoice: inv })}
                onCancel={() => setModal({ kind: 'cancel', invoice: inv })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.kind === 'generate' && (
        <GenerateInvoiceModal
          tenantId={tenantId}
          userId={userId}
          clients={clients}
          equipmentLabel={equipmentLabel}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'view' && (
        <ViewModal
          key={modal.invoice.id}
          invoice={modal.invoice}
          equipmentLabel={equipmentLabel}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'send' && (
        <SendModal
          key={modal.invoice.id}
          tenantId={tenantId}
          invoice={modal.invoice}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'payment' && (
        <PaymentModal
          key={modal.invoice.id}
          tenantId={tenantId}
          invoice={modal.invoice}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'cancel' && (
        <CancelModal
          key={modal.invoice.id}
          tenantId={tenantId}
          invoice={modal.invoice}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
