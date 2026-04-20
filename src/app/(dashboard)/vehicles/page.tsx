import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import { VehiclesManager, type VehicleRow } from './VehiclesManager';

export default async function VehiclesPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'equipment')) {
    redirect('/');
  }

  const db = getDb();
  const vehicles = await db.query<VehicleRow>(
    `SELECT id, name, license_plate, type,
              insurance_expiry, license_expiry,
              annual_insurance_cost, annual_license_cost,
              notes, is_active
       FROM vehicles
       WHERE tenant_id = ?
       ORDER BY is_active DESC, name`,
    [tenantId],
  );

  return <VehiclesManager tenantId={tenantId} vehicles={vehicles} />;
}
