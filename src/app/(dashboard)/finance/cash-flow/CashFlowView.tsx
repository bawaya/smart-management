'use client';

import { useRouter } from 'next/navigation';
import type {
  CashFlowItem,
  CashFlowResult,
  CashFlowSource,
} from '@/lib/utils/cash-flow-calculations';

interface CashFlowViewProps {
  projection: CashFlowResult;
  weeks: number;
}

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function formatDateIL(iso: string): string {
  const s = (iso ?? '').slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return iso ?? '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function periodLabel(startDate: string, endDate: string): string {
  return `${formatDateIL(startDate)} — ${formatDateIL(endDate)}`;
}

function balanceTone(
  balance: number,
  threshold: number,
): 'positive' | 'warn' | 'negative' {
  if (balance < 0) return 'negative';
  if (threshold > 0 && balance < threshold) return 'warn';
  return 'positive';
}

function SourceTag({ source }: { source: CashFlowSource }) {
  const config: Record<CashFlowSource, { label: string; badge: string }> = {
    check_out: { label: 'שיק יוצא', badge: 'bg-red-50 text-red-700' },
    check_in: { label: 'שיק נכנס', badge: 'bg-green-50 text-green-700' },
    standing_order: {
      label: 'הוראת קבע',
      badge: 'bg-blue-50 text-blue-700',
    },
    credit_card: {
      label: 'כרטיס אשראי',
      badge: 'bg-purple-50 text-purple-700',
    },
    invoice: { label: 'חשבונית', badge: 'bg-amber-50 text-amber-700' },
  };
  const c = config[source];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${c.badge}`}
    >
      {c.label}
    </span>
  );
}

function ItemRow({ item }: { item: CashFlowItem }) {
  return (
    <li className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-gray-500 shrink-0" dir="ltr">
          {formatDateIL(item.date)}
        </span>
        <SourceTag source={item.source} />
        <span className="text-gray-700 truncate">{item.label}</span>
      </div>
      <span
        className={`font-medium shrink-0 ${
          item.direction === 'in' ? 'text-green-700' : 'text-red-700'
        }`}
        dir="ltr"
      >
        {item.direction === 'in' ? '+' : '-'}
        {formatILS(item.amount)}
      </span>
    </li>
  );
}

export function CashFlowView({ projection, weeks }: CashFlowViewProps) {
  const router = useRouter();

  const currentTone =
    projection.currentBalance >= 0 ? 'text-green-700' : 'text-red-700';

  const minBalance = projection.periods.reduce(
    (min, p) => (p.projectedBalance < min ? p.projectedBalance : min),
    projection.currentBalance,
  );
  const willGoBelowThreshold =
    projection.lowBalanceThreshold > 0 &&
    minBalance < projection.lowBalanceThreshold;
  const willGoNegative = minBalance < 0;

  function changeWeeks(newWeeks: number): void {
    const params = new URLSearchParams();
    params.set('weeks', String(newWeeks));
    router.push(`/finance/cash-flow?${params.toString()}`);
  }

  const outChecks = projection.items.filter((i) => i.source === 'check_out');
  const orders = projection.items.filter((i) => i.source === 'standing_order');
  const cards = projection.items.filter((i) => i.source === 'credit_card');

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            💹
          </span>
          תזרים מזומנים
        </h1>
      </header>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-500">יתרה נוכחית</p>
        <p className={`text-3xl font-bold mt-1 ${currentTone}`} dir="ltr">
          {formatILS(projection.currentBalance)}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          מ-{projection.accountsCount} חשבונות
        </p>
      </div>

      {(willGoNegative || willGoBelowThreshold) && (
        <div
          role="alert"
          className={`p-4 rounded-lg border ${
            willGoNegative
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <p className="font-bold">
            <span aria-hidden className="me-2">
              ⚠️
            </span>
            {willGoNegative
              ? 'התרעה: היתרה צפויה להיכנס למינוס'
              : 'התרעה: היתרה צפויה לרדת מתחת לסף המוגדר'}
          </p>
          <p className="text-sm mt-1" dir="ltr">
            יתרה מינימלית צפויה: {formatILS(minBalance)}
          </p>
        </div>
      )}

      <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
        {[
          { value: 4, label: 'שבוע' },
          { value: 8, label: 'חודש' },
          { value: 13, label: '3 חודשים' },
        ].map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => changeWeeks(opt.value)}
            className={`px-3 py-2 text-sm font-medium border-s border-gray-300 first:border-s-0 ${
              weeks === opt.value
                ? 'bg-[#f59e0b] text-black'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-right">
            <tr>
              <th className="px-4 py-3 font-medium text-gray-700">תקופה</th>
              <th className="px-4 py-3 font-medium text-gray-700">
                נכנס צפוי
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">
                יוצא צפוי
              </th>
              <th className="px-4 py-3 font-medium text-gray-700">נטו</th>
              <th className="px-4 py-3 font-medium text-gray-700">
                יתרה צפויה
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {projection.periods.map((p) => {
              const tone = balanceTone(
                p.projectedBalance,
                projection.lowBalanceThreshold,
              );
              const rowClass =
                tone === 'negative' ? 'bg-red-50' : '';
              const balanceClass =
                tone === 'negative'
                  ? 'text-red-700 font-bold'
                  : tone === 'warn'
                    ? 'text-amber-700 font-bold'
                    : 'text-green-700 font-medium';
              return (
                <tr key={p.index} className={rowClass}>
                  <td className="px-4 py-3 text-gray-700" dir="ltr">
                    {periodLabel(p.startDate, p.endDate)}
                  </td>
                  <td className="px-4 py-3 text-green-700 font-medium" dir="ltr">
                    {p.incoming > 0 ? `+${formatILS(p.incoming)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-red-700 font-medium" dir="ltr">
                    {p.outgoing > 0 ? `-${formatILS(p.outgoing)}` : '—'}
                  </td>
                  <td
                    className={`px-4 py-3 font-medium ${
                      p.net >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                    dir="ltr"
                  >
                    {formatILS(p.net)}
                  </td>
                  <td className={`px-4 py-3 ${balanceClass}`} dir="ltr">
                    {formatILS(p.projectedBalance)}
                    {tone === 'negative' && (
                      <span aria-hidden className="ms-1">
                        ⚠️
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-2">שיקים יוצאים צפויים</h3>
          {outChecks.length === 0 ? (
            <p className="text-sm text-gray-500">אין</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {outChecks.map((item, i) => (
                <ItemRow key={`${item.date}-${i}`} item={item} />
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-2">הוראות קבע צפויות</h3>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-500">אין</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {orders.map((item, i) => (
                <ItemRow key={`${item.date}-${i}`} item={item} />
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 mb-2">חיובי כרטיסי אשראי</h3>
          {cards.length === 0 ? (
            <p className="text-sm text-gray-500">אין</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {cards.map((item, i) => (
                <ItemRow key={`${item.date}-${i}`} item={item} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
