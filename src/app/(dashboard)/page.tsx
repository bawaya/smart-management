import { headers } from 'next/headers';
import Link from 'next/link';
import { AlertsBanner } from '@/components/ui/AlertsBanner';
import {
  getDashboardStats,
  getRecentActivity,
  type RecentExpense,
  type RecentInvoice,
  type RecentLog,
} from '@/lib/utils/dashboard-stats';
import { getExpiryAlerts } from '@/lib/utils/expiry-alerts';

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  valueClassName?: string;
}

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
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

const LOG_STATUS_LABELS: Record<string, { label: string; className: string }> =
  {
    draft: { label: 'טיוטה', className: 'bg-gray-200 text-gray-800' },
    confirmed: { label: 'מאושר', className: 'bg-green-100 text-green-800' },
    invoiced: { label: 'חשבונית', className: 'bg-blue-100 text-blue-800' },
  };

const INVOICE_STATUS_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  draft: { label: 'טיוטה', className: 'bg-gray-200 text-gray-800' },
  sent: { label: 'נשלחה', className: 'bg-blue-100 text-blue-800' },
  paid: { label: 'שולמה', className: 'bg-green-100 text-green-800' },
  partial: { label: 'חלקית', className: 'bg-yellow-100 text-yellow-800' },
  cancelled: { label: 'בוטלה', className: 'bg-red-100 text-red-800' },
};

function StatCard({ icon, label, value, valueClassName }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4">
      <div className="text-4xl leading-none" aria-hidden>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p
          className={`text-2xl font-bold mt-1 truncate ${
            valueClassName ?? 'text-gray-900'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function formatILS(n: number): string {
  return `₪${Math.round(n).toLocaleString('he-IL')}`;
}

function formatDateIL(iso: string): string {
  const s = (iso ?? '').slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return iso ?? '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function SmallBadge({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function RecentLogsCard({ logs }: { logs: RecentLog[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">
          <span aria-hidden className="me-1">
            📋
          </span>
          יומן עבודה אחרון
        </h2>
        <Link
          href="/daily-log"
          className="text-xs text-[#d97706] hover:text-[#b45309] font-medium"
        >
          הצג הכל →
        </Link>
      </header>
      {logs.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-3">
          אין רישומים עדיין
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {logs.map((log) => {
            const status = LOG_STATUS_LABELS[log.status] ?? {
              label: log.status,
              className: 'bg-gray-100',
            };
            return (
              <li
                key={log.id}
                className="py-2 flex items-center gap-2 text-xs"
              >
                <span className="text-gray-500 shrink-0" dir="ltr">
                  {formatDateIL(log.log_date)}
                </span>
                <span className="text-gray-900 truncate flex-1">
                  {log.client_name}
                </span>
                <SmallBadge
                  label={status.label}
                  className={status.className}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecentInvoicesCard({ invoices }: { invoices: RecentInvoice[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">
          <span aria-hidden className="me-1">
            📄
          </span>
          חשבוניות אחרונות
        </h2>
        <Link
          href="/invoices"
          className="text-xs text-[#d97706] hover:text-[#b45309] font-medium"
        >
          הצג הכל →
        </Link>
      </header>
      {invoices.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-3">
          אין חשבוניות עדיין
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {invoices.map((inv) => {
            const status = INVOICE_STATUS_LABELS[inv.status] ?? {
              label: inv.status,
              className: 'bg-gray-100',
            };
            return (
              <li
                key={inv.id}
                className="py-2 flex items-center gap-2 text-xs"
              >
                <span
                  className="text-gray-500 shrink-0 font-medium"
                  dir="ltr"
                >
                  {inv.invoice_number}
                </span>
                <span className="text-gray-900 truncate flex-1">
                  {inv.client_name}
                </span>
                <span
                  className="text-gray-900 font-medium shrink-0"
                  dir="ltr"
                >
                  {formatILS(inv.total)}
                </span>
                <SmallBadge
                  label={status.label}
                  className={status.className}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RecentExpensesCard({ expenses }: { expenses: RecentExpense[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-gray-900">
          <span aria-hidden className="me-1">
            💰
          </span>
          הוצאות אחרונות
        </h2>
        <Link
          href="/expenses"
          className="text-xs text-[#d97706] hover:text-[#b45309] font-medium"
        >
          הצג הכל →
        </Link>
      </header>
      {expenses.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-3">
          אין הוצאות עדיין
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {expenses.map((exp) => (
            <li
              key={exp.id}
              className="py-2 flex items-center gap-2 text-xs"
            >
              <span className="text-gray-500 shrink-0" dir="ltr">
                {formatDateIL(exp.expense_date)}
              </span>
              <span className="text-gray-900 truncate flex-1">
                {EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category}
              </span>
              <span
                className="text-red-700 font-medium shrink-0"
                dir="ltr"
              >
                {formatILS(exp.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function DashboardHomePage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const [stats, alerts, activity] = await Promise.all([
    getDashboardStats(tenantId),
    getExpiryAlerts(tenantId),
    getRecentActivity(tenantId),
  ]);

  const profitColor =
    stats.netProfit > 0
      ? 'text-green-600'
      : stats.netProfit < 0
        ? 'text-red-600'
        : 'text-gray-900';

  const alertsColor =
    stats.alertsCount > 0 ? 'text-red-600' : 'text-green-600';

  const now = new Date();
  const monthLabel = `${HEBREW_MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <div className="space-y-6">
      <AlertsBanner alerts={alerts} />

      <h1 className="text-2xl font-bold text-gray-900">
        ברוך הבא לניהול חכם
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          icon="💰"
          label="הכנסות החודש"
          value={formatILS(stats.totalIncome)}
        />
        <StatCard
          icon="📉"
          label="הוצאות החודש"
          value={formatILS(stats.totalExpenses)}
        />
        <StatCard
          icon="📊"
          label="רווח נקי"
          value={formatILS(stats.netProfit)}
          valueClassName={profitColor}
        />
        <StatCard
          icon="📅"
          label="ימי עבודה"
          value={stats.workingDays.toLocaleString('he-IL')}
        />
        <StatCard
          icon="⚠️"
          label="התראות"
          value={stats.alertsCount.toLocaleString('he-IL')}
          valueClassName={alertsColor}
        />
      </div>

      <p className="text-sm text-gray-500 text-center">נתוני {monthLabel}</p>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RecentLogsCard logs={activity.logs} />
        <RecentInvoicesCard invoices={activity.invoices} />
        <RecentExpensesCard expenses={activity.expenses} />
      </section>
    </div>
  );
}
