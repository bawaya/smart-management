import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import {
  type AssignmentRow,
  type ClientOption,
  DailyLogManager,
  type DailyLogRow,
  type EquipmentOption,
  type VehicleOption,
  type WorkerOption,
} from './DailyLogManager';

interface SettingRow {
  key: string;
  value: string;
}

const DEFAULT_KEYS = [
  'equipment_label_he',
  'default_worker_daily_rate',
  'default_equipment_daily_rate',
  'client_equipment_revenue',
  'client_worker_revenue',
] as const;

function toNum(v: string | undefined, fallback = 0): number {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default async function DailyLogPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userId = requestHeaders.get('x-user-id') ?? '';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'daily_log.read')) {
    redirect('/');
  }

  const db = getDb();

  const settingsRows = await db.query<SettingRow>(
    `SELECT key, value FROM settings WHERE tenant_id = ? AND key IN (${DEFAULT_KEYS.map(() => '?').join(', ')})`,
    [tenantId, ...DEFAULT_KEYS],
  );
  const settings = new Map(settingsRows.map((r) => [r.key, r.value ?? '']));

  const logs = await db.query<DailyLogRow>(
    `SELECT
         dl.id, dl.log_date, dl.client_id, dl.equipment_id, dl.vehicle_id,
         dl.location, dl.project_name, dl.equipment_revenue, dl.notes,
         dl.status, dl.created_by,
         c.name AS client_name,
         e.name AS equipment_name,
         v.name AS vehicle_name,
         (SELECT COUNT(*) FROM worker_assignments wa WHERE wa.daily_log_id = dl.id) AS worker_count,
         (SELECT COALESCE(SUM(wa.revenue), 0) FROM worker_assignments wa WHERE wa.daily_log_id = dl.id) AS workers_revenue
       FROM daily_logs dl
       JOIN clients c ON c.id = dl.client_id
       JOIN equipment e ON e.id = dl.equipment_id
       LEFT JOIN vehicles v ON v.id = dl.vehicle_id
       WHERE dl.tenant_id = ? AND dl.log_date >= date('now', '-30 days')
       ORDER BY dl.log_date DESC, dl.created_at DESC`,
    [tenantId],
  );

  const assignments =
    logs.length > 0
      ? await db.query<AssignmentRow>(
          `SELECT daily_log_id, worker_id, daily_rate, revenue
             FROM worker_assignments
             WHERE daily_log_id IN (${logs.map(() => '?').join(', ')})`,
          [...logs.map((l) => l.id)],
        )
      : [];

  const clients = await db.query<ClientOption>(
    `SELECT id, name, equipment_daily_rate, worker_daily_rate
       FROM clients
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY name`,
    [tenantId],
  );

  const equipment = await db.query<EquipmentOption>(
    `SELECT e.id, e.name, e.status,
              COALESCE(NULLIF(TRIM(et.name_he), ''), et.name_ar) AS type_name
       FROM equipment e
       LEFT JOIN equipment_types et ON et.id = e.equipment_type_id
       WHERE e.tenant_id = ? AND e.is_active = 1 AND e.status != 'retired'
       ORDER BY e.name`,
    [tenantId],
  );

  const vehicles = await db.query<VehicleOption>(
    `SELECT id, name, license_plate
       FROM vehicles
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY name`,
    [tenantId],
  );

  const workers = await db.query<WorkerOption>(
    `SELECT id, full_name, daily_rate
       FROM workers
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY full_name`,
    [tenantId],
  );

  return (
    <DailyLogManager
      tenantId={tenantId}
      userId={userId}
      userRole={userRole}
      equipmentLabel={(settings.get('equipment_label_he') ?? '').trim() || 'ציוד'}
      defaults={{
        equipmentRevenue: toNum(
          settings.get('client_equipment_revenue'),
          toNum(settings.get('default_equipment_daily_rate'), 0),
        ),
        workerCost: toNum(settings.get('default_worker_daily_rate'), 0),
        workerRevenue: toNum(settings.get('client_worker_revenue'), 0),
      }}
      logs={logs}
      assignments={assignments}
      clients={clients}
      equipment={equipment}
      vehicles={vehicles}
      workers={workers}
    />
  );
}
