'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode } from 'react';
import type { CompanyInfo } from '@/lib/utils/company-info';
import type { ProfitLossData } from '@/lib/utils/report-calculations';
import { printInvoice } from '@/lib/utils/generate-invoice-pdf';

interface ProfitLossReportProps {
  data: ProfitLossData;
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

function Delta({
  current,
  prev,
  higherIsBetter,
}: {
  current: number;
  prev: number;
  higherIsBetter: boolean;
}): ReactNode {
  if (prev === 0 && current === 0) {
    return <span className="text-gray-400">—</span>;
  }
  if (prev === 0) {
    return (
      <span className="text-gray-500" dir="ltr">
        חדש
      </span>
    );
  }
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  const rounded = Math.round(Math.abs(pct));
  if (rounded === 0) {
    return (
      <span className="text-gray-500" dir="ltr">
        ללא שינוי
      </span>
    );
  }
  const up = pct > 0;
  const good = higherIsBetter ? up : !up;
  const color = good ? 'text-green-700' : 'text-red-700';
  const arrow = up ? '↑' : '↓';
  return (
    <span className={`${color} font-medium`} dir="ltr">
      {arrow} {rounded}%
    </span>
  );
}

export function ProfitLossReport({ data, company }: ProfitLossReportProps) {
  const router = useRouter();

  function changePeriod(year: number, month: number | null): void {
    const params = new URLSearchParams();
    params.set('year', String(year));
    if (month != null) params.set('month', String(month));
    router.push(`/reports?${params.toString()}`);
  }

  const yearOptions = [];
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
        <div className="flex items-center gap-2 ms-auto">
          <button
            type="button"
            onClick={printInvoice}
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            הדפס
          </button>
          <button
            type="button"
            onClick={printInvoice}
            className="px-4 py-2 rounded-md bg-[#f59e0b] text-black font-bold text-sm hover:bg-[#d97706] transition-colors"
          >
            ייצוא
          </button>
        </div>
      </div>

      <article className="report-print-surface mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-4xl mx-auto">
        <header className="flex items-start justify-between gap-4 pb-6 border-b border-gray-200">
          <div className="flex items-start gap-3">
            {company.logoDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logoDataUrl}
                alt={company.name || 'לוגו'}
                className="max-h-16 max-w-[100px] object-contain"
              />
            )}
            <div>
              {company.name && (
                <h2 className="text-lg font-bold text-gray-900">
                  {company.name}
                </h2>
              )}
              {company.taxId && (
                <p className="text-xs text-gray-600 mt-0.5">
                  מספר עוסק:{' '}
                  <span dir="ltr">{company.taxId}</span>
                </p>
              )}
            </div>
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-bold text-gray-900">
              דוח רווח והפסד
            </h1>
            <p
              data-testid="report-pl-period"
              className="mt-2 text-sm text-gray-700"
              dir="ltr"
            >
              {periodLabel(data.year, data.month)}
            </p>
          </div>
        </header>

        <section className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-green-900 mb-3">הכנסות</h3>
          <dl className="space-y-1 text-sm">
            {data.incomes.map((line) => (
              <div key={line.key} className="flex justify-between">
                <dt className="text-gray-700">{line.label}:</dt>
                <dd className="text-gray-900 font-medium" dir="ltr">
                  {formatILS(line.amount)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-green-200 pt-2 mt-2">
              <dt className="text-green-900 font-bold">סה״כ הכנסות:</dt>
              <dd
                data-testid="report-pl-total-income"
                className="text-green-900 font-bold"
                dir="ltr"
              >
                {formatILS(data.totalIncome)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-red-900 mb-3">הוצאות</h3>
          <dl className="space-y-1 text-sm">
            {data.expenses.map((line) => (
              <div key={line.key} className="flex justify-between">
                <dt className="text-gray-700">{line.label}:</dt>
                <dd className="text-gray-900 font-medium" dir="ltr">
                  {formatILS(line.amount)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-red-200 pt-2 mt-2">
              <dt className="text-red-900 font-bold">סה״כ הוצאות:</dt>
              <dd
                data-testid="report-pl-total-expenses"
                className="text-red-900 font-bold"
                dir="ltr"
              >
                {formatILS(data.totalExpenses)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-amber-900 mb-3">סיכום</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-800 font-semibold">רווח גולמי:</dt>
              <dd
                data-testid="report-pl-gross-profit"
                className={`font-bold text-base ${
                  data.grossProfit >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
                dir="ltr"
              >
                {formatILS(data.grossProfit)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-700">שולי רווח:</dt>
              <dd
                data-testid="report-pl-margin-percent"
                className={`font-medium ${
                  data.marginPct >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
                dir="ltr"
              >
                {data.marginPct}%
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-700 text-xs italic">
                מע״מ שנגבה (מידע בלבד):
              </dt>
              <dd className="text-gray-600 text-xs italic" dir="ltr">
                {formatILS(data.vatCollected)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-amber-200 pt-2 mt-2">
              <dt className="text-gray-900 font-bold">רווח נקי:</dt>
              <dd
                data-testid="report-pl-net-profit"
                className={`font-bold text-lg ${
                  data.netProfit >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
                dir="ltr"
              >
                {formatILS(data.netProfit)}
              </dd>
            </div>
          </dl>
        </section>

        {data.previous && (
          <section className="mt-4 bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-3">
              השוואה לתקופה הקודמת
            </h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-700">שינוי בהכנסות:</dt>
                <dd data-testid="report-pl-income-delta">
                  <Delta
                    current={data.totalIncome}
                    prev={data.previous.totalIncome}
                    higherIsBetter
                  />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">שינוי בהוצאות:</dt>
                <dd data-testid="report-pl-expenses-delta">
                  <Delta
                    current={data.totalExpenses}
                    prev={data.previous.totalExpenses}
                    higherIsBetter={false}
                  />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">שינוי ברווח:</dt>
                <dd data-testid="report-pl-profit-delta">
                  <Delta
                    current={data.grossProfit}
                    prev={data.previous.grossProfit}
                    higherIsBetter
                  />
                </dd>
              </div>
            </dl>
          </section>
        )}
      </article>
    </>
  );
}
