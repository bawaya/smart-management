'use client';

import { useMemo } from 'react';

export interface VehicleCostRow {
  id: string;
  name: string;
  licensePlate: string;
  dailyFuel: number;
  dailyInsurance: number;
  dailyLicense: number;
  dailyMaintenance: number;
  totalDailyCost: number;
  revenue: number;
  profit: number;
}

interface CostAnalysisViewProps {
  equipmentLabel: string;
  clientRevenue: number;
  rows: VehicleCostRow[];
}

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 0 })}`;
}

function formatILSDecimal(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

function profitClass(n: number): string {
  if (n > 0) return 'text-green-700';
  if (n < 0) return 'text-red-700';
  return 'text-gray-900';
}

export function CostAnalysisView({
  equipmentLabel,
  clientRevenue,
  rows,
}: CostAnalysisViewProps) {
  const summary = useMemo(() => {
    if (rows.length === 0) {
      return {
        avgCost: 0,
        avgProfit: 0,
        marginPct: 0,
      };
    }
    const sumCost = rows.reduce((s, r) => s + r.totalDailyCost, 0);
    const avgCost = sumCost / rows.length;
    const avgProfit = clientRevenue - avgCost;
    const marginPct = clientRevenue > 0 ? (avgProfit / clientRevenue) * 100 : 0;
    return {
      avgCost: Math.round(avgCost * 100) / 100,
      avgProfit: Math.round(avgProfit * 100) / 100,
      marginPct: Math.round(marginPct),
    };
  }, [rows, clientRevenue]);

  const unprofitable = rows.filter((r) => r.profit < 0);

  const chartMax = useMemo(() => {
    let max = clientRevenue;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].totalDailyCost > max) max = rows[i].totalDailyCost;
    }
    return Math.max(1, max);
  }, [rows, clientRevenue]);

  const revenueLinePercent = (clientRevenue / chartMax) * 100;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          <span aria-hidden className="me-2">
            🧮
          </span>
          תמחור חכם — עלות אמיתית ליום
        </h1>
      </header>

      <p className="text-sm text-gray-600 bg-white rounded-lg border border-gray-200 p-3">
        ניתוח העלות האמיתית של כל יום עבודה — כולל דלק, ביטוח, רישיון ותחזוקה.
        המספרים מחושבים מנתוני 3 החודשים האחרונים.
      </p>

      <section className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-amber-900 mb-3">סיכום כללי</h2>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt className="text-xs text-gray-600">הכנסה ממוצעת ליום</dt>
            <dd
              className="text-xl font-bold text-gray-900 mt-0.5"
              dir="ltr"
            >
              {formatILS(clientRevenue)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">עלות ממוצעת ליום</dt>
            <dd
              className="text-xl font-bold text-red-700 mt-0.5"
              dir="ltr"
            >
              {formatILS(summary.avgCost)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">רווח אמיתי ליום</dt>
            <dd
              className={`text-xl font-bold mt-0.5 ${profitClass(summary.avgProfit)}`}
              dir="ltr"
            >
              {formatILS(summary.avgProfit)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-600">שולי רווח</dt>
            <dd
              className={`text-xl font-bold mt-0.5 ${profitClass(summary.avgProfit)}`}
              dir="ltr"
            >
              {summary.marginPct}%
            </dd>
          </div>
        </dl>
      </section>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <p className="text-gray-600">
            אין רכבים פעילים לחישוב עלות. הוסף רכבים דרך תפריט רכבים.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-700">רכב</th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    דלק/יום
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    ביטוח/יום
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    רישיון/יום
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    תחזוקה/יום
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">
                    עלות כוללת
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-700">הכנסה</th>
                  <th className="px-4 py-3 font-medium text-gray-700">רווח</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const costPercentOfRevenue =
                    clientRevenue > 0
                      ? (r.totalDailyCost / clientRevenue) * 100
                      : 0;
                  const barColor =
                    r.profit < 0
                      ? 'bg-red-500'
                      : costPercentOfRevenue > 75
                        ? 'bg-yellow-500'
                        : 'bg-green-500';
                  return (
                    <tr
                      key={r.id}
                      data-testid="report-cost-row"
                      data-vehicle-id={r.id}
                    >
                      <td className="px-4 py-3">
                        <div
                          data-testid="report-cost-vehicle-name"
                          className="font-medium text-gray-900"
                        >
                          {r.name}
                        </div>
                        <div className="text-xs text-gray-500" dir="ltr">
                          {r.licensePlate}
                        </div>
                      </td>
                      <td
                        data-testid="report-cost-daily-fuel"
                        className="px-4 py-3"
                        dir="ltr"
                      >
                        {formatILSDecimal(r.dailyFuel)}
                      </td>
                      <td
                        data-testid="report-cost-daily-insurance"
                        className="px-4 py-3"
                        dir="ltr"
                      >
                        {formatILSDecimal(r.dailyInsurance)}
                      </td>
                      <td
                        data-testid="report-cost-daily-license"
                        className="px-4 py-3"
                        dir="ltr"
                      >
                        {formatILSDecimal(r.dailyLicense)}
                      </td>
                      <td
                        data-testid="report-cost-daily-maintenance"
                        className="px-4 py-3"
                        dir="ltr"
                      >
                        {formatILSDecimal(r.dailyMaintenance)}
                      </td>
                      <td className="px-4 py-3">
                        <div
                          data-testid="report-cost-daily-total"
                          className="font-bold text-gray-900"
                          dir="ltr"
                        >
                          {formatILSDecimal(r.totalDailyCost)}
                        </div>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-24">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{
                              width: `${Math.min(100, costPercentOfRevenue)}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td
                        data-testid="report-cost-revenue"
                        className="px-4 py-3 font-medium text-gray-900"
                        dir="ltr"
                      >
                        {formatILS(r.revenue)}
                      </td>
                      <td
                        data-testid="report-cost-profit"
                        className={`px-4 py-3 font-bold ${profitClass(r.profit)}`}
                        dir="ltr"
                      >
                        {formatILSDecimal(r.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-4">
              פילוח עלויות יומיות לכל {equipmentLabel}
            </h3>
            <div className="relative flex items-end gap-3 h-56">
              <div
                className="absolute left-0 right-0 h-0.5 bg-green-500 z-10"
                style={{ bottom: `${revenueLinePercent}%` }}
                title={`הכנסה: ${formatILS(clientRevenue)}`}
              />
              {rows.map((r) => {
                const fuelH = (r.dailyFuel / chartMax) * 100;
                const insH = (r.dailyInsurance / chartMax) * 100;
                const licH = (r.dailyLicense / chartMax) * 100;
                const maintH = (r.dailyMaintenance / chartMax) * 100;
                return (
                  <div
                    key={r.id}
                    className="flex-1 flex flex-col items-center min-w-0"
                  >
                    <div
                      className="w-full flex flex-col justify-end rounded-t overflow-hidden"
                      style={{ height: '100%' }}
                      title={`${r.name}: ${formatILSDecimal(r.totalDailyCost)}`}
                    >
                      <div
                        className="bg-red-500"
                        style={{ height: `${maintH}%` }}
                        title={`תחזוקה: ${formatILSDecimal(r.dailyMaintenance)}`}
                      />
                      <div
                        className="bg-purple-500"
                        style={{ height: `${licH}%` }}
                        title={`רישיון: ${formatILSDecimal(r.dailyLicense)}`}
                      />
                      <div
                        className="bg-blue-500"
                        style={{ height: `${insH}%` }}
                        title={`ביטוח: ${formatILSDecimal(r.dailyInsurance)}`}
                      />
                      <div
                        className="bg-yellow-500"
                        style={{ height: `${fuelH}%` }}
                        title={`דלק: ${formatILSDecimal(r.dailyFuel)}`}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-600 truncate max-w-full">
                      {r.name}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-600 flex-wrap justify-end">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-yellow-500" />
                דלק
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-500" />
                ביטוח
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-purple-500" />
                רישיון
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-500" />
                תחזוקה
              </span>
              <span className="flex items-center gap-1">
                <span className="w-6 h-0.5 bg-green-500" />
                הכנסה
              </span>
            </div>
          </section>

          {unprofitable.length > 0 ? (
            <section className="space-y-2">
              {unprofitable.map((r) => (
                <div
                  key={r.id}
                  role="alert"
                  className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800"
                >
                  <p className="font-bold">
                    <span aria-hidden className="me-2">
                      ⚠️
                    </span>
                    הרכב {r.name} יוצר הפסד של{' '}
                    <span dir="ltr">
                      {formatILSDecimal(Math.abs(r.profit))}
                    </span>{' '}
                    ליום — שקול החלפה או העלאת מחיר
                  </p>
                </div>
              ))}
            </section>
          ) : (
            <section className="p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-center">
              <p className="font-bold">
                <span aria-hidden className="me-2">
                  ✅
                </span>
                כל הרכבים רווחיים — כל הכבוד!
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
