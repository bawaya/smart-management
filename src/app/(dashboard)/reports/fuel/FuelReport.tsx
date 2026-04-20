'use client';

import { useRouter } from 'next/navigation';
import type { CompanyInfo } from '@/lib/utils/company-info';
import { printInvoice } from '@/lib/utils/generate-invoice-pdf';
import type { FuelReportData } from '@/lib/utils/report-calculations';

interface FuelReportProps {
  data: FuelReportData;
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

function formatILSDecimal(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

function formatLiters(n: number): string {
  return n.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

function periodLabel(year: number, month: number | null): string {
  if (month == null) return `שנה ${year}`;
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

export function FuelReport({ data, company }: FuelReportProps) {
  const router = useRouter();

  function changePeriod(year: number, month: number | null): void {
    const params = new URLSearchParams();
    params.set('year', String(year));
    if (month != null) params.set('month', String(month));
    router.push(`/reports/fuel?${params.toString()}`);
  }

  const yearOptions: number[] = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 5; y--) yearOptions.push(y);

  const maxMonthlyCost = data.byMonth
    ? Math.max(1, ...data.byMonth.map((m) => m.cost))
    : 1;

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
                ⛽
              </span>
              דוח דלק
            </h1>
            <p className="mt-1 text-sm text-gray-700" dir="ltr">
              {periodLabel(data.year, data.month)}
            </p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">סה״כ עלות</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5" dir="ltr">
              {formatILS(data.totalCost)}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">סה״כ ליטרים</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5" dir="ltr">
              {formatLiters(data.totalLiters)}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500">ממוצע למחיר ליטר</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5" dir="ltr">
              {formatILSDecimal(data.avgPricePerLiter)}
            </p>
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-3">פילוח לפי רכב</h3>
          {data.byVehicle.length === 0 ? (
            <p className="text-sm text-gray-500">אין רישומי דלק בתקופה זו.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200">
                <thead className="bg-gray-50 text-right">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-700">רכב</th>
                    <th className="px-3 py-2 font-medium text-gray-700">
                      ליטרים
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700">עלות</th>
                    <th className="px-3 py-2 font-medium text-gray-700">
                      ממוצע ליום
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700">
                      אחוז מסה״כ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.byVehicle.map((row) => (
                    <tr key={row.vehicleId}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">
                          {row.vehicleName}
                        </div>
                        <div className="text-xs text-gray-500" dir="ltr">
                          {row.licensePlate}
                        </div>
                      </td>
                      <td className="px-3 py-2" dir="ltr">
                        {formatLiters(row.liters)}
                      </td>
                      <td className="px-3 py-2 font-medium" dir="ltr">
                        {formatILS(row.cost)}
                      </td>
                      <td className="px-3 py-2" dir="ltr">
                        {formatILSDecimal(row.avgDaily)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 w-10 text-end" dir="ltr">
                            {row.percentage}%
                          </span>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-amber-500"
                              style={{
                                width: `${Math.min(100, row.percentage)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td className="px-3 py-2 text-gray-900">סה״כ</td>
                    <td className="px-3 py-2 text-gray-900" dir="ltr">
                      {formatLiters(data.totalLiters)}
                    </td>
                    <td className="px-3 py-2 text-gray-900" dir="ltr">
                      {formatILS(data.totalCost)}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" dir="ltr">
                      100%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {data.byMonth && (
          <>
            <section className="mt-6">
              <h3 className="text-base font-bold text-gray-900 mb-3">
                פילוח חודשי
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-200">
                  <thead className="bg-gray-50 text-right">
                    <tr>
                      <th className="px-3 py-2 font-medium text-gray-700">
                        חודש
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-700">
                        ליטרים
                      </th>
                      <th className="px-3 py-2 font-medium text-gray-700">
                        עלות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byMonth.map((m) => (
                      <tr key={m.month}>
                        <td className="px-3 py-2 text-gray-900">
                          {HEBREW_MONTHS[m.month - 1]}
                        </td>
                        <td className="px-3 py-2" dir="ltr">
                          {formatLiters(m.liters)}
                        </td>
                        <td className="px-3 py-2" dir="ltr">
                          {formatILS(m.cost)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold">
                      <td className="px-3 py-2 text-gray-900">סה״כ</td>
                      <td className="px-3 py-2 text-gray-900" dir="ltr">
                        {formatLiters(data.totalLiters)}
                      </td>
                      <td className="px-3 py-2 text-gray-900" dir="ltr">
                        {formatILS(data.totalCost)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                תרשים חודשי
              </h3>
              <div className="flex items-end gap-2 h-40">
                {data.byMonth.map((m) => {
                  const h = (m.cost / maxMonthlyCost) * 100;
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center min-w-0"
                    >
                      <div className="flex-1 w-full flex items-end">
                        <div
                          className="w-full bg-amber-500 rounded-t"
                          style={{ height: `${h}%` }}
                          title={`${HEBREW_MONTHS[m.month - 1]}: ${formatILS(m.cost)}`}
                        />
                      </div>
                      <div className="mt-1 text-[10px] text-gray-600">
                        {m.monthLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </article>
    </>
  );
}
