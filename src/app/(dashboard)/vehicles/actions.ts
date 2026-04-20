'use server';

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';

export type VehicleType = 'owned' | 'rented';

const VALID_TYPES: readonly VehicleType[] = ['owned', 'rented'];

export type VehicleMutationResult =
  | { success: true }
  | { success: false; error: string };

export interface VehiclePayload {
  name: string;
  licensePlate: string;
  type: VehicleType;
  annualInsuranceCost?: string;
  annualLicenseCost?: string;
  insuranceExpiry?: string;
  licenseExpiry?: string;
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

const VEHICLE_EDITORS: readonly Role[] = ['owner', 'manager'];

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

function normalizeCost(v: string | undefined | null): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function normalizeType(v: string | undefined): VehicleType {
  if (v && (VALID_TYPES as readonly string[]).includes(v)) {
    return v as VehicleType;
  }
  return 'owned';
}

export async function addVehicleAction(
  tenantId: string,
  data: VehiclePayload,
): Promise<VehicleMutationResult> {
  const auth = await requireRole(VEHICLE_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }

  const name = data.name?.trim() ?? '';
  if (!name) return { success: false, error: 'שם הרכב חובה' };
  const plate = data.licensePlate?.trim() ?? '';
  if (!plate) return { success: false, error: 'לוחית רישוי חובה' };

  const db = getDb();
  await db
    .prepare(
      'INSERT INTO vehicles (tenant_id, name, license_plate, type, annual_insurance_cost, annual_license_cost, insurance_expiry, license_expiry, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      tenantId,
      name,
      plate,
      normalizeType(data.type),
      normalizeCost(data.annualInsuranceCost),
      normalizeCost(data.annualLicenseCost),
      normalizeDate(data.insuranceExpiry),
      normalizeDate(data.licenseExpiry),
      emptyToNull(data.notes),
    )
    .run();

  return { success: true };
}

export async function updateVehicleAction(
  tenantId: string,
  vehicleId: string,
  data: VehiclePayload,
): Promise<VehicleMutationResult> {
  const auth = await requireRole(VEHICLE_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!vehicleId) return { success: false, error: 'מזהה חסר' };

  const name = data.name?.trim() ?? '';
  if (!name) return { success: false, error: 'שם הרכב חובה' };
  const plate = data.licensePlate?.trim() ?? '';
  if (!plate) return { success: false, error: 'לוחית רישוי חובה' };

  const db = getDb();
  const result = await db
    .prepare(
      "UPDATE vehicles SET name = ?, license_plate = ?, type = ?, annual_insurance_cost = ?, annual_license_cost = ?, insurance_expiry = ?, license_expiry = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(
      name,
      plate,
      normalizeType(data.type),
      normalizeCost(data.annualInsuranceCost),
      normalizeCost(data.annualLicenseCost),
      normalizeDate(data.insuranceExpiry),
      normalizeDate(data.licenseExpiry),
      emptyToNull(data.notes),
      vehicleId,
      tenantId,
    )
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'הרכב לא נמצא' };
  }

  return { success: true };
}

export async function toggleVehicleAction(
  tenantId: string,
  vehicleId: string,
): Promise<VehicleMutationResult> {
  const auth = await requireRole(VEHICLE_EDITORS);
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) {
    return { success: false, error: 'אין הרשאה' };
  }
  if (!vehicleId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const result = await db
    .prepare(
      "UPDATE vehicles SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(vehicleId, tenantId)
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'הרכב לא נמצא' };
  }

  return { success: true };
}
