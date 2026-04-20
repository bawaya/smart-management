'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';

export const VALID_CATEGORIES = [
  'fuel',
  'vehicle_insurance',
  'vehicle_license',
  'vehicle_maintenance',
  'vehicle_rental',
  'equipment_maintenance',
  'worker_payment',
  'office',
  'phone',
  'internet',
  'other',
] as const;

export type ExpenseCategory = (typeof VALID_CATEGORIES)[number];

export type ExpenseMutationResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export interface ExpensePayload {
  expenseDate: string;
  category: string;
  amount: string;
  description?: string;
  vehicleId?: string;
  equipmentId?: string;
  workerId?: string;
  receiptRef?: string;
  notes?: string;
}

const WRITE_ROLES: readonly Role[] = ['owner', 'manager', 'operator'];

async function requireWriter(): Promise<
  { tenantId: string; userId: string; role: Role } | { error: string }
> {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return { error: 'אין הרשאה' };
  const role = payload.role as Role;
  if (!WRITE_ROLES.includes(role)) return { error: 'אין הרשאה' };
  return { tenantId: payload.tenantId, userId: payload.userId, role };
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

function emptyToNull(v: string | undefined | null): string | null {
  const trimmed = (v ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(v: string | undefined | null): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return s.slice(0, 10);
}

function parsePositiveAmount(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function normalizeCategory(v: string): ExpenseCategory | null {
  if ((VALID_CATEGORIES as readonly string[]).includes(v)) {
    return v as ExpenseCategory;
  }
  return null;
}

async function assertBelongsToTenant(
  tenantId: string,
  table: 'vehicles' | 'equipment' | 'workers',
  id: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db.queryOne<{ id: string }>(
    `SELECT id FROM ${table} WHERE id = ? AND tenant_id = ?`,
    [id, tenantId],
  );
  return row != null;
}

async function validateLinkages(
  tenantId: string,
  data: ExpensePayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (data.vehicleId && data.vehicleId.trim()) {
    if (!(await assertBelongsToTenant(tenantId, 'vehicles', data.vehicleId))) {
      return { ok: false, error: 'רכב לא חוקי' };
    }
  }
  if (data.equipmentId && data.equipmentId.trim()) {
    if (!(await assertBelongsToTenant(tenantId, 'equipment', data.equipmentId))) {
      return { ok: false, error: 'ציוד לא חוקי' };
    }
  }
  if (data.workerId && data.workerId.trim()) {
    if (!(await assertBelongsToTenant(tenantId, 'workers', data.workerId))) {
      return { ok: false, error: 'עובד לא חוקי' };
    }
  }
  return { ok: true };
}

export async function addExpenseAction(
  tenantId: string,
  userId: string,
  data: ExpensePayload,
): Promise<ExpenseMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (auth.userId !== userId) return { success: false, error: 'אין הרשאה' };

  const expenseDate = normalizeDate(data.expenseDate);
  if (!expenseDate) return { success: false, error: 'תאריך חובה' };

  const category = normalizeCategory(data.category);
  if (!category) return { success: false, error: 'קטגוריה לא חוקית' };

  const amount = parsePositiveAmount(data.amount);
  if (amount == null) return { success: false, error: 'יש להזין סכום גדול מ-0' };

  const check = await validateLinkages(tenantId, data);
  if (!check.ok) return { success: false, error: check.error };

  const id = generateId();
  const db = getDb();
  await db.run(
    "INSERT INTO expenses (id, tenant_id, expense_date, category, amount, description, vehicle_id, equipment_id, worker_id, payment_method, receipt_ref, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?, ?, ?)",
    [
      id,
      tenantId,
      expenseDate,
      category,
      amount,
      emptyToNull(data.description),
      emptyToNull(data.vehicleId),
      emptyToNull(data.equipmentId),
      emptyToNull(data.workerId),
      emptyToNull(data.receiptRef),
      emptyToNull(data.notes),
      auth.userId,
    ],
  );

  return { success: true, id };
}

export async function updateExpenseAction(
  tenantId: string,
  expenseId: string,
  data: ExpensePayload,
): Promise<ExpenseMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (!expenseId) return { success: false, error: 'מזהה חסר' };

  const expenseDate = normalizeDate(data.expenseDate);
  if (!expenseDate) return { success: false, error: 'תאריך חובה' };

  const category = normalizeCategory(data.category);
  if (!category) return { success: false, error: 'קטגוריה לא חוקית' };

  const amount = parsePositiveAmount(data.amount);
  if (amount == null) return { success: false, error: 'יש להזין סכום גדול מ-0' };

  const check = await validateLinkages(tenantId, data);
  if (!check.ok) return { success: false, error: check.error };

  const db = getDb();
  const result = await db.run(
    'UPDATE expenses SET expense_date = ?, category = ?, amount = ?, description = ?, vehicle_id = ?, equipment_id = ?, worker_id = ?, receipt_ref = ?, notes = ? WHERE id = ? AND tenant_id = ?',
    [
      expenseDate,
      category,
      amount,
      emptyToNull(data.description),
      emptyToNull(data.vehicleId),
      emptyToNull(data.equipmentId),
      emptyToNull(data.workerId),
      emptyToNull(data.receiptRef),
      emptyToNull(data.notes),
      expenseId,
      tenantId,
    ],
  );

  if (result.changes === 0) {
    return { success: false, error: 'הרישום לא נמצא' };
  }

  return { success: true, id: expenseId };
}

export async function deleteExpenseAction(
  tenantId: string,
  expenseId: string,
): Promise<ExpenseMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (!expenseId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const result = await db.run(
    'DELETE FROM expenses WHERE id = ? AND tenant_id = ?',
    [expenseId, tenantId],
  );

  if (result.changes === 0) {
    return { success: false, error: 'הרישום לא נמצא' };
  }

  return { success: true, id: expenseId };
}
