'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type VehiclePayload,
  type VehicleType,
  addVehicleAction,
  toggleVehicleAction,
  updateVehicleAction,
} from './actions';

export interface VehicleRow {
  id: string;
  name: string;
  license_plate: string;
  type: VehicleType;
  insurance_expiry: string | null;
  license_expiry: string | null;
  annual_insurance_cost: number | null;
  annual_license_cost: number | null;
  notes: string | null;
  is_active: number;
}

interface VehiclesManagerProps {
  tenantId: string;
  vehicles: VehicleRow[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type FormMode = { mode: 'add' } | { mode: 'edit'; vehicle: VehicleRow };

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const TYPE_CONFIG: Record<VehicleType, { label: string; badge: string }> = {
  owned: { label: 'בבעלות', badge: 'bg-blue-100 text-blue-800' },
  rented: { label: 'שכור', badge: 'bg-purple-100 text-purple-800' },
};

function TypeBadge({ type }: { type: VehicleType }) {
  const c = TYPE_CONFIG[type];
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

function formatCost(v: number | null): string {
  if (v == null || v === 0) return '—';
  return `₪${v.toLocaleString('he-IL')}`;
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

function toDateInputValue(v: string | null): string {
  return v ? v.slice(0, 10) : '';
}

function costToInputValue(v: number | null): string {
  return v == null || v === 0 ? '' : String(v);
}

interface VehicleFormModalProps {
  tenantId: string;
  state: FormMode;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function VehicleFormModal({
  tenantId,
  state,
  onClose,
  onSuccess,
}: VehicleFormModalProps) {
  const editing = state.mode === 'edit';
  const initial = editing ? state.vehicle : null;

  const [name, setName] = useState(initial?.name ?? '');
  const [licensePlate, setLicensePlate] = useState(
    initial?.license_plate ?? '',
  );
  const [type, setType] = useState<VehicleType>(initial?.type ?? 'owned');
  const [annualInsuranceCost, setAnnualInsuranceCost] = useState(
    costToInputValue(initial?.annual_insurance_cost ?? null),
  );
  const [annualLicenseCost, setAnnualLicenseCost] = useState(
    costToInputValue(initial?.annual_license_cost ?? null),
  );
  const [insuranceExpiry, setInsuranceExpiry] = useState(
    toDateInputValue(initial?.insurance_expiry ?? null),
  );
  const [licenseExpiry, setLicenseExpiry] = useState(
    toDateInputValue(initial?.license_expiry ?? null),
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    const cleanName = name.trim();
    const cleanPlate = licensePlate.trim();
    if (!cleanName) {
      setError('שם הרכב חובה');
      return;
    }
    if (!cleanPlate) {
      setError('לוחית רישוי חובה');
      return;
    }

    const payload: VehiclePayload = {
      name: cleanName,
      licensePlate: cleanPlate,
      type,
      annualInsuranceCost,
      annualLicenseCost,
      insuranceExpiry,
      licenseExpiry,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateVehicleAction(tenantId, state.vehicle.id, payload)
        : await addVehicleAction(tenantId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'הפרטים עודכנו בהצלחה' : 'הרכב נוסף בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת רכב' : 'הוספת רכב'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם הרכב <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              לוחית רישוי <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value)}
              required
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-2">
            סוג
          </legend>
          <div className="flex gap-2">
            {(['owned', 'rented'] as const).map((t) => {
              const active = type === t;
              return (
                <label
                  key={t}
                  className={`flex-1 px-4 py-2.5 rounded-md border text-center cursor-pointer text-sm font-medium transition-colors ${
                    active
                      ? 'bg-amber-50 border-[#f59e0b] text-[#92400e]'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={active}
                    onChange={() => setType(t)}
                    className="sr-only"
                  />
                  {TYPE_CONFIG[t].label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              עלות ביטוח שנתית
            </label>
            <input
              type="number"
              dir="ltr"
              min="0"
              step="0.01"
              placeholder="0"
              value={annualInsuranceCost}
              onChange={(e) => setAnnualInsuranceCost(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              עלות רישיון שנתית
            </label>
            <input
              type="number"
              dir="ltr"
              min="0"
              step="0.01"
              placeholder="0"
              value={annualLicenseCost}
              onChange={(e) => setAnnualLicenseCost(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך ביטוח
            </label>
            <input
              type="date"
              value={insuranceExpiry}
              onChange={(e) => setInsuranceExpiry(e.target.value)}
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך רישיון
            </label>
            <input
              type="date"
              value={licenseExpiry}
              onChange={(e) => setLicenseExpiry(e.target.value)}
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
  vehicle: VehicleRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ToggleModal({
  tenantId,
  vehicle,
  onClose,
  onSuccess,
}: ToggleModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activating = vehicle.is_active !== 1;

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await toggleVehicleAction(tenantId, vehicle.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(activating ? 'הרכב הופעל בהצלחה' : 'הרכב הושבת בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <h3 className="text-lg font-bold text-gray-900">
        {activating ? 'הפעלת רכב' : 'השבתת רכב'}
      </h3>
      <p className="mt-2 text-sm text-gray-600">
        {activating
          ? `האם להפעיל מחדש את ${vehicle.name}?`
          : `האם להשבית את ${vehicle.name}? לא ניתן יהיה לצרף אותו לרישומים חדשים.`}
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

function VehicleCard({
  vehicle,
  onEdit,
  onToggle,
}: {
  vehicle: VehicleRow;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const active = vehicle.is_active === 1;
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 ${
        active ? '' : 'opacity-60'
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 truncate">
            {vehicle.name}
            {!active && (
              <span className="ms-2 text-xs text-gray-500">(מושבת)</span>
            )}
          </h3>
          <p className="text-sm text-gray-600" dir="ltr">
            {vehicle.license_plate}
          </p>
        </div>
        <TypeBadge type={vehicle.type} />
      </header>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">ביטוח שנתי:</dt>
          <dd className="text-gray-900" dir="ltr">
            {formatCost(vehicle.annual_insurance_cost)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">רישיון שנתי:</dt>
          <dd className="text-gray-900" dir="ltr">
            {formatCost(vehicle.annual_license_cost)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">ביטוח:</dt>
          <dd>
            <DateCell date={vehicle.insurance_expiry} />
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-600">רישיון:</dt>
          <dd>
            <DateCell date={vehicle.license_expiry} />
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

export function VehiclesManager({ tenantId, vehicles }: VehiclesManagerProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormMode | null>(null);
  const [toggleVehicle, setToggleVehicle] = useState<VehicleRow | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const [filterType, setFilterType] = useState<'all' | VehicleType>('all');

  const filtered = useMemo(
    () =>
      vehicles.filter((v) => filterType === 'all' || v.type === filterType),
    [vehicles, filterType],
  );

  function handleSuccess(text: string): void {
    setFormState(null);
    setToggleVehicle(null);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            🚗
          </span>
          ניהול רכבים
        </h1>
      </header>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <PrimaryButton onClick={() => setFormState({ mode: 'add' })}>
          + הוסף רכב
        </PrimaryButton>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | VehicleType)}
          className={`${INPUT_CLASS} md:w-40`}
          aria-label="סינון לפי סוג"
        >
          <option value="all">הכל</option>
          <option value="owned">בבעלות</option>
          <option value="rented">שכור</option>
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

      {vehicles.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-gray-600">
            אין רכבים עדיין. הוסף את הרכב הראשון שלך.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">אין רכבים התואמים לסינון</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">שם</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    לוחית רישוי
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סוג</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    ביטוח שנתי
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    רישיון שנתי
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    תאריך ביטוח
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    תאריך רישיון
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((vehicle) => {
                  const active = vehicle.is_active === 1;
                  return (
                    <tr key={vehicle.id} className={active ? '' : 'opacity-60'}>
                      <td className="px-4 py-3 text-gray-900 font-medium">
                        {vehicle.name}
                        {!active && (
                          <span className="ms-2 text-xs text-gray-500">
                            (מושבת)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700" dir="ltr">
                        {vehicle.license_plate}
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={vehicle.type} />
                      </td>
                      <td className="px-4 py-3 text-gray-900" dir="ltr">
                        {formatCost(vehicle.annual_insurance_cost)}
                      </td>
                      <td className="px-4 py-3 text-gray-900" dir="ltr">
                        {formatCost(vehicle.annual_license_cost)}
                      </td>
                      <td className="px-4 py-3">
                        <DateCell date={vehicle.insurance_expiry} />
                      </td>
                      <td className="px-4 py-3">
                        <DateCell date={vehicle.license_expiry} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <GhostButton
                            onClick={() =>
                              setFormState({ mode: 'edit', vehicle })
                            }
                          >
                            עריכה
                          </GhostButton>
                          <button
                            type="button"
                            onClick={() => setToggleVehicle(vehicle)}
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
            {filtered.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onEdit={() => setFormState({ mode: 'edit', vehicle })}
                onToggle={() => setToggleVehicle(vehicle)}
              />
            ))}
          </div>
        </>
      )}

      {formState && (
        <VehicleFormModal
          key={formState.mode === 'edit' ? formState.vehicle.id : 'add'}
          tenantId={tenantId}
          state={formState}
          onClose={() => setFormState(null)}
          onSuccess={handleSuccess}
        />
      )}

      {toggleVehicle && (
        <ToggleModal
          key={toggleVehicle.id}
          tenantId={tenantId}
          vehicle={toggleVehicle}
          onClose={() => setToggleVehicle(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
