'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import {
  type AssignmentInput,
  type DailyLogPayload,
  addDailyLogAction,
  confirmLogAction,
  updateDailyLogAction,
} from './actions';

export interface DailyLogRow {
  id: string;
  log_date: string;
  client_id: string;
  equipment_id: string;
  vehicle_id: string | null;
  location: string | null;
  project_name: string | null;
  equipment_revenue: number;
  notes: string | null;
  status: 'draft' | 'confirmed' | 'invoiced';
  created_by: string;
  client_name: string;
  equipment_name: string;
  vehicle_name: string | null;
  worker_count: number;
  workers_revenue: number;
}

export interface AssignmentRow {
  daily_log_id: string;
  worker_id: string;
  daily_rate: number;
  revenue: number;
}

export interface ClientOption {
  id: string;
  name: string;
  equipment_daily_rate: number | null;
  worker_daily_rate: number | null;
}

export interface EquipmentOption {
  id: string;
  name: string;
  status: string;
  type_name: string | null;
}

export interface VehicleOption {
  id: string;
  name: string;
  license_plate: string;
}

export interface WorkerOption {
  id: string;
  full_name: string;
  daily_rate: number | null;
}

interface Defaults {
  equipmentRevenue: number;
  workerCost: number;
  workerRevenue: number;
}

interface DailyLogManagerProps {
  tenantId: string;
  userId: string;
  userRole: Role;
  equipmentLabel: string;
  defaults: Defaults;
  logs: DailyLogRow[];
  assignments: AssignmentRow[];
  clients: ClientOption[];
  equipment: EquipmentOption[];
  vehicles: VehicleOption[];
  workers: WorkerOption[];
}

type StatusCode = 'draft' | 'confirmed' | 'invoiced';
type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; log: DailyLogRow }
  | { kind: 'view'; log: DailyLogRow }
  | { kind: 'confirm'; log: DailyLogRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

const STATUS_CONFIG: Record<
  StatusCode,
  { label: string; badge: string }
> = {
  draft: { label: 'טיוטה', badge: 'bg-gray-200 text-gray-800' },
  confirmed: { label: 'מאושר', badge: 'bg-green-100 text-green-800' },
  invoiced: { label: 'חשבונית', badge: 'bg-blue-100 text-blue-800' },
};

function StatusBadge({ status }: { status: StatusCode }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${c.badge}`}
    >
      {c.label}
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

function Modal({
  onClose,
  children,
  size = 'lg',
}: {
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | '2xl' | '3xl';
}) {
  const widthClass =
    size === '3xl'
      ? 'max-w-3xl'
      : size === '2xl'
        ? 'max-w-2xl'
        : size === 'md'
          ? 'max-w-md'
          : 'max-w-lg';
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

interface AssignmentDraft {
  key: string;
  workerId: string;
  dailyRate: string;
  revenue: string;
}

interface LogFormInitial {
  id: string;
  logDate: string;
  clientId: string;
  equipmentId: string;
  vehicleId: string;
  location: string;
  projectName: string;
  equipmentRevenue: string;
  notes: string;
  assignments: AssignmentDraft[];
}

function numToInput(n: number | null | undefined): string {
  if (n == null || n === 0) return '';
  return String(n);
}

interface LogFormModalProps {
  tenantId: string;
  userId: string;
  mode: 'add' | 'edit';
  initial?: LogFormInitial;
  clients: ClientOption[];
  equipment: EquipmentOption[];
  vehicles: VehicleOption[];
  workers: WorkerOption[];
  equipmentLabel: string;
  defaults: Defaults;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `a-${keyCounter}`;
}

function LogFormModal({
  tenantId,
  userId,
  mode,
  initial,
  clients,
  equipment,
  vehicles,
  workers,
  equipmentLabel,
  defaults,
  onClose,
  onSuccess,
}: LogFormModalProps) {
  const [logDate, setLogDate] = useState(initial?.logDate ?? todayIso());
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [equipmentId, setEquipmentId] = useState(initial?.equipmentId ?? '');
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [projectName, setProjectName] = useState(initial?.projectName ?? '');
  const [equipmentRevenue, setEquipmentRevenue] = useState(
    initial?.equipmentRevenue ?? '',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [assignments, setAssignments] = useState<AssignmentDraft[]>(
    initial?.assignments ?? [],
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clientWorkerRevenue(id: string): number {
    const c = clients.find((x) => x.id === id);
    return c?.worker_daily_rate ?? defaults.workerRevenue;
  }

  function clientEquipmentRevenue(id: string): number {
    const c = clients.find((x) => x.id === id);
    return c?.equipment_daily_rate ?? defaults.equipmentRevenue;
  }

  function handleClientChange(newId: string): void {
    setClientId(newId);
    if (!newId) return;
    setEquipmentRevenue(numToInput(clientEquipmentRevenue(newId)));
    const revenue = clientWorkerRevenue(newId);
    setAssignments((prev) =>
      prev.map((a) => ({ ...a, revenue: numToInput(revenue) })),
    );
  }

  function handleAddAssignment(): void {
    setAssignments((prev) => [
      ...prev,
      { key: nextKey(), workerId: '', dailyRate: '', revenue: '' },
    ]);
  }

  function handleAssignmentWorker(key: string, workerId: string): void {
    const worker = workers.find((w) => w.id === workerId);
    const dailyRate = worker?.daily_rate ?? defaults.workerCost;
    const revenue = clientId ? clientWorkerRevenue(clientId) : defaults.workerRevenue;
    setAssignments((prev) =>
      prev.map((a) =>
        a.key === key
          ? {
              ...a,
              workerId,
              dailyRate: numToInput(dailyRate),
              revenue: numToInput(revenue),
            }
          : a,
      ),
    );
  }

  function handleAssignmentField(
    key: string,
    field: 'dailyRate' | 'revenue',
    value: string,
  ): void {
    setAssignments((prev) =>
      prev.map((a) => (a.key === key ? { ...a, [field]: value } : a)),
    );
  }

  function handleRemoveAssignment(key: string): void {
    setAssignments((prev) => prev.filter((a) => a.key !== key));
  }

  function availableWorkers(currentId: string): WorkerOption[] {
    const used = new Set(
      assignments.map((a) => a.workerId).filter((id) => id && id !== currentId),
    );
    return workers.filter((w) => !used.has(w.id));
  }

  const equipmentRev = toNum(equipmentRevenue);
  const workersRev = assignments.reduce((s, a) => s + toNum(a.revenue), 0);
  const totalRev = equipmentRev + workersRev;
  const workersCost = assignments.reduce((s, a) => s + toNum(a.dailyRate), 0);
  const profit = totalRev - workersCost;
  const profitPositive = profit >= 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!logDate) {
      setError('תאריך חובה');
      return;
    }
    if (!clientId) {
      setError('לקוח חובה');
      return;
    }
    if (!equipmentId) {
      setError(`${equipmentLabel} חובה`);
      return;
    }

    const cleanAssignments: AssignmentInput[] = assignments
      .filter((a) => a.workerId)
      .map((a) => ({
        workerId: a.workerId,
        dailyRate: a.dailyRate,
        revenue: a.revenue,
      }));

    const payload: DailyLogPayload = {
      logDate,
      clientId,
      equipmentId,
      vehicleId,
      location,
      projectName,
      equipmentRevenue,
      notes,
      assignments: cleanAssignments,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res =
        mode === 'edit' && initial
          ? await updateDailyLogAction(tenantId, initial.id, payload)
          : await addDailyLogAction(tenantId, userId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(mode === 'edit' ? 'הרישום עודכן בהצלחה' : 'הרישום נוסף בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="3xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {mode === 'edit' ? 'עריכת רישום' : 'רישום יום עבודה'}
      </h3>
      <form
        onSubmit={handleSubmit}
        data-testid="daily-log-form"
        className="space-y-5"
      >
        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">פרטי העבודה</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                תאריך <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                data-testid="daily-log-form-log-date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                required
                dir="ltr"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                לקוח <span className="text-red-500">*</span>
              </label>
              <select
                data-testid="daily-log-form-client-id"
                value={clientId}
                onChange={(e) => handleClientChange(e.target.value)}
                required
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {equipmentLabel} <span className="text-red-500">*</span>
              </label>
              <select
                data-testid="daily-log-form-equipment-id"
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
                required
                className={INPUT_CLASS}
              >
                <option value="">בחר {equipmentLabel}</option>
                {equipment.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.type_name ? ` (${e.type_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                רכב
              </label>
              <select
                data-testid="daily-log-form-vehicle-id"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                מיקום
              </label>
              <input
                type="text"
                data-testid="daily-log-form-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                שם פרויקט
              </label>
              <input
                type="text"
                data-testid="daily-log-form-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </section>

        <section className="bg-[#ecfdf5] border border-green-200 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-green-800 mb-2">
            הכנסה מ{equipmentLabel}
          </h4>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מחיר יומי
            </label>
            <input
              type="number"
              data-testid="daily-log-form-equipment-revenue"
              value={equipmentRevenue}
              onChange={(e) => setEquipmentRevenue(e.target.value)}
              min="0"
              step="0.01"
              placeholder="0"
              dir="ltr"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-gray-500">
              ₪ ליום — מתעדכן אוטומטית לפי הלקוח
            </p>
          </div>
        </section>

        <section
          data-testid="daily-log-form-workers"
          className="border border-gray-200 rounded-lg p-3"
        >
          <header className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-800">
              עובדים ביום זה
            </h4>
            <button
              type="button"
              data-testid="daily-log-form-worker-add"
              onClick={handleAddAssignment}
              disabled={workers.length === 0}
              className="text-sm font-medium text-[#d97706] hover:text-[#b45309] disabled:opacity-50"
            >
              + הוסף עובד
            </button>
          </header>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-3">
              אין עובדים — לחץ על {'"הוסף עובד"'}
            </p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((a, idx) => (
                <li
                  key={a.key}
                  data-testid="daily-log-form-worker-row"
                  data-worker-index={idx}
                  className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 items-end p-2 rounded-md bg-gray-50"
                >
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      עובד
                    </label>
                    <select
                      data-testid="daily-log-form-worker-select"
                      value={a.workerId}
                      onChange={(e) =>
                        handleAssignmentWorker(a.key, e.target.value)
                      }
                      className={INPUT_CLASS}
                    >
                      <option value="">בחר עובד</option>
                      {availableWorkers(a.workerId).map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:w-28">
                    <label className="block text-xs text-gray-600 mb-1">
                      שכר (עלות)
                    </label>
                    <input
                      type="number"
                      data-testid="daily-log-form-worker-rate"
                      value={a.dailyRate}
                      onChange={(e) =>
                        handleAssignmentField(a.key, 'dailyRate', e.target.value)
                      }
                      min="0"
                      step="0.01"
                      dir="ltr"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="md:w-28">
                    <label className="block text-xs text-gray-600 mb-1">
                      הכנסה
                    </label>
                    <input
                      type="number"
                      data-testid="daily-log-form-worker-revenue"
                      value={a.revenue}
                      onChange={(e) =>
                        handleAssignmentField(a.key, 'revenue', e.target.value)
                      }
                      min="0"
                      step="0.01"
                      dir="ltr"
                      className={INPUT_CLASS}
                    />
                  </div>
                  <button
                    type="button"
                    data-testid="daily-log-form-worker-remove"
                    onClick={() => handleRemoveAssignment(a.key)}
                    aria-label="הסר עובד"
                    className="h-10 w-10 rounded-md text-red-600 hover:bg-red-50 flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-amber-900 mb-2">סיכום</h4>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-700">הכנסה מ{equipmentLabel}:</dt>
              <dd className="font-medium text-gray-900" dir="ltr">
                {formatILS(equipmentRev)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-700">הכנסה מעובדים:</dt>
              <dd className="font-medium text-gray-900" dir="ltr">
                {formatILS(workersRev)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
              <dt className="text-gray-700 font-semibold">סה״כ הכנסה:</dt>
              <dd className="font-bold text-gray-900" dir="ltr">
                {formatILS(totalRev)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-700">עלות עובדים:</dt>
              <dd className="font-medium text-gray-900" dir="ltr">
                {formatILS(workersCost)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
              <dt className="text-gray-800 font-semibold">רווח משוער:</dt>
              <dd
                className={`font-bold ${
                  profitPositive ? 'text-green-700' : 'text-red-700'
                }`}
                dir="ltr"
              >
                {formatILS(profit)}
              </dd>
            </div>
          </dl>
        </section>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            הערות
          </label>
          <textarea
            data-testid="daily-log-form-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </div>

        {error && (
          <div
            role="alert"
            data-testid="daily-log-form-error"
            className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <GhostButton
            onClick={onClose}
            disabled={submitting}
            testId="daily-log-form-cancel"
          >
            ביטול
          </GhostButton>
          <PrimaryButton
            type="submit"
            disabled={submitting}
            testId="daily-log-form-submit"
          >
            {submitting ? 'שומר...' : 'שמור'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

interface ConfirmModalProps {
  tenantId: string;
  log: DailyLogRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function ConfirmModal({
  tenantId,
  log,
  onClose,
  onSuccess,
}: ConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await confirmLogAction(tenantId, log.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('הרישום אושר');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <div data-testid="daily-log-confirm-modal">
        <h3 className="text-lg font-bold text-gray-900">אישור רישום</h3>
        <p className="mt-2 text-sm text-gray-600">
          האם לאשר את הרישום? לאחר אישור לא ניתן לערוך.
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
            testId="daily-log-confirm-cancel"
          >
            ביטול
          </GhostButton>
          <button
            type="button"
            data-testid="daily-log-confirm-submit"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors disabled:opacity-60"
          >
            {submitting ? '...' : 'אשר'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ViewModalProps {
  log: DailyLogRow;
  assignments: AssignmentRow[];
  workers: WorkerOption[];
  equipmentLabel: string;
  onClose: () => void;
}

function ViewModal({
  log,
  assignments,
  workers,
  equipmentLabel,
  onClose,
}: ViewModalProps) {
  const workerById = new Map(workers.map((w) => [w.id, w]));
  const workersRev = assignments.reduce((s, a) => s + a.revenue, 0);
  const totalRev = log.equipment_revenue + workersRev;
  const workersCost = assignments.reduce((s, a) => s + a.daily_rate, 0);

  return (
    <Modal onClose={onClose} size="2xl">
      <header className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-gray-900">פרטי רישום</h3>
        <StatusBadge status={log.status} />
      </header>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-gray-600">תאריך</dt>
          <dd className="font-medium" dir="ltr">
            {formatDateIL(log.log_date)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-600">לקוח</dt>
          <dd className="font-medium">{log.client_name}</dd>
        </div>
        <div>
          <dt className="text-gray-600">{equipmentLabel}</dt>
          <dd className="font-medium">{log.equipment_name}</dd>
        </div>
        <div>
          <dt className="text-gray-600">רכב</dt>
          <dd className="font-medium">{log.vehicle_name ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-600">מיקום</dt>
          <dd className="font-medium">{log.location ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-gray-600">פרויקט</dt>
          <dd className="font-medium">{log.project_name ?? '—'}</dd>
        </div>
      </dl>

      <section className="mt-4">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">עובדים</h4>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500">אין עובדים</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {assignments.map((a, i) => (
              <li
                key={`${a.worker_id}-${i}`}
                className="py-2 flex justify-between"
              >
                <span>{workerById.get(a.worker_id)?.full_name ?? '—'}</span>
                <span dir="ltr" className="text-gray-600">
                  {formatILS(a.daily_rate)} / {formatILS(a.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-700">הכנסה מ{equipmentLabel}:</dt>
            <dd dir="ltr">{formatILS(log.equipment_revenue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-700">הכנסה מעובדים:</dt>
            <dd dir="ltr">{formatILS(workersRev)}</dd>
          </div>
          <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
            <dt className="text-gray-800 font-semibold">סה״כ הכנסה:</dt>
            <dd dir="ltr" className="font-bold">
              {formatILS(totalRev)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-700">עלות עובדים:</dt>
            <dd dir="ltr">{formatILS(workersCost)}</dd>
          </div>
        </dl>
      </section>

      {log.notes && (
        <section className="mt-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-1">הערות</h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {log.notes}
          </p>
        </section>
      )}

      <div className="mt-5 flex justify-end">
        <GhostButton onClick={onClose}>סגור</GhostButton>
      </div>
    </Modal>
  );
}

function LogCard({
  log,
  canEdit,
  canWrite,
  onView,
  onEdit,
  onConfirm,
}: {
  log: DailyLogRow;
  canEdit: boolean;
  canWrite: boolean;
  onView: () => void;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  const totalRev = log.equipment_revenue + log.workers_revenue;
  const isDraft = log.status === 'draft';
  return (
    <div
      data-testid="daily-log-row"
      data-log-id={log.id}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            data-testid="daily-log-row-date"
            className="font-bold text-gray-900"
            dir="ltr"
          >
            {formatDateIL(log.log_date)}
          </p>
          <p
            data-testid="daily-log-row-client"
            className="text-sm text-gray-600 truncate"
          >
            {log.client_name}
          </p>
        </div>
        <div data-testid="daily-log-row-status">
          <StatusBadge status={log.status} />
        </div>
      </header>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">ציוד:</dt>
          <dd data-testid="daily-log-row-equipment" className="truncate">
            {log.equipment_name}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">עובדים:</dt>
          <dd>{log.worker_count}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">הכנסה:</dt>
          <dd dir="ltr" className="font-medium">
            {formatILS(totalRev)}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex items-center justify-end gap-1">
        <GhostButton onClick={onView} testId="daily-log-row-view">
          צפייה
        </GhostButton>
        {isDraft && canEdit && (
          <GhostButton onClick={onEdit} testId="daily-log-row-edit">
            עריכה
          </GhostButton>
        )}
        {isDraft && canWrite && (
          <button
            type="button"
            data-testid="daily-log-row-confirm"
            onClick={onConfirm}
            className="px-3 py-2 rounded-md text-sm text-green-700 hover:bg-green-50"
          >
            אישור
          </button>
        )}
      </div>
    </div>
  );
}

export function DailyLogManager({
  tenantId,
  userId,
  userRole,
  equipmentLabel,
  defaults,
  logs,
  assignments,
  clients,
  equipment,
  vehicles,
  workers,
}: DailyLogManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | StatusCode>('all');

  const canWrite = hasPermission(userRole, 'daily_log.write');

  const assignmentsByLog = useMemo(() => {
    const map = new Map<string, AssignmentRow[]>();
    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      const list = map.get(a.daily_log_id) ?? [];
      list.push(a);
      map.set(a.daily_log_id, list);
    }
    return map;
  }, [assignments]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (fromDate && log.log_date < fromDate) return false;
      if (toDate && log.log_date > toDate) return false;
      if (filterClient !== 'all' && log.client_id !== filterClient) return false;
      if (filterStatus !== 'all' && log.status !== filterStatus) return false;
      return true;
    });
  }, [logs, fromDate, toDate, filterClient, filterStatus]);

  function canEditLog(log: DailyLogRow): boolean {
    if (!canWrite) return false;
    if (log.status !== 'draft') return false;
    if (userRole === 'operator' && log.created_by !== userId) return false;
    return true;
  }

  function handleSuccess(text: string): void {
    setModal(null);
    setMessage({ kind: 'success', text });
    router.refresh();
    setTimeout(() => setMessage(null), 3000);
  }

  function buildEditInitial(log: DailyLogRow): LogFormInitial {
    const rows = assignmentsByLog.get(log.id) ?? [];
    return {
      id: log.id,
      logDate: log.log_date.slice(0, 10),
      clientId: log.client_id,
      equipmentId: log.equipment_id,
      vehicleId: log.vehicle_id ?? '',
      location: log.location ?? '',
      projectName: log.project_name ?? '',
      equipmentRevenue: numToInput(log.equipment_revenue),
      notes: log.notes ?? '',
      assignments: rows.map((r) => ({
        key: nextKey(),
        workerId: r.worker_id,
        dailyRate: numToInput(r.daily_rate),
        revenue: numToInput(r.revenue),
      })),
    };
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            📋
          </span>
          יומן עבודה
        </h1>
      </header>

      <div className="flex flex-col md:flex-row gap-2 md:items-end flex-wrap">
        {canWrite && (
          <PrimaryButton
            onClick={() => setModal({ kind: 'add' })}
            testId="daily-log-add-button"
          >
            + רישום יום עבודה
          </PrimaryButton>
        )}
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
        <div>
          <label className="block text-xs text-gray-600 mb-1">סטטוס</label>
          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as 'all' | StatusCode)
            }
            className={`${INPUT_CLASS} md:w-36`}
          >
            <option value="all">הכל</option>
            <option value="draft">טיוטה</option>
            <option value="confirmed">מאושר</option>
            <option value="invoiced">חשבונית</option>
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

      {logs.length === 0 ? (
        <div
          data-testid="daily-log-empty"
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center"
        >
          <p className="text-gray-600">
            אין רישומים עדיין. התחל לרשום ימי עבודה.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            אין רישומים התואמים לסינון שנבחר
          </p>
        </div>
      ) : (
        <>
          <div
            data-testid="daily-log-list"
            className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">תאריך</th>
                  <th className="px-4 py-3 font-medium text-gray-700">לקוח</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    {equipmentLabel}
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">רכב</th>
                  <th className="px-4 py-3 font-medium text-gray-700">עובדים</th>
                  <th className="px-4 py-3 font-medium text-gray-700">הכנסה</th>
                  <th className="px-4 py-3 font-medium text-gray-700">סטטוס</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => {
                  const totalRev = log.equipment_revenue + log.workers_revenue;
                  const isDraft = log.status === 'draft';
                  const editable = canEditLog(log);
                  return (
                    <tr
                      key={log.id}
                      data-testid="daily-log-row"
                      data-log-id={log.id}
                    >
                      <td
                        data-testid="daily-log-row-date"
                        className="px-4 py-3"
                        dir="ltr"
                      >
                        {formatDateIL(log.log_date)}
                      </td>
                      <td
                        data-testid="daily-log-row-client"
                        className="px-4 py-3"
                      >
                        {log.client_name}
                      </td>
                      <td
                        data-testid="daily-log-row-equipment"
                        className="px-4 py-3"
                      >
                        {log.equipment_name}
                      </td>
                      <td className="px-4 py-3">{log.vehicle_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-gray-100 text-gray-800 text-xs font-medium">
                          {log.worker_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900" dir="ltr">
                        {formatILS(totalRev)}
                      </td>
                      <td data-testid="daily-log-row-status" className="px-4 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <GhostButton
                            onClick={() => setModal({ kind: 'view', log })}
                            testId="daily-log-row-view"
                          >
                            צפייה
                          </GhostButton>
                          {editable && (
                            <GhostButton
                              onClick={() => setModal({ kind: 'edit', log })}
                              testId="daily-log-row-edit"
                            >
                              עריכה
                            </GhostButton>
                          )}
                          {isDraft && canWrite && (
                            <button
                              type="button"
                              data-testid="daily-log-row-confirm"
                              onClick={() =>
                                setModal({ kind: 'confirm', log })
                              }
                              className="px-3 py-2 rounded-md text-sm text-green-700 hover:bg-green-50"
                            >
                              אישור
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

          <div data-testid="daily-log-list" className="md:hidden space-y-3">
            {filteredLogs.map((log) => (
              <LogCard
                key={log.id}
                log={log}
                canEdit={canEditLog(log)}
                canWrite={canWrite}
                onView={() => setModal({ kind: 'view', log })}
                onEdit={() => setModal({ kind: 'edit', log })}
                onConfirm={() => setModal({ kind: 'confirm', log })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.kind === 'add' && (
        <LogFormModal
          tenantId={tenantId}
          userId={userId}
          mode="add"
          clients={clients}
          equipment={equipment}
          vehicles={vehicles}
          workers={workers}
          equipmentLabel={equipmentLabel}
          defaults={defaults}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <LogFormModal
          key={modal.log.id}
          tenantId={tenantId}
          userId={userId}
          mode="edit"
          initial={buildEditInitial(modal.log)}
          clients={clients}
          equipment={equipment}
          vehicles={vehicles}
          workers={workers}
          equipmentLabel={equipmentLabel}
          defaults={defaults}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'view' && (
        <ViewModal
          log={modal.log}
          assignments={assignmentsByLog.get(modal.log.id) ?? []}
          workers={workers}
          equipmentLabel={equipmentLabel}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'confirm' && (
        <ConfirmModal
          tenantId={tenantId}
          log={modal.log}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
