'use client';

import Link from 'next/link';

export interface LogDetailRow {
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
  created_at: string;
  updated_at: string;
  client_name: string;
  equipment_name: string;
  vehicle_name: string | null;
  created_by_username: string | null;
  created_by_full_name: string | null;
}

export interface AssignmentDetail {
  id: string;
  worker_id: string;
  daily_rate: number;
  revenue: number;
  worker_name: string;
}

interface LogDetailsProps {
  log: LogDetailRow;
  assignments: AssignmentDetail[];
  equipmentLabel: string;
  canEdit: boolean;
}

const STATUS_CONFIG: Record<
  'draft' | 'confirmed' | 'invoiced',
  { label: string; badge: string }
> = {
  draft: { label: 'טיוטה', badge: 'bg-gray-200 text-gray-800' },
  confirmed: { label: 'מאושר', badge: 'bg-green-100 text-green-800' },
  invoiced: { label: 'חשבונית', badge: 'bg-blue-100 text-blue-800' },
};

function StatusBadge({
  status,
}: {
  status: 'draft' | 'confirmed' | 'invoiced';
}) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${c.badge}`}
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

function formatDateTimeIL(s: string | null): string {
  if (!s) return '—';
  const hasTz = /[Zz]|[+-]\d{2}:?\d{2}$/.test(s);
  const normalized = s.replace(' ', 'T') + (hasTz ? '' : 'Z');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {title && (
        <h2 className="text-base font-bold text-gray-900 mb-4">{title}</h2>
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div>
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd
        className="mt-1 text-gray-900 font-medium"
        dir={dir}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

export function LogDetails({
  log,
  assignments,
  equipmentLabel,
  canEdit,
}: LogDetailsProps) {
  const workersRev = assignments.reduce((s, a) => s + a.revenue, 0);
  const workersCost = assignments.reduce((s, a) => s + a.daily_rate, 0);
  const totalRev = log.equipment_revenue + workersRev;
  const profit = totalRev - workersCost;
  const profitPositive = profit >= 0;

  const createdByName =
    (log.created_by_full_name?.trim() || log.created_by_username || '—') ??
    '—';

  return (
    <div className="space-y-4 max-w-4xl">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900" dir="ltr">
            {formatDateIL(log.log_date)}
          </h1>
          <StatusBadge status={log.status} />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/daily-log"
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            חזרה ליומן
          </Link>
          {canEdit && (
            <Link
              href="/daily-log"
              className="px-4 py-2 rounded-md bg-[#f59e0b] text-black font-bold text-sm hover:bg-[#d97706] transition-colors"
            >
              עריכה
            </Link>
          )}
        </div>
      </header>

      <Card title="פרטי העבודה">
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="לקוח" value={log.client_name} />
          <Field label={equipmentLabel} value={log.equipment_name} />
          <Field label="רכב" value={log.vehicle_name ?? ''} />
          <Field label="מיקום" value={log.location ?? ''} />
          <Field
            label="שם פרויקט"
            value={log.project_name ?? ''}
          />
        </dl>
      </Card>

      <Card title="עובדים">
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500">אין עובדים ברישום זה</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-right border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    שם העובד
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    שכר יומי
                  </th>
                  <th className="px-3 py-2 font-medium text-gray-700">
                    הכנסה מלקוח
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2 text-gray-900">
                      {a.worker_name}
                    </td>
                    <td className="px-3 py-2 text-gray-900" dir="ltr">
                      {formatILS(a.daily_rate)}
                    </td>
                    <td className="px-3 py-2 text-gray-900" dir="ltr">
                      {formatILS(a.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-right font-bold text-gray-900">
                    סה״כ
                  </th>
                  <td className="px-3 py-2 font-bold text-gray-900" dir="ltr">
                    {formatILS(workersCost)}
                  </td>
                  <td className="px-3 py-2 font-bold text-gray-900" dir="ltr">
                    {formatILS(workersRev)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <section className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6">
        <h2 className="text-base font-bold text-amber-900 mb-4">סיכום כספי</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-700">הכנסה מ{equipmentLabel}:</dt>
            <dd className="font-medium text-gray-900" dir="ltr">
              {formatILS(log.equipment_revenue)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-700">הכנסה מעובדים:</dt>
            <dd className="font-medium text-gray-900" dir="ltr">
              {formatILS(workersRev)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-amber-200 pt-2 mt-1">
            <dt className="text-gray-800 font-semibold">סה״כ הכנסה:</dt>
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
          <div className="flex justify-between border-t border-amber-200 pt-2 mt-1">
            <dt className="text-gray-800 font-semibold">רווח:</dt>
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

      {log.notes && (
        <Card title="הערות">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {log.notes}
          </p>
        </Card>
      )}

      <Card title="מידע נוסף">
        <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="נרשם על ידי" value={createdByName} />
          <Field
            label="תאריך רישום"
            value={formatDateTimeIL(log.created_at)}
            dir="ltr"
          />
          <Field
            label="עדכון אחרון"
            value={formatDateTimeIL(log.updated_at)}
            dir="ltr"
          />
        </dl>
      </Card>
    </div>
  );
}
