import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import {
  FuelManager,
  type FuelRecordRow,
  type VehicleOption,
} from './FuelManager';

interface SettingRow {
  value: string;
}

export default async function FuelPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userId = requestHeaders.get('x-user-id') ?? '';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'daily_log.write')) {
    redirect('/');
  }

  const db = getDb();

  const priceRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'fuel_price_per_liter'",
    [tenantId],
  );

  const parsed = Number((priceRow?.value ?? '').trim());
  const defaultFuelPrice =
    Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const records = await db.query<FuelRecordRow>(
    `SELECT
         fr.id, fr.record_date, fr.vehicle_id, fr.liters, fr.price_per_liter,
         fr.total_cost, fr.odometer_reading, fr.station_name, fr.receipt_ref,
         fr.notes, fr.created_by,
         v.name AS vehicle_name, v.license_plate
       FROM fuel_records fr
       JOIN vehicles v ON v.id = fr.vehicle_id
       WHERE fr.tenant_id = ?
         AND fr.record_date >= date('now', '-60 days')
       ORDER BY fr.record_date DESC, fr.created_at DESC`,
    [tenantId],
  );

  const vehicles = await db.query<VehicleOption>(
    `SELECT id, name, license_plate
       FROM vehicles
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY name`,
    [tenantId],
  );

  return (
    <FuelManager
      tenantId={tenantId}
      userId={userId}
      defaultFuelPrice={defaultFuelPrice}
      records={records}
      vehicles={vehicles}
    />
  );
}
