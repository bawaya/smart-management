import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import {
  type EquipmentOption,
  type ExpenseRow,
  ExpensesManager,
  type VehicleOption,
  type WorkerOption,
} from './ExpensesManager';

interface SettingRow {
  value: string;
}

export default async function ExpensesPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userId = requestHeaders.get('x-user-id') ?? '';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'daily_log.write')) {
    redirect('/');
  }

  const db = getDb();

  const labelRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    [tenantId],
  );

  const expenses = await db.query<ExpenseRow>(
    `SELECT
         e.id, e.expense_date, e.category, e.amount, e.description,
         e.vehicle_id, e.equipment_id, e.worker_id,
         e.receipt_ref, e.notes,
         v.name AS vehicle_name,
         eq.name AS equipment_name,
         w.full_name AS worker_name
       FROM expenses e
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       LEFT JOIN equipment eq ON eq.id = e.equipment_id
       LEFT JOIN workers w ON w.id = e.worker_id
       WHERE e.tenant_id = ?
         AND e.expense_date >= date('now', '-60 days')
       ORDER BY e.expense_date DESC, e.created_at DESC`,
    [tenantId],
  );

  const vehicles = await db.query<VehicleOption>(
    `SELECT id, name, license_plate
       FROM vehicles
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY name`,
    [tenantId],
  );

  const equipment = await db.query<EquipmentOption>(
    `SELECT id, name
       FROM equipment
       WHERE tenant_id = ? AND is_active = 1 AND status != 'retired'
       ORDER BY name`,
    [tenantId],
  );

  const workers = await db.query<WorkerOption>(
    `SELECT id, full_name
       FROM workers
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY full_name`,
    [tenantId],
  );

  return (
    <ExpensesManager
      tenantId={tenantId}
      userId={userId}
      equipmentLabel={(labelRow?.value ?? '').trim() || 'ציוד'}
      expenses={expenses}
      vehicles={vehicles}
      equipment={equipment}
      workers={workers}
    />
  );
}
