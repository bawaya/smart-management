'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';

export type FuelMutationResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export interface FuelPayload {
  recordDate: string;
  vehicleId: string;
  liters: string;
  pricePerLiter: string;
  odometerReading?: string;
  stationName?: string;
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

function parsePositive(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNegative(v: string | undefined): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function parseOptionalNumber(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

async function validateVehicle(
  tenantId: string,
  vehicleId: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare(
      'SELECT id FROM vehicles WHERE id = ? AND tenant_id = ? AND is_active = 1',
    )
    .bind(vehicleId, tenantId)
    .first<{ id: string }>();
  return row != null;
}

export async function addFuelAction(
  tenantId: string,
  userId: string,
  data: FuelPayload,
): Promise<FuelMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (auth.userId !== userId) return { success: false, error: 'אין הרשאה' };

  const recordDate = normalizeDate(data.recordDate);
  if (!recordDate) return { success: false, error: 'תאריך חובה' };
  if (!data.vehicleId) return { success: false, error: 'רכב חובה' };
  const liters = parsePositive(data.liters);
  if (liters == null) return { success: false, error: 'ליטרים חובה' };

  if (!(await validateVehicle(tenantId, data.vehicleId))) {
    return { success: false, error: 'רכב לא חוקי' };
  }

  const pricePerLiter = parseNonNegative(data.pricePerLiter);
  const totalCost = Math.round(liters * pricePerLiter * 100) / 100;

  const id = generateId();
  const db = getDb();
  await db
    .prepare(
      "INSERT INTO fuel_records (id, tenant_id, record_date, vehicle_id, liters, price_per_liter, total_cost, odometer_reading, station_name, receipt_ref, payment_method, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?, ?)",
    )
    .bind(
      id,
      tenantId,
      recordDate,
      data.vehicleId,
      liters,
      pricePerLiter,
      totalCost,
      parseOptionalNumber(data.odometerReading),
      emptyToNull(data.stationName),
      emptyToNull(data.receiptRef),
      emptyToNull(data.notes),
      auth.userId,
    )
    .run();

  return { success: true, id };
}

export async function updateFuelAction(
  tenantId: string,
  recordId: string,
  data: FuelPayload,
): Promise<FuelMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (!recordId) return { success: false, error: 'מזהה חסר' };

  const recordDate = normalizeDate(data.recordDate);
  if (!recordDate) return { success: false, error: 'תאריך חובה' };
  if (!data.vehicleId) return { success: false, error: 'רכב חובה' };
  const liters = parsePositive(data.liters);
  if (liters == null) return { success: false, error: 'ליטרים חובה' };

  if (!(await validateVehicle(tenantId, data.vehicleId))) {
    return { success: false, error: 'רכב לא חוקי' };
  }

  const pricePerLiter = parseNonNegative(data.pricePerLiter);
  const totalCost = Math.round(liters * pricePerLiter * 100) / 100;

  const db = getDb();
  const result = await db
    .prepare(
      'UPDATE fuel_records SET record_date = ?, vehicle_id = ?, liters = ?, price_per_liter = ?, total_cost = ?, odometer_reading = ?, station_name = ?, receipt_ref = ?, notes = ? WHERE id = ? AND tenant_id = ?',
    )
    .bind(
      recordDate,
      data.vehicleId,
      liters,
      pricePerLiter,
      totalCost,
      parseOptionalNumber(data.odometerReading),
      emptyToNull(data.stationName),
      emptyToNull(data.receiptRef),
      emptyToNull(data.notes),
      recordId,
      tenantId,
    )
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'הרישום לא נמצא' };
  }

  return { success: true, id: recordId };
}

export async function deleteFuelAction(
  tenantId: string,
  recordId: string,
): Promise<FuelMutationResult> {
  const auth = await requireWriter();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId) return { success: false, error: 'אין הרשאה' };
  if (!recordId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const result = await db
    .prepare('DELETE FROM fuel_records WHERE id = ? AND tenant_id = ?')
    .bind(recordId, tenantId)
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'הרישום לא נמצא' };
  }

  return { success: true, id: recordId };
}
