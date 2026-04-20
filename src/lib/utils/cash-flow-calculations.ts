import { cache } from 'react';
import { getDb } from '@/lib/db';

export type CashFlowSource =
  | 'check_in'
  | 'check_out'
  | 'standing_order'
  | 'credit_card'
  | 'invoice';

export interface CashFlowItem {
  source: CashFlowSource;
  direction: 'in' | 'out';
  label: string;
  amount: number;
  date: string;
}

export interface CashFlowPeriod {
  index: number;
  startDate: string;
  endDate: string;
  incoming: number;
  outgoing: number;
  net: number;
  projectedBalance: number;
}

export interface CashFlowResult {
  currentBalance: number;
  accountsCount: number;
  lowBalanceThreshold: number;
  periods: CashFlowPeriod[];
  items: CashFlowItem[];
}

interface CheckPendingRow {
  check_number: string;
  amount: number;
  due_date: string;
  payee_or_payer: string;
}

interface StandingOrderRow {
  payee_name: string;
  amount: number;
  frequency: string;
  day_of_month: number | null;
  next_execution: string | null;
  end_date: string | null;
}

interface CreditCardRow {
  card_name: string;
  last_four_digits: string;
  current_balance: number;
  billing_day: number;
}

interface InvoicePendingRow {
  invoice_number: string;
  client_name: string;
  total: number;
  paid_amount: number | null;
  payment_due_date: string | null;
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function advanceFrequency(date: Date, freq: string): Date {
  const r = new Date(date);
  if (freq === 'weekly') r.setDate(r.getDate() + 7);
  else if (freq === 'monthly') r.setMonth(r.getMonth() + 1);
  else if (freq === 'bimonthly') r.setMonth(r.getMonth() + 2);
  else if (freq === 'quarterly') r.setMonth(r.getMonth() + 3);
  else if (freq === 'yearly') r.setFullYear(r.getFullYear() + 1);
  return r;
}

function findPeriodIndex(
  dateIso: string,
  periods: CashFlowPeriod[],
): number {
  for (let i = 0; i < periods.length; i++) {
    if (dateIso >= periods[i].startDate && dateIso <= periods[i].endDate) {
      return i;
    }
  }
  return -1;
}

function nextCreditCardBilling(billingDay: number, today: Date): Date {
  const clamped = Math.max(1, Math.min(31, billingDay));
  const thisMonth = new Date(
    today.getFullYear(),
    today.getMonth(),
    clamped,
  );
  thisMonth.setHours(0, 0, 0, 0);
  if (thisMonth >= today) return thisMonth;
  return new Date(today.getFullYear(), today.getMonth() + 1, clamped);
}

export const getCashFlowProjection = cache(
  async (tenantId: string, weeks: number): Promise<CashFlowResult> => {
    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = toIso(today);
    const rangeEnd = toIso(addDays(today, weeks * 7 - 1));

    const periods: CashFlowPeriod[] = [];
    for (let i = 0; i < weeks; i++) {
      const s = addDays(today, i * 7);
      const e = addDays(today, i * 7 + 6);
      periods.push({
        index: i,
        startDate: toIso(s),
        endDate: toIso(e),
        incoming: 0,
        outgoing: 0,
        net: 0,
        projectedBalance: 0,
      });
    }

    const [balRow, thresholdRow, outChecks, inChecks, orders, cards, invoices] =
      await Promise.all([
        db.queryOne<{ total: number; cnt: number }>(
          'SELECT COALESCE(SUM(current_balance), 0) AS total, COUNT(*) AS cnt FROM bank_accounts WHERE tenant_id = ? AND is_active = 1',
          [tenantId],
        ),
        db.queryOne<{ value: string }>(
          "SELECT value FROM settings WHERE tenant_id = ? AND key = 'low_balance_alert'",
          [tenantId],
        ),
        db.query<CheckPendingRow>(
          `SELECT check_number, amount, due_date, payee_or_payer
             FROM checks
             WHERE tenant_id = ? AND direction = 'outgoing'
               AND status IN ('pending', 'post_dated')
               AND due_date >= ? AND due_date <= ?`,
          [tenantId, rangeStart, rangeEnd],
        ),
        db.query<CheckPendingRow>(
          `SELECT check_number, amount, due_date, payee_or_payer
             FROM checks
             WHERE tenant_id = ? AND direction = 'incoming'
               AND status IN ('pending', 'post_dated')
               AND due_date >= ? AND due_date <= ?`,
          [tenantId, rangeStart, rangeEnd],
        ),
        db.query<StandingOrderRow>(
          `SELECT payee_name, amount, frequency, day_of_month, next_execution, end_date
             FROM standing_orders
             WHERE tenant_id = ? AND is_active = 1`,
          [tenantId],
        ),
        db.query<CreditCardRow>(
          `SELECT card_name, last_four_digits, current_balance, billing_day
             FROM credit_cards
             WHERE tenant_id = ? AND is_active = 1 AND current_balance > 0`,
          [tenantId],
        ),
        db.query<InvoicePendingRow>(
          `SELECT i.invoice_number, c.name AS client_name, i.total, i.paid_amount, i.payment_due_date
             FROM invoices i
             JOIN clients c ON c.id = i.client_id
             WHERE i.tenant_id = ? AND i.status IN ('sent', 'partial')
               AND i.payment_due_date IS NOT NULL
               AND i.payment_due_date >= ? AND i.payment_due_date <= ?`,
          [tenantId, rangeStart, rangeEnd],
        ),
      ]);

    const currentBalance = Number(balRow?.total ?? 0);
    const accountsCount = Number(balRow?.cnt ?? 0);
    const parsedThreshold = Number((thresholdRow?.value ?? '0').trim());
    const lowBalanceThreshold = Number.isFinite(parsedThreshold)
      ? parsedThreshold
      : 0;

    const items: CashFlowItem[] = [];

    for (let i = 0; i < outChecks.length; i++) {
      const c = outChecks[i];
      const date = c.due_date.slice(0, 10);
      const idx = findPeriodIndex(date, periods);
      if (idx < 0) continue;
      periods[idx].outgoing += c.amount;
      items.push({
        source: 'check_out',
        direction: 'out',
        label: `שיק #${c.check_number} → ${c.payee_or_payer}`,
        amount: c.amount,
        date,
      });
    }

    for (let i = 0; i < inChecks.length; i++) {
      const c = inChecks[i];
      const date = c.due_date.slice(0, 10);
      const idx = findPeriodIndex(date, periods);
      if (idx < 0) continue;
      periods[idx].incoming += c.amount;
      items.push({
        source: 'check_in',
        direction: 'in',
        label: `שיק #${c.check_number} ← ${c.payee_or_payer}`,
        amount: c.amount,
        date,
      });
    }

    const rangeEndDate = addDays(today, weeks * 7 - 1);
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (!o.next_execution) continue;
      const endDate = o.end_date ? new Date(o.end_date) : null;
      let cur = new Date(o.next_execution);
      cur.setHours(0, 0, 0, 0);
      while (cur <= rangeEndDate) {
        if (endDate && cur > endDate) break;
        if (cur >= today) {
          const dateIso = toIso(cur);
          const idx = findPeriodIndex(dateIso, periods);
          if (idx >= 0) {
            periods[idx].outgoing += o.amount;
            items.push({
              source: 'standing_order',
              direction: 'out',
              label: `הוראת קבע: ${o.payee_name}`,
              amount: o.amount,
              date: dateIso,
            });
          }
        }
        cur = advanceFrequency(cur, o.frequency);
      }
    }

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const billingDate = nextCreditCardBilling(card.billing_day, today);
      const dateIso = toIso(billingDate);
      const idx = findPeriodIndex(dateIso, periods);
      if (idx < 0) continue;
      periods[idx].outgoing += card.current_balance;
      items.push({
        source: 'credit_card',
        direction: 'out',
        label: `חיוב כרטיס ${card.card_name} ···· ${card.last_four_digits}`,
        amount: card.current_balance,
        date: dateIso,
      });
    }

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i];
      if (!inv.payment_due_date) continue;
      const remaining = inv.total - (inv.paid_amount ?? 0);
      if (remaining <= 0) continue;
      const dateIso = inv.payment_due_date.slice(0, 10);
      const idx = findPeriodIndex(dateIso, periods);
      if (idx < 0) continue;
      periods[idx].incoming += remaining;
      items.push({
        source: 'invoice',
        direction: 'in',
        label: `חשבונית #${inv.invoice_number} — ${inv.client_name}`,
        amount: remaining,
        date: dateIso,
      });
    }

    let running = currentBalance;
    for (let i = 0; i < periods.length; i++) {
      periods[i].incoming = Math.round(periods[i].incoming * 100) / 100;
      periods[i].outgoing = Math.round(periods[i].outgoing * 100) / 100;
      periods[i].net =
        Math.round((periods[i].incoming - periods[i].outgoing) * 100) / 100;
      running = Math.round((running + periods[i].net) * 100) / 100;
      periods[i].projectedBalance = running;
    }

    items.sort((a, b) => a.date.localeCompare(b.date));

    return {
      currentBalance,
      accountsCount,
      lowBalanceThreshold,
      periods,
      items,
    };
  },
);
