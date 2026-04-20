'use server';

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { getDb, getTenantId } from '@/lib/db';

export interface SetupFormData {
  [key: string]: unknown;
}

export type ChangePasswordResult =
  | { success: true }
  | { success: false; error: string };

export type SaveCompanyResult =
  | { success: true }
  | { success: false; error: string };

export type SaveBusinessResult =
  | { success: true }
  | { success: false; error: string };

export type SavePricingResult =
  | { success: true }
  | { success: false; error: string };

export interface CompanyPayload {
  companyName: string;
  phone?: string;
  address?: string;
  taxId?: string;
  logoBase64?: string | null;
  logoFileName?: string | null;
}

export interface BusinessPayload {
  equipmentLabelHe: string;
  equipmentLabelAr: string;
  types: Array<{ name: string }>;
}

export interface PricingPayload {
  clientEquipmentRate: string;
  clientWorkerRate: string;
  defaultWorkerRate: string;
  fuelPrice: string;
  vatRate: string;
}

const LOGOS_DIR = 'C:\\smart-management\\data\\logos';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_EXTS = new Set(['png', 'jpg', 'jpeg', 'svg']);

export async function completeSetup(
  tenantId: string,
): Promise<{ success: boolean }> {
  if (!tenantId) return { success: false };

  const db = getDb();

  await db
    .prepare(
      "UPDATE settings SET value = 'true', updated_at = datetime('now') WHERE tenant_id = ? AND key = 'is_setup_complete'",
    )
    .bind(tenantId)
    .run();

  await db
    .prepare(
      "UPDATE tenants SET is_setup_complete = 1, updated_at = datetime('now') WHERE id = ?",
    )
    .bind(tenantId)
    .run();

  return { success: true };
}

export async function changePasswordAction(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  if (!userId) {
    return { success: false, error: 'משתמש לא מזוהה' };
  }
  if (!currentPassword || !newPassword) {
    return { success: false, error: 'שדות חסרים' };
  }
  if (newPassword.length < 8) {
    return { success: false, error: 'הסיסמה החדשה קצרה מדי' };
  }

  const db = getDb();
  const tenantId = getTenantId();

  const user = await db
    .prepare(
      'SELECT password_hash FROM users WHERE id = ? AND tenant_id = ? AND is_active = 1',
    )
    .bind(userId, tenantId)
    .first<{ password_hash: string }>();

  if (!user) {
    return { success: false, error: 'משתמש לא נמצא' };
  }

  const ok = await verifyPassword(currentPassword, user.password_hash);
  if (!ok) {
    return { success: false, error: 'הסיסמה הנוכחית שגויה' };
  }

  const newHash = await hashPassword(newPassword);
  await db
    .prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(newHash, userId, tenantId)
    .run();

  return { success: true };
}

function extractExtension(filename: string): string | null {
  const match = filename.match(/\.(png|jpg|jpeg|svg)$/i);
  if (!match) return null;
  return match[1].toLowerCase();
}

async function writeLogo(
  tenantId: string,
  logoBase64: string,
  logoFileName: string,
): Promise<{ path: string } | { error: string }> {
  const ext = extractExtension(logoFileName);
  if (!ext || !ALLOWED_LOGO_EXTS.has(ext)) {
    return { error: 'סוג קובץ לא נתמך' };
  }
  const buffer = Buffer.from(logoBase64, 'base64');
  if (buffer.length === 0) {
    return { error: 'קובץ הלוגו פגום' };
  }
  if (buffer.length > MAX_LOGO_BYTES) {
    return { error: 'הקובץ גדול מדי' };
  }

  await mkdir(LOGOS_DIR, { recursive: true });
  const filePath = join(LOGOS_DIR, `${tenantId}.${ext}`);
  await writeFile(filePath, buffer);
  return { path: filePath };
}

export async function saveCompanyAction(
  tenantId: string,
  data: CompanyPayload,
): Promise<SaveCompanyResult> {
  if (!tenantId) {
    return { success: false, error: 'Tenant לא מזוהה' };
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

  for (const [key, value] of updates) {
    await db
      .prepare(
        "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = ?",
      )
      .bind(value, tenantId, key)
      .run();
  }

  if (data.logoBase64 && data.logoFileName) {
    const result = await writeLogo(
      tenantId,
      data.logoBase64,
      data.logoFileName,
    );
    if ('error' in result) {
      return { success: false, error: result.error };
    }
    await db
      .prepare(
        "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = 'company_logo_path'",
      )
      .bind(result.path, tenantId)
      .run();
  }

  return { success: true };
}

export async function saveBusinessAction(
  tenantId: string,
  data: BusinessPayload,
): Promise<SaveBusinessResult> {
  if (!tenantId) {
    return { success: false, error: 'Tenant לא מזוהה' };
  }
  const labelHe = data.equipmentLabelHe?.trim() ?? '';
  if (!labelHe) {
    return { success: false, error: 'יש למלא שם ציוד בעברית' };
  }
  const labelAr = data.equipmentLabelAr?.trim() ?? '';

  const cleanedTypes = (data.types ?? [])
    .map((t) => ({ name: (t.name ?? '').trim() }))
    .filter((t) => t.name.length > 0);

  if (cleanedTypes.length === 0) {
    return { success: false, error: 'יש להוסיף לפחות סוג ציוד אחד' };
  }

  const db = getDb();

  await db
    .prepare(
      "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = 'equipment_label_he'",
    )
    .bind(labelHe, tenantId)
    .run();

  await db
    .prepare(
      "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = 'equipment_label_ar'",
    )
    .bind(labelAr, tenantId)
    .run();

  await db
    .prepare('DELETE FROM equipment_types WHERE tenant_id = ?')
    .bind(tenantId)
    .run();

  for (let i = 0; i < cleanedTypes.length; i++) {
    const type = cleanedTypes[i];
    await db
      .prepare(
        'INSERT INTO equipment_types (tenant_id, name_ar, name_he, sort_order) VALUES (?, ?, ?, ?)',
      )
      .bind(tenantId, type.name, type.name, i)
      .run();
  }

  return { success: true };
}

function normalizeNumber(value: string | undefined | null): string {
  if (value == null || value === '') return '0';
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '0';
  return String(n);
}

export async function savePricingAction(
  tenantId: string,
  data: PricingPayload,
): Promise<SavePricingResult> {
  if (!tenantId) {
    return { success: false, error: 'Tenant לא מזוהה' };
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
    await db
      .prepare(
        "UPDATE settings SET value = ?, updated_at = datetime('now') WHERE tenant_id = ? AND key = ?",
      )
      .bind(value, tenantId, key)
      .run();
  }

  return { success: true };
}
