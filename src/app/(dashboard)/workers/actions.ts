'use server';

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';

export type WorkerMutationResult =
  | { success: true }
  | { success: false; error: string };

export interface WorkerPayload {
  fullName: string;
  idNumber?: string;
  phone?: string;
  dailyRate?: string;
  notes?: string;
}

async function requireRole(
  allowed: readonly Role[],
): Promise<{ tenantId: string; userId: string; role: Role } | { error: string }> {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return { error: 'אין הרשאה' };
  const role = payload.role as Role;
  if (!allowed.includes(role)) return { error: 'אין הרשאה' };
  return { tenantId: payload.tenantId, userId: payload.userId, role };
}

const WORKER_EDITORS: readonly Role[] = ['owner', 'manager'];
const DUPLICATE_ID_ERROR = 'תעודת הזהות כבר קיימת במערכת';

function emptyToNull(v: string | undefined | null): string | null {
  const trimmed = (v ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function rateToNullable(v: string | undefined | null): number | null {
  if (v == null) return null;
  const trimmed = v.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function isUniqueConstraintError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (!e?.code?.startsWith('SQLITE_CONSTRAINT')) return false;
  return (e.message ?? '').toLowerCase().includes('id_number');
}

export async function addWorkerAction(
  tenantId: string,
  data: WorkerPayload,
): Promise<WorkerMutationResult> {
  const auth = await requireRole(WORKER_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const fullName = data.fullName?.trim() ?? '';
  if (!fullName) return { success: false, error: 'שם מלא חובה' };

  const db = getDb();
  try {
    await db.run(
      'INSERT INTO workers (tenant_id, full_name, id_number, phone, daily_rate, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [
        tenantId,
        fullName,
        emptyToNull(data.idNumber),
        emptyToNull(data.phone),
        rateToNullable(data.dailyRate),
        emptyToNull(data.notes),
      ],
    );
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { success: false, error: DUPLICATE_ID_ERROR };
    }
    throw err;
  }

  return { success: true };
}

export async function updateWorkerAction(
  tenantId: string,
  workerId: string,
  data: WorkerPayload,
): Promise<WorkerMutationResult> {
  const auth = await requireRole(WORKER_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!workerId) return { success: false, error: 'מזהה חסר' };

  const fullName = data.fullName?.trim() ?? '';
  if (!fullName) return { success: false, error: 'שם מלא חובה' };

  const db = getDb();
  try {
    const result = await db.run(
      "UPDATE workers SET full_name = ?, id_number = ?, phone = ?, daily_rate = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
      [
        fullName,
        emptyToNull(data.idNumber),
        emptyToNull(data.phone),
        rateToNullable(data.dailyRate),
        emptyToNull(data.notes),
        workerId,
        tenantId,
      ],
    );

    if (result.changes === 0) {
      return { success: false, error: 'העובד לא נמצא' };
    }
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return { success: false, error: DUPLICATE_ID_ERROR };
    }
    throw err;
  }

  return { success: true };
}

export async function toggleWorkerAction(
  tenantId: string,
  workerId: string,
): Promise<WorkerMutationResult> {
  const auth = await requireRole(WORKER_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!workerId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const result = await db.run(
    "UPDATE workers SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [workerId, tenantId],
  );

  if (result.changes === 0) {
    return { success: false, error: 'העובד לא נמצא' };
  }

  return { success: true };
}
