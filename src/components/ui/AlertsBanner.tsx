'use client';

import { useState } from 'react';
import type { ExpiryAlert } from '@/lib/utils/expiry-alerts';

interface AlertsBannerProps {
  alerts: ExpiryAlert[];
}

const PREVIEW_LIMIT = 5;

function formatAlertText(alert: ExpiryAlert): string {
  const typeLabel = alert.type === 'insurance' ? 'ביטוח' : 'רישיון';
  let tail: string;
  if (alert.daysLeft < 0) tail = 'פג תוקף';
  else if (alert.daysLeft === 0) tail = 'פג תוקף היום';
  else tail = `יפוג בעוד ${alert.daysLeft} ימים`;
  return `${alert.entityName} — ${typeLabel} ${tail}`;
}

function AlertRow({
  alert,
  icon,
  textClass,
}: {
  alert: ExpiryAlert;
  icon: string;
  textClass: string;
}) {
  return (
    <li
      data-testid="alert-item"
      className={`flex items-start gap-2 text-sm ${textClass}`}
    >
      <span aria-hidden className="shrink-0 mt-0.5">
        {icon}
      </span>
      <span className="min-w-0">{formatAlertText(alert)}</span>
    </li>
  );
}

export function AlertsBanner({ alerts }: AlertsBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed || alerts.length === 0) return null;

  const shown = expanded ? alerts : alerts.slice(0, PREVIEW_LIMIT);
  const remaining = alerts.length - shown.length;
  const shownCritical = shown.filter((a) => a.severity === 'critical');
  const shownWarnings = shown.filter((a) => a.severity === 'warning');

  return (
    <div
      data-testid="alerts-banner"
      className="relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3"
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="סגור התראות"
        className="absolute top-3 start-3 w-7 h-7 rounded-full text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm"
      >
        ✕
      </button>

      <header className="text-sm font-bold text-gray-900">
        התראות ({alerts.length})
      </header>

      {shownCritical.length > 0 && (
        <section className="bg-red-50 border border-red-200 rounded-lg p-3">
          <ul className="space-y-1.5">
            {shownCritical.map((alert, i) => (
              <AlertRow
                key={`c-${i}-${alert.entityName}-${alert.type}`}
                alert={alert}
                icon="⚠️"
                textClass="text-red-700 font-medium"
              />
            ))}
          </ul>
        </section>
      )}

      {shownWarnings.length > 0 && (
        <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <ul className="space-y-1.5">
            {shownWarnings.map((alert, i) => (
              <AlertRow
                key={`w-${i}-${alert.entityName}-${alert.type}`}
                alert={alert}
                icon="⚡"
                textClass="text-amber-800"
              />
            ))}
          </ul>
        </section>
      )}

      {remaining > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">
            ועוד {remaining} התראות נוספות
          </span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[#d97706] hover:text-[#b45309] font-medium hover:underline"
          >
            הצג הכל
          </button>
        </div>
      )}
    </div>
  );
}
