'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'partial'
  | 'cancelled';

const VALID_STATUSES: readonly InvoiceStatus[] = [
  'draft',
  'sent',
  'paid',
  'partial',
  'cancelled',
];

export interface InvoiceSummary {
  equipmentDays: number;
  equipmentRevenue: number;
  workerDays: number;
  workersRevenue: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  logIds: string[];
}

export type SearchLogsResult =
  | { success: true; summary: InvoiceSummary }
  | { success: false; error: string };

export type InvoiceMutationResult =
  | { success: true; id?: string }
  | { success: false; error: string };

const INVOICE_ROLES: readonly Role[] = ['owner', 'accountant'];

async function requireInvoiceRole(): Promise<
  { tenantId: string; userId: string; role: Role } | { error: string }
> {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return { error: 'אין הרשאה' };
  const role = payload.role as Role;
  if (!INVOICE_ROLES.includes(role)) return { error: 'אין הרשאה' };
  return { tenantId: payload.tenantId, userId: payload.userId, role };
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

function normalizeDate(v: string | undefined | null): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return s.slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface SummaryAgg {
  days: number;
  rev: number;
}

async function computeSummary(
  tenantId: string,
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<InvoiceSummary> {
  const db = getDb();
  const [eqRow, workersRow, logRows, vatRow] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS days, COALESCE(SUM(equipment_revenue), 0) AS rev
         FROM daily_logs
         WHERE tenant_id = ? AND client_id = ? AND status = 'confirmed'
           AND log_date >= ? AND log_date <= ?`,
      )
      .bind(tenantId, clientId, periodStart, periodEnd)
      .first<SummaryAgg>(),
    db
      .prepare(
        `SELECT COUNT(wa.id) AS days, COALESCE(SUM(wa.revenue), 0) AS rev
         FROM worker_assignments wa
         JOIN daily_logs dl ON dl.id = wa.daily_log_id
         WHERE dl.tenant_id = ? AND dl.client_id = ? AND dl.status = 'confirmed'
           AND dl.log_date >= ? AND dl.log_date <= ?`,
      )
      .bind(tenantId, clientId, periodStart, periodEnd)
      .first<SummaryAgg>(),
    db
      .prepare(
        `SELECT id FROM daily_logs
         WHERE tenant_id = ? AND client_id = ? AND status = 'confirmed'
           AND log_date >= ? AND log_date <= ?`,
      )
      .bind(tenantId, clientId, periodStart, periodEnd)
      .all<{ id: string }>(),
    db
      .prepare(
        "SELECT value FROM settings WHERE tenant_id = ? AND key = 'vat_rate'",
      )
      .bind(tenantId)
      .first<{ value: string }>(),
  ]);

  const equipmentDays = Number(eqRow?.days ?? 0);
  const equipmentRevenue = Number(eqRow?.rev ?? 0);
  const workerDays = Number(workersRow?.days ?? 0);
  const workersRevenue = Number(workersRow?.rev ?? 0);
  const subtotal = equipmentRevenue + workersRevenue;
  const vatParsed = Number((vatRow?.value ?? '17').trim());
  const vatRate =
    Number.isFinite(vatParsed) && vatParsed >= 0 ? vatParsed : 17;
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);

  return {
    equipmentDays,
    equipmentRevenue: round2(equipmentRevenue),
    workerDays,
    workersRevenue: round2(workersRevenue),
    subtotal: round2(subtotal),
    vatRate,
    vatAmount,
    total,
    logIds: logRows.map((r) => r.id),
  };
}

async function clientBelongsToTenant(
  tenantId: string,
  clientId: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare('SELECT id FROM clients WHERE id = ? AND tenant_id = ?')
    .bind(clientId, tenantId)
    .first<{ id: string }>();
  return row != null;
}

export async function searchLogsForInvoiceAction(
  tenantId: string,
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<SearchLogsResult> {
  const auth = await requireInvoiceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };

  const start = normalizeDate(periodStart);
  const end = normalizeDate(periodEnd);
  if (!start || !end) return { success: false, error: 'תאריכים לא חוקיים' };
  if (start > end)
    return { success: false, error: 'תאריך התחלה מאוחר מתאריך סיום' };

  if (!(await clientBelongsToTenant(tenantId, clientId))) {
    return { success: false, error: 'לקוח לא חוקי' };
  }

  const summary = await computeSummary(tenantId, clientId, start, end);
  return { success: true, summary };
}

async function nextInvoiceNumber(
  tenantId: string,
  yyyymm: string,
): Promise<string> {
  const db = getDb();
  const row = await db
    .prepare(
      'SELECT COUNT(*) AS c FROM invoices WHERE tenant_id = ? AND invoice_number LIKE ?',
    )
    .bind(tenantId, `INV-${yyyymm}-%`)
    .first<{ c: number }>();
  const n = Number(row?.c ?? 0) + 1;
  return `INV-${yyyymm}-${String(n).padStart(3, '0')}`;
}

export async function generateInvoiceAction(
  tenantId: string,
  userId: string,
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<InvoiceMutationResult> {
  const auth = await requireInvoiceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (auth.userId !== userId) return { success: false, error: 'אין הרשאה' };

  const start = normalizeDate(periodStart);
  const end = normalizeDate(periodEnd);
  if (!start || !end) return { success: false, error: 'תאריכים לא חוקיים' };
  if (start > end)
    return { success: false, error: 'תאריך התחלה מאוחר מתאריך סיום' };

  if (!(await clientBelongsToTenant(tenantId, clientId))) {
    return { success: false, error: 'לקוח לא חוקי' };
  }

  const summary = await computeSummary(tenantId, clientId, start, end);
  if (summary.logIds.length === 0) {
    return { success: false, error: 'לא נמצאו רישומים מאושרים בתקופה זו' };
  }

  const yyyymm = start.slice(0, 7).replace('-', '');
  const invoiceNumber = await nextInvoiceNumber(tenantId, yyyymm);
  const invoiceId = generateId();
  const placeholders = summary.logIds.map(() => '?').join(', ');

  const db = getDb();
  await db.exec('BEGIN');
  try {
    await db
      .prepare(
        `INSERT INTO invoices (
           id, tenant_id, invoice_number, client_id, period_start, period_end,
           total_equipment_days, total_equipment_revenue,
           total_worker_days, total_worker_revenue,
           subtotal, vat_rate, vat_amount, total,
           status, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      )
      .bind(
        invoiceId,
        tenantId,
        invoiceNumber,
        clientId,
        start,
        end,
        summary.equipmentDays,
        summary.equipmentRevenue,
        summary.workerDays,
        summary.workersRevenue,
        summary.subtotal,
        summary.vatRate,
        summary.vatAmount,
        summary.total,
        auth.userId,
      )
      .run();

    const logs = await db
      .prepare(
        `SELECT dl.id, dl.log_date, dl.equipment_revenue,
                e.name AS equipment_name
         FROM daily_logs dl
         JOIN equipment e ON e.id = dl.equipment_id
         WHERE dl.id IN (${placeholders})`,
      )
      .bind(...summary.logIds)
      .all<{
        id: string;
        log_date: string;
        equipment_revenue: number;
        equipment_name: string;
      }>();

    const assignments = await db
      .prepare(
        `SELECT wa.daily_log_id, wa.revenue,
                w.full_name AS worker_name, dl.log_date
         FROM worker_assignments wa
         JOIN daily_logs dl ON dl.id = wa.daily_log_id
         JOIN workers w ON w.id = wa.worker_id
         WHERE wa.daily_log_id IN (${placeholders})`,
      )
      .bind(...summary.logIds)
      .all<{
        daily_log_id: string;
        revenue: number;
        worker_name: string;
        log_date: string;
      }>();

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      if (log.equipment_revenue > 0) {
        await db
          .prepare(
            `INSERT INTO invoice_items
               (id, tenant_id, invoice_id, daily_log_id, item_type, description, quantity, unit_price, total)
             VALUES (?, ?, ?, ?, 'equipment', ?, 1, ?, ?)`,
          )
          .bind(
            generateId(),
            tenantId,
            invoiceId,
            log.id,
            `${log.equipment_name} - ${log.log_date}`,
            log.equipment_revenue,
            log.equipment_revenue,
          )
          .run();
      }
    }

    for (let i = 0; i < assignments.length; i++) {
      const a = assignments[i];
      await db
        .prepare(
          `INSERT INTO invoice_items
             (id, tenant_id, invoice_id, daily_log_id, item_type, description, quantity, unit_price, total)
           VALUES (?, ?, ?, ?, 'worker', ?, 1, ?, ?)`,
        )
        .bind(
          generateId(),
          tenantId,
          invoiceId,
          a.daily_log_id,
          `${a.worker_name} - ${a.log_date}`,
          a.revenue,
          a.revenue,
        )
        .run();
    }

    await db
      .prepare(
        `UPDATE daily_logs SET status = 'invoiced', updated_at = datetime('now')
         WHERE id IN (${placeholders}) AND tenant_id = ?`,
      )
      .bind(...summary.logIds, tenantId)
      .run();

    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  return { success: true, id: invoiceId };
}

export async function updateInvoiceStatusAction(
  tenantId: string,
  invoiceId: string,
  newStatus: InvoiceStatus,
): Promise<InvoiceMutationResult> {
  const auth = await requireInvoiceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!invoiceId) return { success: false, error: 'מזהה חסר' };
  if (!VALID_STATUSES.includes(newStatus)) {
    return { success: false, error: 'סטטוס לא חוקי' };
  }

  const db = getDb();

  if (newStatus === 'cancelled') {
    await db.exec('BEGIN');
    try {
      const items = await db
        .prepare(
          'SELECT DISTINCT daily_log_id FROM invoice_items WHERE invoice_id = ? AND tenant_id = ?',
        )
        .bind(invoiceId, tenantId)
        .all<{ daily_log_id: string }>();

      const result = await db
        .prepare(
          "UPDATE invoices SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
        )
        .bind(invoiceId, tenantId)
        .run();

      if (result.changes === 0) {
        await db.exec('ROLLBACK');
        return { success: false, error: 'חשבונית לא נמצאה' };
      }

      if (items.length > 0) {
        const ids = items.map((r) => r.daily_log_id);
        const placeholders = ids.map(() => '?').join(', ');
        await db
          .prepare(
            `UPDATE daily_logs SET status = 'confirmed', updated_at = datetime('now')
             WHERE id IN (${placeholders}) AND tenant_id = ?`,
          )
          .bind(...ids, tenantId)
          .run();
      }

      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
    return { success: true };
  }

  const result = await db
    .prepare(
      "UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(newStatus, invoiceId, tenantId)
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'חשבונית לא נמצאה' };
  }

  return { success: true };
}

export async function recordPaymentAction(
  tenantId: string,
  invoiceId: string,
  amount: string,
  paymentDate: string,
): Promise<InvoiceMutationResult> {
  const auth = await requireInvoiceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!invoiceId) return { success: false, error: 'מזהה חסר' };

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return { success: false, error: 'סכום לא חוקי' };
  }

  const paidDate = normalizeDate(paymentDate);
  if (!paidDate) return { success: false, error: 'תאריך לא חוקי' };

  const db = getDb();
  const invoice = await db
    .prepare(
      'SELECT total, paid_amount, status FROM invoices WHERE id = ? AND tenant_id = ?',
    )
    .bind(invoiceId, tenantId)
    .first<{ total: number; paid_amount: number | null; status: string }>();

  if (!invoice) return { success: false, error: 'חשבונית לא נמצאה' };
  if (invoice.status === 'cancelled')
    return { success: false, error: 'החשבונית בוטלה' };

  const newPaid = round2((invoice.paid_amount ?? 0) + amt);
  const isFull = newPaid >= invoice.total - 0.01;
  const newStatus: InvoiceStatus = isFull ? 'paid' : 'partial';

  await db
    .prepare(
      "UPDATE invoices SET paid_amount = ?, paid_date = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(newPaid, paidDate, newStatus, invoiceId, tenantId)
    .run();

  return { success: true };
}
