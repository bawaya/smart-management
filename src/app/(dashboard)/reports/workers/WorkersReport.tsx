'use client';

import { useRouter } from 'next/navigation';
import type { CompanyInfo } from '@/lib/utils/company-info';
import { printInvoice } from '@/lib/utils/generate-invoice-pdf';
import type { WorkersReportData } from '@/lib/utils/report-calculations';

interface WorkersReportProps {
  data: WorkersReportData;
  company: CompanyInfo;
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

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function periodLabel(year: number, month: number | null): string {
  if (month == null) return `שנה ${year}`;
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

function profitClass(n: number): string {
  if (n > 0) return 'text-green-700';
  if (n < 0) return 'text-red-700';
  return 'text-gray-900';
}

export function WorkersReport({ data, company }: WorkersReportProps) {
  const router = useRouter();

  function changePeriod(year: number, month: number | null): void {
    const params = new URLSearchParams();
    params.set('year', String(year));
    if (month != null) params.set('month', String(month));
    router.push(`/reports/workers?${params.toString()}`);
  }

  const yearOptions: number[] = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 5; y--) yearOptions.push(y);

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; }
          .report-print-hide { display: none !important; }
          .report-print-surface {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="report-print-hide flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
        <select
          value={data.year}
          onChange={(e) => changePeriod(Number(e.target.value), data.month)}
          className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm"
          aria-label="שנה"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          value={data.month == null ? 'all' : String(data.month)}
          onChange={(e) =>
            changePeriod(
              data.year,
              e.target.value === 'all' ? null : Number(e.target.value),
            )
          }
          className="px-3 py-2 rounded-md border border-gray-300 bg-white text-sm md:w-40"
          aria-label="חודש"
        >
          <option value="all">כל השנה</option>
          {HEBREW_MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={printInvoice}
          className="ms-auto px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          הדפס
        </button>
      </div>

      <article className="report-print-surface mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-4xl mx-auto">
        <header className="flex items-start justify-between gap-4 pb-4 border-b border-gray-200">
          <div>
            {company.name && (
              <h2 className="text-lg font-bold text-gray-900">
                {company.name}
              </h2>
            )}
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-gray-900">
              <span aria-hidden className="me-2">
                👷
              </span>
              דוח עובדים
            </h1>
            <p className="mt-1 text-sm text-gray-700" dir="ltr">
              {periodLabel(data.year, data.month)}
            </p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">עובדים פעילים</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5" dir="ltr">
              {data.activeWorkersCount}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">סה״כ ימי עבודה</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5" dir="ltr">
              {data.totalDays}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">סה״כ עלות</p>
            <p className="text-xl font-bold text-red-700 mt-0.5" dir="ltr">
              {formatILS(data.totalCost)}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">סה״כ רווח מעובדים</p>
            <p
              className={`text-xl font-bold mt-0.5 ${profitClass(data.totalProfit)}`}
              dir="ltr"
            >
              {formatILS(data.totalProfit)}
            </p>
          </div>
        </section>

        {data.topPerformer && (
          <section className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="font-bold text-amber-900">
              <span aria-hidden className="me-2">
                🏆
              </span>
              העובד הרווחי ביותר: {data.topPerformer.name} —{' '}
              <span dir="ltr">{formatILS(data.topPerformer.profit)}</span>
            </p>
          </section>
        )}

        <section className="mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-3">
            פילוח לפי עובד
          </h3>
          {data.byWorker.length === 0 ? (
            <p className="text-sm text-gray-500">
              אין רישומי עבודה מאושרים בתקופה זו.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200">
                <thead className="bg-gray-50 text-right">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-700">עובד</th>
                    <th className="px-3 py-2 font-medium text-gray-700">ימים</th>
                    <th className="px-3 py-2 font-medium text-gray-700">
                      עלות ליום
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700">
                      עלות כוללת
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700">
                      הכנסה כוללת
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700">רווח</th>
                    <th className="px-3 py-2 font-medium text-gray-700">
                      רווח ליום
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byWorker.map((w) => (
                    <tr
                      key={w.workerId}
                      data-testid="report-workers-row"
                      data-worker-id={w.workerId}
                    >
                      <td
                        data-testid="report-workers-row-name"
                        className="px-3 py-2 text-gray-900 font-medium"
                      >
                        {w.workerName}
                      </td>
                      <td
                        data-testid="report-workers-row-days"
                        className="px-3 py-2"
                        dir="ltr"
                      >
                        {w.days}
                      </td>
                      <td className="px-3 py-2" dir="ltr">
                        {formatILS(w.avgDailyCost)}
                      </td>
                      <td
                        data-testid="report-workers-row-cost"
                        className="px-3 py-2"
                        dir="ltr"
                      >
                        {formatILS(w.totalCost)}
                      </td>
                      <td
                        data-testid="report-workers-row-revenue"
                        className="px-3 py-2"
                        dir="ltr"
                      >
                        {formatILS(w.totalRevenue)}
                      </td>
                      <td
                        data-testid="report-workers-row-profit"
                        className={`px-3 py-2 font-bold ${profitClass(w.profit)}`}
                        dir="ltr"
                      >
                        {formatILS(w.profit)}
                      </td>
                      <td
                        className={`px-3 py-2 ${profitClass(w.avgDailyProfit)}`}
                        dir="ltr"
                      >
                        {formatILS(w.avgDailyProfit)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-3 py-2 text-gray-900">סה״כ</td>
                    <td className="px-3 py-2 text-gray-900" dir="ltr">
                      {data.totalDays}
                    </td>
                    <td className="px-3 py-2" />
                    <td
                      data-testid="report-workers-total-cost"
                      className="px-3 py-2 text-red-700"
                      dir="ltr"
                    >
                      {formatILS(data.totalCost)}
                    </td>
                    <td
                      data-testid="report-workers-total-revenue"
                      className="px-3 py-2 text-green-700"
                      dir="ltr"
                    >
                      {formatILS(data.totalRevenue)}
                    </td>
                    <td
                      data-testid="report-workers-total-profit"
                      className={`px-3 py-2 ${profitClass(data.totalProfit)}`}
                      dir="ltr"
                    >
                      {formatILS(data.totalProfit)}
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </article>
    </>
  );
}
