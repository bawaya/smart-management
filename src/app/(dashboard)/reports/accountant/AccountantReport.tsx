'use client';

import { useRouter } from 'next/navigation';
import type { CompanyInfo } from '@/lib/utils/company-info';
import type { AccountantReportData } from '@/lib/utils/report-calculations';
import { printInvoice } from '@/lib/utils/generate-invoice-pdf';

interface AccountantReportProps {
  data: AccountantReportData;
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

function periodLabel(year: number, month: number | null): string {
  if (month == null) return `שנה ${year}`;
  return `${HEBREW_MONTHS[month - 1]} ${year}`;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}/${m}/${y}`;
}

export function AccountantReport({ data, company }: AccountantReportProps) {
  const router = useRouter();

  function changePeriod(year: number, month: number | null): void {
    const params = new URLSearchParams();
    params.set('year', String(year));
    if (month != null) params.set('month', String(month));
    router.push(`/reports/accountant?${params.toString()}`);
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
        <header className="pb-6 border-b-2 border-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {company.logoDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoDataUrl}
                  alt={company.name || 'לוגו'}
                  className="max-h-20 max-w-[120px] object-contain"
                />
              )}
              <div>
                {company.name && (
                  <h2 className="text-xl font-bold text-gray-900">
                    {company.name}
                  </h2>
                )}
                {company.address && (
                  <p className="text-sm text-gray-700 mt-1">
                    {company.address}
                  </p>
                )}
                {company.phone && (
                  <p className="text-sm text-gray-700 mt-0.5" dir="ltr">
                    {company.phone}
                  </p>
                )}
                {company.taxId && (
                  <p className="text-sm text-gray-700 mt-0.5">
                    מספר עוסק:{' '}
                    <span dir="ltr">{company.taxId}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-gray-900">
                דוח רואה חשבון
              </h1>
              <p className="mt-2 text-sm text-gray-700" dir="ltr">
                {periodLabel(data.year, data.month)}
              </p>
            </div>
          </div>
        </header>

        <section className="mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-3">
            1. סיכום הכנסות
          </h3>
          <table className="w-full text-sm border border-gray-200">
            <tbody className="divide-y divide-gray-100">
              {data.incomes.map((line) => (
                <tr key={line.key}>
                  <td className="px-3 py-2 text-gray-700">{line.label}</td>
                  <td className="px-3 py-2 text-end font-medium" dir="ltr">
                    {formatILS(line.amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-green-50">
                <td className="px-3 py-2 text-green-900 font-bold">
                  סה״כ הכנסות
                </td>
                <td
                  className="px-3 py-2 text-end text-green-900 font-bold"
                  dir="ltr"
                >
                  {formatILS(data.totalIncome)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-3">
            2. סיכום הוצאות מוכרות
          </h3>
          <table className="w-full text-sm border border-gray-200">
            <tbody className="divide-y divide-gray-100">
              {data.expenses.map((line) => (
                <tr key={line.key}>
                  <td className="px-3 py-2 text-gray-700">{line.label}</td>
                  <td className="px-3 py-2 text-end font-medium" dir="ltr">
                    {formatILS(line.amount)}
                  </td>
                </tr>
              ))}
              <tr className="bg-red-50">
                <td className="px-3 py-2 text-red-900 font-bold">
                  סה״כ הוצאות
                </td>
                <td
                  className="px-3 py-2 text-end text-red-900 font-bold"
                  dir="ltr"
                >
                  {formatILS(data.totalExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-3">
            3. סיכום חשבוניות ומע״מ
          </h3>
          <table className="w-full text-sm border border-gray-200">
            <tbody className="divide-y divide-gray-100">
              <tr>
                <td className="px-3 py-2 text-gray-700">
                  מספר חשבוניות שהופקו
                </td>
                <td className="px-3 py-2 text-end font-medium" dir="ltr">
                  {data.invoicesCount}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-gray-700">
                  סה״כ חשבוניות (לפני מע״מ)
                </td>
                <td className="px-3 py-2 text-end font-medium" dir="ltr">
                  {formatILS(data.invoicesSubtotalSum)}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-gray-700">מע״מ שנגבה</td>
                <td className="px-3 py-2 text-end font-medium" dir="ltr">
                  {formatILS(data.invoicesVatSum)}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-3 py-2 text-blue-900 font-bold">
                  סה״כ חשבוניות (כולל מע״מ)
                </td>
                <td
                  className="px-3 py-2 text-end text-blue-900 font-bold"
                  dir="ltr"
                >
                  {formatILS(data.invoicesTotalSum)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h3 className="text-base font-bold text-gray-900 mb-3">
            4. שורה תחתונה
          </h3>
          <table className="w-full text-sm border-2 border-gray-900">
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-3 py-2 text-gray-700">רווח לפני מס</td>
                <td
                  className={`px-3 py-2 text-end font-bold ${
                    data.grossProfit >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                  dir="ltr"
                >
                  {formatILS(data.grossProfit)}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-gray-700">
                  הערכת מס (
                  <span dir="ltr">{Math.round(data.estimatedTaxRate * 100)}%</span>
                  ) — מידע בלבד
                </td>
                <td
                  className="px-3 py-2 text-end font-medium text-gray-700"
                  dir="ltr"
                >
                  {formatILSDecimal(data.estimatedTax)}
                </td>
              </tr>
              <tr className="bg-amber-50">
                <td className="px-3 py-2 text-gray-900 font-bold">
                  רווח נקי משוער לאחר מס
                </td>
                <td
                  className={`px-3 py-2 text-end font-bold text-base ${
                    data.netAfterTax >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                  dir="ltr"
                >
                  {formatILSDecimal(data.netAfterTax)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-end text-sm text-gray-600">
          <div>
            <p className="font-medium">{company.name || '—'}</p>
            {company.taxId && (
              <p className="text-xs mt-0.5">
                מספר עוסק:{' '}
                <span dir="ltr">{company.taxId}</span>
              </p>
            )}
          </div>
          <div className="text-end">
            <p className="text-xs">תאריך הפקה</p>
            <p className="font-medium" dir="ltr">
              {todayIso()}
            </p>
          </div>
        </footer>
      </article>
    </>
  );
}
