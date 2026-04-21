'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type EquipmentPayload,
  type EquipmentStatus,
  addEquipmentAction,
  updateEquipmentAction,
  updateEquipmentStatusAction,
} from './actions';

export interface EquipmentRow {
  id: string;
  name: string;
  equipment_type_id: string;
  identifier: string | null;
  status: EquipmentStatus;
  insurance_expiry: string | null;
  license_expiry: string | null;
  last_maintenance: string | null;
  notes: string | null;
  type_name: string | null;
}

export interface EquipmentTypeOption {
  id: string;
  name: string;
}

interface EquipmentManagerProps {
  tenantId: string;
  equipmentLabel: string;
  items: EquipmentRow[];
  types: EquipmentTypeOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type FormMode = { mode: 'add' } | { mode: 'edit'; item: EquipmentRow };

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const STATUS_CONFIG: Record<
  EquipmentStatus,
  { label: string; badge: string; button: string }
> = {
  available: {
    label: 'זמין',
    badge: 'bg-green-100 text-green-800',
    button: 'bg-green-600 hover:bg-green-700 text-white',
  },
  deployed: {
    label: 'בשטח',
    badge: 'bg-blue-100 text-blue-800',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  maintenance: {
    label: 'תחזוקה',
    badge: 'bg-yellow-100 text-yellow-800',
    button: 'bg-yellow-500 hover:bg-yellow-600 text-black',
  },
  retired: {
    label: 'לא פעיל',
    badge: 'bg-gray-200 text-gray-800',
    button: 'bg-gray-500 hover:bg-gray-600 text-white',
  },
};

const ALL_STATUSES: EquipmentStatus[] = [
  'available',
  'deployed',
  'maintenance',
  'retired',
];

function StatusBadge({ status }: { status: EquipmentStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}
    >
      {c.label}
    </span>
  );
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

function DateCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-gray-400">—</span>;
  const days = daysUntil(date);
  const display = date.slice(0, 10);
  if (days !== null && days <= 30) {
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

function toDateInputValue(v: string | null): string {
  if (!v) return '';
  return v.slice(0, 10);
}

interface EquipmentFormModalProps {
  tenantId: string;
  equipmentLabel: string;
  state: FormMode;
  types: EquipmentTypeOption[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function EquipmentFormModal({
  tenantId,
  equipmentLabel,
  state,
  types,
  onClose,
  onSuccess,
}: EquipmentFormModalProps) {
  const editing = state.mode === 'edit';
  const initial = editing ? state.item : null;

  const [name, setName] = useState(initial?.name ?? '');
  const [typeId, setTypeId] = useState(
    initial?.equipment_type_id ?? types[0]?.id ?? '',
  );
  const [identifier, setIdentifier] = useState(initial?.identifier ?? '');
  const [status, setStatus] = useState<EquipmentStatus>(
    initial?.status ?? 'available',
  );
  const [insuranceExpiry, setInsuranceExpiry] = useState(
    toDateInputValue(initial?.insurance_expiry ?? null),
  );
  const [licenseExpiry, setLicenseExpiry] = useState(
    toDateInputValue(initial?.license_expiry ?? null),
  );
  const [lastMaintenance, setLastMaintenance] = useState(
    toDateInputValue(initial?.last_maintenance ?? null),
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const typesEmpty = types.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setError('שם חובה');
      return;
    }
    if (!typeId) {
      setError('יש לבחור סוג');
      return;
    }

    const payload: EquipmentPayload = {
      name: cleanName,
      equipmentTypeId: typeId,
      identifier,
      status,
      insuranceExpiry,
      licenseExpiry,
      lastMaintenance,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateEquipmentAction(tenantId, state.item.id, payload)
        : await addEquipmentAction(tenantId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(
        editing ? 'הפרטים עודכנו בהצלחה' : `${equipmentLabel} נוסף בהצלחה`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? `עריכת ${equipmentLabel}` : `הוספת ${equipmentLabel}`}
      </h3>
      {typesEmpty && !editing ? (
        <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          לא הוגדרו סוגים. יש להגדיר סוגי ציוד בהגדרות לפני הוספת פריט חדש.
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          data-testid="equipment-form"
          className="space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                data-testid="equipment-form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סוג <span className="text-red-500">*</span>
              </label>
              <select
                data-testid="equipment-form-type"
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                required
                className={INPUT_CLASS}
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מזהה / מספר רישוי
              </label>
              <input
                type="text"
                data-testid="equipment-form-identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                סטטוס
              </label>
              <select
                data-testid="equipment-form-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as EquipmentStatus)}
                className={INPUT_CLASS}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך ביטוח
              </label>
              <input
                type="date"
                data-testid="equipment-form-insurance-expiry"
                value={insuranceExpiry}
                onChange={(e) => setInsuranceExpiry(e.target.value)}
                className={INPUT_CLASS}
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך רישיון
              </label>
              <input
                type="date"
                data-testid="equipment-form-license-expiry"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                className={INPUT_CLASS}
                dir="ltr"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תחזוקה אחרונה
              </label>
              <input
                type="date"
                data-testid="equipment-form-last-maintenance"
                value={lastMaintenance}
                onChange={(e) => setLastMaintenance(e.target.value)}
                className={INPUT_CLASS}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              הערות
            </label>
            <textarea
              data-testid="equipment-form-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={INPUT_CLASS}
            />
          </div>

          {error && (
            <div
              role="alert"
              data-testid="equipment-form-error"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <GhostButton
              onClick={onClose}
              disabled={submitting}
              testId="equipment-form-cancel"
            >
              ביטול
            </GhostButton>
            <PrimaryButton
              type="submit"
              disabled={submitting}
              testId="equipment-form-submit"
            >
              {submitting ? 'שומר...' : 'שמור'}
            </PrimaryButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

interface QuickStatusModalProps {
  tenantId: string;
  item: EquipmentRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function QuickStatusModal({
  tenantId,
  item,
  onClose,
  onSuccess,
}: QuickStatusModalProps) {
  const [submitting, setSubmitting] = useState<EquipmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(status: EquipmentStatus): Promise<void> {
    if (submitting) return;
    if (status === item.status) {
      onClose();
      return;
    }
    setError(null);
    setSubmitting(status);
    try {
      const res = await updateEquipmentStatusAction(tenantId, item.id, status);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('הסטטוס עודכן בהצלחה');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div data-testid="equipment-status-modal">
        <h3 className="text-lg font-bold text-gray-900">שינוי סטטוס</h3>
        <p className="mt-1 text-sm text-gray-600">{item.name}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {ALL_STATUSES.map((status) => {
            const c = STATUS_CONFIG[status];
            const current = status === item.status;
            const isLoading = submitting === status;
            return (
              <button
                key={status}
                type="button"
                data-testid={`equipment-status-option-${status}`}
                onClick={() => choose(status)}
                disabled={submitting !== null}
                className={`px-4 py-3 rounded-md font-bold text-sm transition-colors disabled:opacity-60 ${c.button} ${
                  current ? 'ring-2 ring-offset-2 ring-black/20' : ''
                }`}
              >
                {isLoading ? '...' : c.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div
            role="alert"
            data-testid="equipment-status-error"
            className="mt-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <GhostButton
            onClick={onClose}
            disabled={submitting !== null}
            testId="equipment-status-cancel"
          >
            סגור
          </GhostButton>
        </div>
      </div>
    </Modal>
  );
}

function EquipmentCard({
  item,
  onEdit,
  onStatus,
}: {
  item: EquipmentRow;
  onEdit: () => void;
  onStatus: () => void;
}) {
  return (
    <div
      data-testid="equipment-row"
      data-equipment-id={item.id}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3
            data-testid="equipment-row-name"
            className="font-bold text-gray-900 truncate"
          >
            {item.name}
          </h3>
          <p className="text-sm text-gray-600 truncate">
            {item.type_name ?? '—'}
            {item.identifier ? (
              <>
                {' · '}
                <span dir="ltr">{item.identifier}</span>
              </>
            ) : null}
          </p>
        </div>
        <div data-testid="equipment-row-status">
          <StatusBadge status={item.status} />
        </div>
      </header>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">ביטוח:</dt>
          <dd>
            <DateCell date={item.insurance_expiry} />
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">רישיון:</dt>
          <dd>
            <DateCell date={item.license_expiry} />
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-end gap-1">
        <GhostButton onClick={onEdit} testId="equipment-row-edit">
          עריכה
        </GhostButton>
        <GhostButton onClick={onStatus} testId="equipment-row-status-change">
          שינוי סטטוס
        </GhostButton>
      </div>
    </div>
  );
}

export function EquipmentManager({
  tenantId,
  equipmentLabel,
  items,
  types,
}: EquipmentManagerProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormMode | null>(null);
  const [statusItem, setStatusItem] = useState<EquipmentRow | null>(null);
  const [message, setMessage] = useState<Message>(null);

  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | EquipmentStatus>(
    'all',
  );

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (filterType === 'all' || i.equipment_type_id === filterType) &&
          (filterStatus === 'all' || i.status === filterStatus),
      ),
    [items, filterType, filterStatus],
  );

  function handleSuccess(text: string): void {
    setFormState(null);
    setStatusItem(null);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            🔧
          </span>
          ניהול {equipmentLabel}
        </h1>
      </header>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <PrimaryButton
          onClick={() => setFormState({ mode: 'add' })}
          testId="equipment-add-button"
        >
          + הוסף {equipmentLabel}
        </PrimaryButton>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className={`${INPUT_CLASS} md:w-56`}
          aria-label="סינון לפי סוג"
        >
          <option value="all">כל הסוגים</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(e.target.value as 'all' | EquipmentStatus)
          }
          className={`${INPUT_CLASS} md:w-40`}
          aria-label="סינון לפי סטטוס"
        >
          <option value="all">הכל</option>
          <option value="available">זמין</option>
          <option value="deployed">בשטח</option>
          <option value="maintenance">תחזוקה</option>
        </select>
      </div>

      {message && (
        <div
          role={message.kind === 'error' ? 'alert' : 'status'}
          data-testid={message.kind === 'success' ? 'toast-success' : 'toast-error'}
          className={`p-3 rounded-lg text-sm text-center border ${
            message.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {items.length === 0 ? (
        <div
          data-testid="equipment-empty"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center"
        >
          <p className="text-gray-600">
            אין {equipmentLabel} עדיין. הוסף את ה{equipmentLabel} הראשון שלך.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            אין פריטים התואמים לסינון שנבחר
          </p>
        </div>
      ) : (
        <>
          <div
            data-testid="equipment-list"
            className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">שם</th>
                  <th className="px-4 py-3 font-medium text-gray-700">סוג</th>
                  <th className="px-4 py-3 font-medium text-gray-700">מזהה</th>
                  <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                  <th className="px-4 py-3 font-medium text-gray-700">ביטוח</th>
                  <th className="px-4 py-3 font-medium text-gray-700">רישיון</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    data-testid="equipment-row"
                    data-equipment-id={item.id}
                  >
                    <td
                      data-testid="equipment-row-name"
                      className="px-4 py-3 text-gray-900 font-medium"
                    >
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {item.type_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700" dir="ltr">
                      {item.identifier ?? '—'}
                    </td>
                    <td
                      data-testid="equipment-row-status"
                      className="px-4 py-3"
                    >
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <DateCell date={item.insurance_expiry} />
                    </td>
                    <td className="px-4 py-3">
                      <DateCell date={item.license_expiry} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <GhostButton
                          onClick={() => setFormState({ mode: 'edit', item })}
                          testId="equipment-row-edit"
                        >
                          עריכה
                        </GhostButton>
                        <GhostButton
                          onClick={() => setStatusItem(item)}
                          testId="equipment-row-status-change"
                        >
                          שינוי סטטוס
                        </GhostButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div data-testid="equipment-list" className="md:hidden space-y-3">
            {filtered.map((item) => (
              <EquipmentCard
                key={item.id}
                item={item}
                onEdit={() => setFormState({ mode: 'edit', item })}
                onStatus={() => setStatusItem(item)}
              />
            ))}
          </div>
        </>
      )}

      {formState && (
        <EquipmentFormModal
          key={formState.mode === 'edit' ? formState.item.id : 'add'}
          tenantId={tenantId}
          equipmentLabel={equipmentLabel}
          state={formState}
          types={types}
          onClose={() => setFormState(null)}
          onSuccess={handleSuccess}
        />
      )}

      {statusItem && (
        <QuickStatusModal
          key={statusItem.id}
          tenantId={tenantId}
          item={statusItem}
          onClose={() => setStatusItem(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
