'use server';

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { hashPassword } from '@/lib/auth/password';
import type { Role } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import {
  isForeignKeyError,
  isUniqueConstraintError,
} from '@/lib/db/errors';

const VALID_ROLES: readonly Role[] = [
  'owner',
  'manager',
  'accountant',
  'operator',
  'viewer',
];

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
};

export type UpdateCompanyResult =
  | { success: true }
  | { success: false; error: string };

export type UpdatePricingResult =
  | { success: true }
  | { success: false; error: string };

export type UpdateLabelResult =
  | { success: true }
  | { success: false; error: string };

export type EquipmentTypeMutationResult =
  | { success: true }
  | { success: false; error: string };

export interface UpdateCompanyPayload {
  companyName: string;
  phone?: string;
  address?: string;
  taxId?: string;
  logoBase64?: string | null;
  logoFileName?: string | null;
  removeLogo?: boolean;
}

export interface UpdatePricingPayload {
  clientEquipmentRate: string;
  clientWorkerRate: string;
  defaultWorkerRate: string;
  fuelPrice: string;
  vatRate: string;
}

async function requireOwner(): Promise<
  { tenantId: string; userId: string } | { error: string }
> {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return { error: 'אין הרשאה' };
  if (payload.role !== 'owner') return { error: 'אין הרשאה' };
  return { tenantId: payload.tenantId, userId: payload.userId };
}

function validateLogo(
  logoBase64: string,
  logoFileName: string,
): { base64: string; mime: string } | { error: string } {
  const match = logoFileName.match(/\.(png|jpg|jpeg|svg)$/i);
  const ext = match?.[1].toLowerCase();
  const mime = ext ? EXT_TO_MIME[ext] : undefined;
  if (!mime) {
    return { error: 'סוג קובץ לא נתמך' };
  }
  const buffer = Buffer.from(logoBase64, 'base64');
  if (buffer.length === 0) {
    return { error: 'קובץ הלוגו פגום' };
  }
  if (buffer.length > MAX_LOGO_BYTES) {
    return { error: 'הקובץ גדול מדי' };
  }
  return { base64: logoBase64, mime };
}

export async function updateCompanyAction(
  tenantId: string,
  data: UpdateCompanyPayload,
): Promise<UpdateCompanyResult> {
  const auth = await requireOwner();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const name = data.companyName?.trim() ?? '';
  if (!name) {
    return { success: false, error: 'שם החברה חובה' };
  }

  const db = getDb();

  const updates: Array<[string, string]> = [
    ['company_name', name],
    ['company_phone', (data.phone ?? '').trim()],
    ['company_address', (data.address ?? '').trim()],
    ['company_tax_id', (data.taxId ?? '').trim()],
  ];

  for (let i = 0; i < updates.length; i++) {
    const [key, value] = updates[i];
    await db.run(
      "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = ?",
      [value, tenantId, key],
    );
  }

  if (data.logoBase64 && data.logoFileName) {
    const result = validateLogo(data.logoBase64, data.logoFileName);
    if ('error' in result) {
      return { success: false, error: result.error };
    }
    await db.run(
      "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = 'company_logo_base64'",
      [result.base64, tenantId],
    );
    await db.run(
      "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = 'company_logo_mime'",
      [result.mime, tenantId],
    );
  } else if (data.removeLogo) {
    await db.run(
      "UPDATE settings SET value = '', updated_at = datetime('now') WHERE tenant_id = ? AND key IN ('company_logo_base64', 'company_logo_mime')",
      [tenantId],
    );
  }

  return { success: true };
}

function normalizeNumber(value: string | undefined | null): string {
  if (value == null || value === '') return '0';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '0';
  return String(n);
}

export async function updatePricingAction(
  tenantId: string,
  data: UpdatePricingPayload,
): Promise<UpdatePricingResult> {
  const auth = await requireOwner();
  if ('error' in auth) {
    return { success: false, error: auth.error };
  }
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const db = getDb();

  const clientEquipment = normalizeNumber(data.clientEquipmentRate);
  const clientWorker = normalizeNumber(data.clientWorkerRate);
  const defaultWorker = normalizeNumber(data.defaultWorkerRate);
  const fuel = normalizeNumber(data.fuelPrice);
  const vat = normalizeNumber(data.vatRate);

  const updates: Array<[string, string]> = [
    ['client_equipment_revenue', clientEquipment],
    ['default_equipment_daily_rate', clientEquipment],
    ['client_worker_revenue', clientWorker],
    ['default_worker_daily_rate', defaultWorker],
    ['fuel_price_per_liter', fuel],
    ['vat_rate', vat],
  ];

  for (let i = 0; i < updates.length; i++) {
    const [key, value] = updates[i];
    await db.run(
      "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = ?",
      [value, tenantId, key],
    );
  }

  return { success: true };
}

export async function updateEquipmentLabelAction(
  tenantId: string,
  labelHe: string,
  labelAr: string,
): Promise<UpdateLabelResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const he = labelHe.trim();
  if (!he) {
    return { success: false, error: 'יש למלא שם בעברית' };
  }
  const ar = labelAr.trim();

  const db = getDb();
  await db.run(
    "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = 'equipment_label_he'",
    [he, tenantId],
  );
  await db.run(
    "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = 'equipment_label_ar'",
    [ar, tenantId],
  );

  return { success: true };
}

export async function addEquipmentTypeAction(
  tenantId: string,
  name: string,
): Promise<EquipmentTypeMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const clean = name.trim();
  if (!clean) {
    return { success: false, error: 'יש למלא שם' };
  }

  const db = getDb();
  const maxRow = await db.queryOne<{ max_order: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM equipment_types WHERE tenant_id = ?',
    [tenantId],
  );
  const sortOrder = (maxRow?.max_order ?? -1) + 1;

  await db.run(
    'INSERT INTO equipment_types (tenant_id, name_ar, name_he, sort_order) VALUES (?, ?, ?, ?)',
    [tenantId, clean, clean, sortOrder],
  );

  return { success: true };
}

export async function updateEquipmentTypeAction(
  tenantId: string,
  typeId: string,
  name: string,
): Promise<EquipmentTypeMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const clean = name.trim();
  if (!clean) {
    return { success: false, error: 'יש למלא שם' };
  }
  if (!typeId) {
    return { success: false, error: 'מזהה חסר' };
  }

  const db = getDb();
  const result = await db.run(
    'UPDATE equipment_types SET name_ar = ?, name_he = ? WHERE id = ? AND tenant_id = ?',
    [clean, clean, typeId, tenantId],
  );

  if (result.changes === 0) {
    return { success: false, error: 'הסוג לא נמצא' };
  }

  return { success: true };
}

export async function deleteEquipmentTypeAction(
  tenantId: string,
  typeId: string,
): Promise<EquipmentTypeMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!typeId) {
    return { success: false, error: 'מזהה חסר' };
  }

  const db = getDb();
  try {
    const result = await db.run(
      'DELETE FROM equipment_types WHERE id = ? AND tenant_id = ?',
      [typeId, tenantId],
    );
    if (result.changes === 0) {
      return { success: false, error: 'הסוג לא נמצא' };
    }
    return { success: true };
  } catch (err) {
    if (isForeignKeyError(err)) {
      return {
        success: false,
        error: 'לא ניתן למחוק — הסוג בשימוש בציוד קיים',
      };
    }
    throw err;
  }
}

export type UserMutationResult =
  | { success: true }
  | { success: false; error: string };

export interface AddUserPayload {
  username: string;
  password: string;
  fullName?: string;
  phone?: string;
  email?: string;
  role: Role;
}

export interface UpdateUserPayload {
  fullName?: string;
  phone?: string;
  email?: string;
  role: Role;
}

function normalizeRole(role: unknown): Role | null {
  if (typeof role !== 'string') return null;
  return VALID_ROLES.includes(role as Role) ? (role as Role) : null;
}

function emptyToNull(v: string | undefined): string | null {
  const trimmed = (v ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function addUserAction(
  tenantId: string,
  data: AddUserPayload,
): Promise<UserMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const username = data.username?.trim() ?? '';
  if (!username) {
    return { success: false, error: 'שם משתמש חובה' };
  }
  if (!data.password || data.password.length < 8) {
    return { success: false, error: 'סיסמה חייבת להכיל לפחות 8 תווים' };
  }
  const role = normalizeRole(data.role);
  if (!role) {
    return { success: false, error: 'תפקיד לא חוקי' };
  }

  const hash = await hashPassword(data.password);
  const db = getDb();

  try {
    await db.run(
      'INSERT INTO users (tenant_id, username, password_hash, full_name, phone, email, role, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [
        tenantId,
        username,
        hash,
        (data.fullName ?? '').trim(),
        emptyToNull(data.phone),
        emptyToNull(data.email),
        role,
      ],
    );
  } catch (err) {
    if (isUniqueConstraintError(err, 'username')) {
      return { success: false, error: 'שם המשתמש כבר קיים' };
    }
    throw err;
  }

  return { success: true };
}

export async function updateUserAction(
  tenantId: string,
  userId: string,
  data: UpdateUserPayload,
): Promise<UserMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!userId) {
    return { success: false, error: 'מזהה חסר' };
  }

  const role = normalizeRole(data.role);
  if (!role) {
    return { success: false, error: 'תפקיד לא חוקי' };
  }

  if (userId === auth.userId && role !== 'owner') {
    return {
      success: false,
      error: 'לא ניתן לשנות את התפקיד של עצמך',
    };
  }

  const db = getDb();
  const result = await db.run(
    "UPDATE users SET full_name = ?, phone = ?, email = ?, role = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [
      (data.fullName ?? '').trim(),
      emptyToNull(data.phone),
      emptyToNull(data.email),
      role,
      userId,
      tenantId,
    ],
  );

  if (result.changes === 0) {
    return { success: false, error: 'המשתמש לא נמצא' };
  }

  return { success: true };
}

export async function toggleUserAction(
  tenantId: string,
  userId: string,
): Promise<UserMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!userId) {
    return { success: false, error: 'מזהה חסר' };
  }
  if (userId === auth.userId) {
    return { success: false, error: 'לא ניתן להשבית את החשבון שלך' };
  }

  const db = getDb();
  const result = await db.run(
    "UPDATE users SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [userId, tenantId],
  );

  if (result.changes === 0) {
    return { success: false, error: 'המשתמש לא נמצא' };
  }

  return { success: true };
}

export type ClientMutationResult =
  | { success: true }
  | { success: false; error: string };

export interface ClientPayload {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  equipmentDailyRate?: string;
  workerDailyRate?: string;
  notes?: string;
}

function rateToNullable(v: string | undefined): number | null {
  if (v == null) return null;
  const trimmed = v.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function addClientAction(
  tenantId: string,
  data: ClientPayload,
): Promise<ClientMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const name = data.name?.trim() ?? '';
  if (!name) {
    return { success: false, error: 'שם החברה חובה' };
  }

  const db = getDb();
  await db.run(
    'INSERT INTO clients (tenant_id, name, contact_person, phone, email, address, tax_id, equipment_daily_rate, worker_daily_rate, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      tenantId,
      name,
      emptyToNull(data.contactPerson),
      emptyToNull(data.phone),
      emptyToNull(data.email),
      emptyToNull(data.address),
      emptyToNull(data.taxId),
      rateToNullable(data.equipmentDailyRate),
      rateToNullable(data.workerDailyRate),
      emptyToNull(data.notes),
    ],
  );

  return { success: true };
}

export async function updateClientAction(
  tenantId: string,
  clientId: string,
  data: ClientPayload,
): Promise<ClientMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!clientId) {
    return { success: false, error: 'מזהה חסר' };
  }

  const name = data.name?.trim() ?? '';
  if (!name) {
    return { success: false, error: 'שם החברה חובה' };
  }

  const db = getDb();
  const result = await db.run(
    "UPDATE clients SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, tax_id = ?, equipment_daily_rate = ?, worker_daily_rate = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [
      name,
      emptyToNull(data.contactPerson),
      emptyToNull(data.phone),
      emptyToNull(data.email),
      emptyToNull(data.address),
      emptyToNull(data.taxId),
      rateToNullable(data.equipmentDailyRate),
      rateToNullable(data.workerDailyRate),
      emptyToNull(data.notes),
      clientId,
      tenantId,
    ],
  );

  if (result.changes === 0) {
    return { success: false, error: 'הלקוח לא נמצא' };
  }

  return { success: true };
}

export async function toggleClientAction(
  tenantId: string,
  clientId: string,
): Promise<ClientMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!clientId) {
    return { success: false, error: 'מזהה חסר' };
  }

  const db = getDb();
  const result = await db.run(
    "UPDATE clients SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [clientId, tenantId],
  );

  if (result.changes === 0) {
    return { success: false, error: 'הלקוח לא נמצא' };
  }

  return { success: true };
}

export async function resetPasswordAction(
  tenantId: string,
  userId: string,
  newPassword: string,
): Promise<UserMutationResult> {
  const auth = await requireOwner();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!userId) {
    return { success: false, error: 'מזהה חסר' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'סיסמה חייבת להכיל לפחות 8 תווים' };
  }

  const hash = await hashPassword(newPassword);
  const db = getDb();
  const result = await db.run(
    "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    [hash, userId, tenantId],
  );

  if (result.changes === 0) {
    return { success: false, error: 'המשתמש לא נמצא' };
  }

  return { success: true };
}
