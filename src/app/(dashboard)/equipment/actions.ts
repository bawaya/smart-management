'use server';

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';

export type EquipmentStatus =
  | 'available'
  | 'deployed'
  | 'maintenance'
  | 'retired';

const VALID_STATUSES: readonly EquipmentStatus[] = [
  'available',
  'deployed',
  'maintenance',
  'retired',
];

export type EquipmentMutationResult =
  | { success: true }
  | { success: false; error: string };

export interface EquipmentPayload {
  name: string;
  equipmentTypeId: string;
  identifier?: string;
  status?: EquipmentStatus;
  insuranceExpiry?: string;
  licenseExpiry?: string;
  lastMaintenance?: string;
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

const EQUIPMENT_EDITORS: readonly Role[] = ['owner', 'manager'];

function emptyToNull(v: string | undefined | null): string | null {
  const trimmed = (v ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDate(v: string | undefined | null): string | null {
  const s = emptyToNull(v);
  if (!s) return null;
  const date = new Date(s);
  if (Number.isNaN(date.getTime())) return null;
  return s.slice(0, 10);
}

function normalizeStatus(v: string | undefined): EquipmentStatus {
  if (v && (VALID_STATUSES as readonly string[]).includes(v)) {
    return v as EquipmentStatus;
  }
  return 'available';
}

async function assertTypeBelongsToTenant(
  tenantId: string,
  typeId: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db.queryOne<{ id: string }>(
    'SELECT id FROM equipment_types WHERE id = ? AND tenant_id = ? AND is_active = 1',
    [typeId, tenantId],
  );
  return row != null;
}

export async function addEquipmentAction(
  tenantId: string,
  data: EquipmentPayload,
): Promise<EquipmentMutationResult> {
  const auth = await requireRole(EQUIPMENT_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const name = data.name?.trim() ?? '';
  if (!name) return { success: false, error: 'שם חובה' };
  const typeId = data.equipmentTypeId?.trim() ?? '';
  if (!typeId) return { success: false, error: 'יש לבחור סוג' };
  if (!(await assertTypeBelongsToTenant(tenantId, typeId))) {
    return { success: false, error: 'סוג לא חוקי' };
  }

  const db = getDb();
  await db.run(
    'INSERT INTO equipment (tenant_id, name, equipment_type_id, identifier, status, insurance_expiry, license_expiry, last_maintenance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      tenantId,
      name,
      typeId,
      emptyToNull(data.identifier),
      normalizeStatus(data.status),
      normalizeDate(data.insuranceExpiry),
      normalizeDate(data.licenseExpiry),
      normalizeDate(data.lastMaintenance),
      emptyToNull(data.notes),
    ],
  );

  return { success: true };
}

export async function updateEquipmentAction(
  tenantId: string,
  equipmentId: string,
  data: EquipmentPayload,
): Promise<EquipmentMutationResult> {
  const auth = await requireRole(EQUIPMENT_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!equipmentId) return { success: false, error: 'מזהה חסר' };

  const name = data.name?.trim() ?? '';
  if (!name) return { success: false, error: 'שם חובה' };
  const typeId = data.equipmentTypeId?.trim() ?? '';
  if (!typeId) return { success: false, error: 'יש לבחור סוג' };
  if (!(await assertTypeBelongsToTenant(tenantId, typeId))) {
    return { success: false, error: 'סוג לא חוקי' };
  }

  const db = getDb();
  const result = await db.run(
    "UPDATE equipment SET name = ?, equipment_type_id = ?, identifier = ?, status = ?, insurance_expiry = ?, license_expiry = ?, last_maintenance = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [
      name,
      typeId,
      emptyToNull(data.identifier),
      normalizeStatus(data.status),
      normalizeDate(data.insuranceExpiry),
      normalizeDate(data.licenseExpiry),
      normalizeDate(data.lastMaintenance),
      emptyToNull(data.notes),
      equipmentId,
      tenantId,
    ],
  );

  if (result.changes === 0) {
    return { success: false, error: 'הפריט לא נמצא' };
  }

  return { success: true };
}

export async function updateEquipmentStatusAction(
  tenantId: string,
  equipmentId: string,
  newStatus: string,
): Promise<EquipmentMutationResult> {
  const auth = await requireRole(EQUIPMENT_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!equipmentId) return { success: false, error: 'מזהה חסר' };
  if (!(VALID_STATUSES as readonly string[]).includes(newStatus)) {
    return { success: false, error: 'סטטוס לא חוקי' };
  }

  const db = getDb();
  const result = await db.run(
    "UPDATE equipment SET status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [newStatus, equipmentId, tenantId],
  );

  if (result.changes === 0) {
    return { success: false, error: 'הפריט לא נמצא' };
  }

  return { success: true };
}
