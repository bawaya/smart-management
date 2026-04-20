'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb, type BatchStatement } from '@/lib/db';

export type DailyLogMutationResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export interface AssignmentInput {
  workerId: string;
  dailyRate: string;
  revenue: string;
}

export interface DailyLogPayload {
  logDate: string;
  clientId: string;
  equipmentId: string;
  vehicleId?: string;
  location?: string;
  projectName?: string;
  equipmentRevenue: string;
  notes?: string;
  assignments: AssignmentInput[];
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

function normalizeAmount(v: string | undefined | null): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function normalizeDate(v: string | undefined | null): string | null {
  const s = emptyToNull(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return s.slice(0, 10);
}

async function validateRefs(
  tenantId: string,
  data: DailyLogPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = getDb();
  const client = await db.queryOne<{ id: string }>(
    'SELECT id FROM clients WHERE id = ? AND tenant_id = ? AND is_active = 1',
    [data.clientId, tenantId],
  );
  if (!client) return { ok: false, error: 'לקוח לא חוקי' };

  const equipment = await db.queryOne<{ id: string }>(
    'SELECT id FROM equipment WHERE id = ? AND tenant_id = ? AND is_active = 1',
    [data.equipmentId, tenantId],
  );
  if (!equipment) return { ok: false, error: 'ציוד לא חוקי' };

  if (data.vehicleId) {
    const vehicle = await db.queryOne<{ id: string }>(
      'SELECT id FROM vehicles WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [data.vehicleId, tenantId],
    );
    if (!vehicle) return { ok: false, error: 'רכב לא חוקי' };
  }

  const validAssignments = data.assignments.filter(
    (a) => a.workerId && a.workerId.trim().length > 0,
  );
  if (validAssignments.length > 0) {
    const seen = new Set<string>();
    for (let i = 0; i < validAssignments.length; i++) {
      const id = validAssignments[i].workerId;
      if (seen.has(id)) return { ok: false, error: 'עובד משוכפל' };
      seen.add(id);
    }
    const placeholders = validAssignments.map(() => '?').join(', ');
    const rows = await db.query<{ id: string }>(
      `SELECT id FROM workers WHERE tenant_id = ? AND is_active = 1 AND id IN (${placeholders})`,
      [tenantId, ...validAssignments.map((a) => a.workerId)],
    );
    if (rows.length !== validAssignments.length) {
      return { ok: false, error: 'עובד לא חוקי' };
    }
  }

  return { ok: true };
}

function buildAssignmentStatements(
  tenantId: string,
  logId: string,
  assignments: AssignmentInput[],
): BatchStatement[] {
  const out: BatchStatement[] = [];
  for (const a of assignments) {
    if (!a.workerId || !a.workerId.trim()) continue;
    out.push({
      sql: 'INSERT INTO worker_assignments (id, tenant_id, daily_log_id, worker_id, daily_rate, revenue) VALUES (?, ?, ?, ?, ?, ?)',
      params: [
        generateId(),
        tenantId,
        logId,
        a.workerId,
        normalizeAmount(a.dailyRate),
        normalizeAmount(a.revenue),
      ],
    });
  }
  return out;
}

export async function addDailyLogAction(
  tenantId: string,
  userId: string,
  data: DailyLogPayload,
): Promise<DailyLogMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (auth.userId !== userId) return { success: false, error: 'אין הרשאה' };

  const logDate = normalizeDate(data.logDate);
  if (!logDate) return { success: false, error: 'תאריך חובה' };
  if (!data.clientId) return { success: false, error: 'לקוח חובה' };
  if (!data.equipmentId) return { success: false, error: 'ציוד חובה' };

  const check = await validateRefs(tenantId, data);
  if (!check.ok) return { success: false, error: check.error };

  const logId = generateId();
  const db = getDb();

  await db.batch([
    {
      sql: 'INSERT INTO daily_logs (id, tenant_id, log_date, client_id, equipment_id, vehicle_id, location, project_name, equipment_revenue, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      params: [
        logId,
        tenantId,
        logDate,
        data.clientId,
        data.equipmentId,
        emptyToNull(data.vehicleId),
        emptyToNull(data.location),
        emptyToNull(data.projectName),
        normalizeAmount(data.equipmentRevenue),
        emptyToNull(data.notes),
        'draft',
        userId,
      ],
    },
    ...buildAssignmentStatements(tenantId, logId, data.assignments),
  ]);

  return { success: true, id: logId };
}

export async function updateDailyLogAction(
  tenantId: string,
  logId: string,
  data: DailyLogPayload,
): Promise<DailyLogMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (!logId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const existing = await db.queryOne<{ status: string; created_by: string }>(
    'SELECT status, created_by FROM daily_logs WHERE id = ? AND tenant_id = ?',
    [logId, tenantId],
  );

  if (!existing) return { success: false, error: 'הרישום לא נמצא' };
  if (existing.status !== 'draft') {
    return { success: false, error: 'ניתן לערוך רק טיוטה' };
  }
  if (auth.role === 'operator' && existing.created_by !== auth.userId) {
    return { success: false, error: 'אין הרשאה לערוך רישום של אחר' };
  }

  const logDate = normalizeDate(data.logDate);
  if (!logDate) return { success: false, error: 'תאריך חובה' };
  if (!data.clientId) return { success: false, error: 'לקוח חובה' };
  if (!data.equipmentId) return { success: false, error: 'ציוד חובה' };

  const check = await validateRefs(tenantId, data);
  if (!check.ok) return { success: false, error: check.error };

  await db.batch([
    {
      sql: "UPDATE daily_logs SET log_date = ?, client_id = ?, equipment_id = ?, vehicle_id = ?, location = ?, project_name = ?, equipment_revenue = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
      params: [
        logDate,
        data.clientId,
        data.equipmentId,
        emptyToNull(data.vehicleId),
        emptyToNull(data.location),
        emptyToNull(data.projectName),
        normalizeAmount(data.equipmentRevenue),
        emptyToNull(data.notes),
        logId,
        tenantId,
      ],
    },
    {
      sql: 'DELETE FROM worker_assignments WHERE daily_log_id = ?',
      params: [logId],
    },
    ...buildAssignmentStatements(tenantId, logId, data.assignments),
  ]);

  return { success: true, id: logId };
}

export async function confirmLogAction(
  tenantId: string,
  logId: string,
): Promise<DailyLogMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (!logId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const existing = await db.queryOne<{ status: string; created_by: string }>(
    'SELECT status, created_by FROM daily_logs WHERE id = ? AND tenant_id = ?',
    [logId, tenantId],
  );

  if (!existing) return { success: false, error: 'הרישום לא נמצא' };
  if (existing.status !== 'draft') {
    return { success: false, error: 'ניתן לאשר רק טיוטה' };
  }
  if (auth.role === 'operator' && existing.created_by !== auth.userId) {
    return { success: false, error: 'אין הרשאה לאשר רישום של אחר' };
  }

  const result = await db.run(
    "UPDATE daily_logs SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND tenant_id = ? AND status = 'draft'",
    [logId, tenantId],
  );

  if (result.changes === 0) {
    return { success: false, error: 'הרישום לא נמצא' };
  }

  return { success: true, id: logId };
}
