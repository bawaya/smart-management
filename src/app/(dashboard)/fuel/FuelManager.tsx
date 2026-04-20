'use client';

import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
} from 'react';
import {
  type FuelPayload,
  addFuelAction,
  deleteFuelAction,
  updateFuelAction,
} from './actions';

export interface FuelRecordRow {
  id: string;
  record_date: string;
  vehicle_id: string;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  odometer_reading: number | null;
  station_name: string | null;
  receipt_ref: string | null;
  notes: string | null;
  created_by: string;
  vehicle_name: string;
  license_plate: string;
}

export interface VehicleOption {
  id: string;
  name: string;
  license_plate: string;
}

interface FuelManagerProps {
  tenantId: string;
  userId: string;
  defaultFuelPrice: number;
  records: FuelRecordRow[];
  vehicles: VehicleOption[];
}

type Message = { kind: 'success' | 'error'; text: string } | null;
type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; record: FuelRecordRow }
  | { kind: 'delete'; record: FuelRecordRow }
  | null;

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:border-transparent';

function toNum(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

function formatLiters(n: number): string {
  return `${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })} ליטר`;
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

function numToInput(n: number | null | undefined): string {
  if (n == null || n === 0) return '';
  return String(n);
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
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5" dir="ltr">
        {value}
      </p>
    </div>
  );
}

interface FuelFormModalProps {
  tenantId: string;
  userId: string;
  defaultFuelPrice: number;
  vehicles: VehicleOption[];
  mode: 'add' | 'edit';
  record?: FuelRecordRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function FuelFormModal({
  tenantId,
  userId,
  defaultFuelPrice,
  vehicles,
  mode,
  record,
  onClose,
  onSuccess,
}: FuelFormModalProps) {
  const editing = mode === 'edit';

  const [recordDate, setRecordDate] = useState(
    record?.record_date.slice(0, 10) ?? todayIso(),
  );
  const [vehicleId, setVehicleId] = useState(record?.vehicle_id ?? '');
  const [liters, setLiters] = useState(numToInput(record?.liters ?? null));
  const [pricePerLiter, setPricePerLiter] = useState(
    record ? numToInput(record.price_per_liter) : numToInput(defaultFuelPrice),
  );
  const [odometerReading, setOdometerReading] = useState(
    numToInput(record?.odometer_reading ?? null),
  );
  const [stationName, setStationName] = useState(record?.station_name ?? '');
  const [receiptRef, setReceiptRef] = useState(record?.receipt_ref ?? '');
  const [notes, setNotes] = useState(record?.notes ?? '');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const totalCost = toNum(liters) * toNum(pricePerLiter);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!recordDate) {
      setError('תאריך חובה');
      return;
    }
    if (!vehicleId) {
      setError('רכב חובה');
      return;
    }
    const litersNum = toNum(liters);
    if (litersNum <= 0) {
      setError('יש להזין ליטרים גדול מ-0');
      return;
    }

    const payload: FuelPayload = {
      recordDate,
      vehicleId,
      liters,
      pricePerLiter,
      odometerReading,
      stationName,
      receiptRef,
      notes,
    };

    setError(null);
    setSubmitting(true);
    try {
      const res = editing
        ? await updateFuelAction(tenantId, record!.id, payload)
        : await addFuelAction(tenantId, userId, payload);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess(editing ? 'הרישום עודכן בהצלחה' : 'התדלוק נרשם בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="2xl">
      <h3 className="text-lg font-bold text-gray-900 mb-4">
        {editing ? 'עריכת תדלוק' : 'רישום תדלוק'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              תאריך <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              required
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              רכב <span className="text-red-500">*</span>
            </label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
              className={INPUT_CLASS}
            >
              <option value="">בחר רכב</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.license_plate})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ליטרים <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              required
              min="0"
              step="0.01"
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מחיר לליטר
            </label>
            <input
              type="number"
              value={pricePerLiter}
              onChange={(e) => setPricePerLiter(e.target.value)}
              min="0"
              step="0.01"
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סה״כ
            </label>
            <input
              type="text"
              value={formatILS(totalCost)}
              readOnly
              dir="ltr"
              className={`${INPUT_CLASS} bg-gray-100 font-bold`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              קריאת מד אוץ (ק״מ)
            </label>
            <input
              type="number"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              min="0"
              step="1"
              dir="ltr"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם תחנה
            </label>
            <input
              type="text"
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              אסמכתא
            </label>
            <input
              type="text"
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
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

interface DeleteModalProps {
  tenantId: string;
  record: FuelRecordRow;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

function DeleteModal({
  tenantId,
  record,
  onClose,
  onSuccess,
}: DeleteModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(): Promise<void> {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await deleteFuelAction(tenantId, record.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onSuccess('הרישום נמחק בהצלחה');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} size="md">
      <h3 className="text-lg font-bold text-gray-900">מחיקת רישום</h3>
      <p className="mt-2 text-sm text-gray-600">
        האם למחוק את רישום התדלוק של {record.vehicle_name} מתאריך{' '}
        <span dir="ltr">{formatDateIL(record.record_date)}</span>? פעולה זו
        אינה ניתנת לביטול.
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

function FuelCard({
  record,
  onEdit,
  onDelete,
}: {
  record: FuelRecordRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-gray-900" dir="ltr">
            {formatDateIL(record.record_date)}
          </p>
          <p className="text-sm text-gray-600 truncate">
            {record.vehicle_name}
            {' '}
            <span className="text-gray-400" dir="ltr">
              ({record.license_plate})
            </span>
          </p>
        </div>
        <span className="font-bold text-gray-900" dir="ltr">
          {formatILS(record.total_cost)}
        </span>
      </header>
      <dl className="mt-2 space-y-0.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-600">ליטרים:</dt>
          <dd dir="ltr">{formatLiters(record.liters)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-600">מחיר/ליטר:</dt>
          <dd dir="ltr">{formatILS(record.price_per_liter)}</dd>
        </div>
        {record.odometer_reading != null && (
          <div className="flex justify-between">
            <dt className="text-gray-600">ק״מ:</dt>
            <dd dir="ltr">
              {record.odometer_reading.toLocaleString('he-IL')}
            </dd>
          </div>
        )}
        {record.station_name && (
          <div className="flex justify-between">
            <dt className="text-gray-600">תחנה:</dt>
            <dd className="truncate">{record.station_name}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3 flex items-center justify-end gap-1">
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

export function FuelManager({
  tenantId,
  userId,
  defaultFuelPrice,
  records,
  vehicles,
}: FuelManagerProps) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalState>(null);
  const [message, setMessage] = useState<Message>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [filterVehicle, setFilterVehicle] = useState<string>('all');

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (fromDate && r.record_date < fromDate) return false;
      if (toDate && r.record_date > toDate) return false;
      if (filterVehicle !== 'all' && r.vehicle_id !== filterVehicle)
        return false;
      return true;
    });
  }, [records, fromDate, toDate, filterVehicle]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    let totalCost = 0;
    let totalLiters = 0;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const d = new Date(r.record_date);
      if (
        !Number.isNaN(d.getTime()) &&
        d.getFullYear() === y &&
        d.getMonth() === m
      ) {
        totalCost += r.total_cost;
        totalLiters += r.liters;
      }
    }
    const dayOfMonth = now.getDate();
    const avgPerDay = dayOfMonth > 0 ? totalCost / dayOfMonth : 0;
    return { totalCost, totalLiters, avgPerDay };
  }, [records]);

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
            ⛽
          </span>
          רישום דלק
        </h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatBox label='סה״כ החודש' value={formatILS(monthlyStats.totalCost)} />
        <StatBox
          label="ליטרים החודש"
          value={formatLiters(monthlyStats.totalLiters)}
        />
        <StatBox
          label="ממוצע ליום"
          value={formatILS(monthlyStats.avgPerDay)}
        />
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-end flex-wrap">
        <PrimaryButton onClick={() => setModal({ kind: 'add' })}>
          + רישום תדלוק
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
          <label className="block text-xs text-gray-600 mb-1">רכב</label>
          <select
            value={filterVehicle}
            onChange={(e) => setFilterVehicle(e.target.value)}
            className={`${INPUT_CLASS} md:w-44`}
          >
            <option value="all">כל הרכבים</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
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

      {records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-gray-600">אין רישומי דלק עדיין.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500 text-sm">
            אין רישומים התואמים לסינון שנבחר
          </p>
        </div>
      ) : (
        <>
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">תאריך</th>
                  <th className="px-4 py-3 font-medium text-gray-700">רכב</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    ליטרים
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    מחיר/ליטר
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">סה״כ</th>
                  <th className="px-4 py-3 font-medium text-gray-700">ק״מ</th>
                  <th className="px-4 py-3 font-medium text-gray-700">תחנה</th>
                  <th className="px-4 py-3 font-medium text-gray-700">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3" dir="ltr">
                      {formatDateIL(r.record_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{r.vehicle_name}</div>
                      <div className="text-xs text-gray-500" dir="ltr">
                        {r.license_plate}
                      </div>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {r.liters.toLocaleString('he-IL', {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {formatILS(r.price_per_liter)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900" dir="ltr">
                      {formatILS(r.total_cost)}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {r.odometer_reading != null
                        ? r.odometer_reading.toLocaleString('he-IL')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">{r.station_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <GhostButton
                          onClick={() => setModal({ kind: 'edit', record: r })}
                        >
                          עריכה
                        </GhostButton>
                        <button
                          type="button"
                          onClick={() =>
                            setModal({ kind: 'delete', record: r })
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
            {filtered.map((r) => (
              <FuelCard
                key={r.id}
                record={r}
                onEdit={() => setModal({ kind: 'edit', record: r })}
                onDelete={() => setModal({ kind: 'delete', record: r })}
              />
            ))}
          </div>
        </>
      )}

      {modal?.kind === 'add' && (
        <FuelFormModal
          tenantId={tenantId}
          userId={userId}
          defaultFuelPrice={defaultFuelPrice}
          vehicles={vehicles}
          mode="add"
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <FuelFormModal
          key={modal.record.id}
          tenantId={tenantId}
          userId={userId}
          defaultFuelPrice={defaultFuelPrice}
          vehicles={vehicles}
          mode="edit"
          record={modal.record}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
      {modal?.kind === 'delete' && (
        <DeleteModal
          key={modal.record.id}
          tenantId={tenantId}
          record={modal.record}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
