import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import { type AssignmentDetail, LogDetails, type LogDetailRow } from './LogDetails';

export const runtime = 'edge';

interface SettingRow {
  value: string;
}

interface Props {
  params: { id: string };
}

export default async function LogDetailPage({ params }: Props) {
  const { id } = params;
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userId = requestHeaders.get('x-user-id') ?? '';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'daily_log.read')) {
    redirect('/');
  }

  const db = getDb();

  const log = await db.queryOne<LogDetailRow>(
    `SELECT
         dl.id, dl.log_date, dl.client_id, dl.equipment_id, dl.vehicle_id,
         dl.location, dl.project_name, dl.equipment_revenue, dl.notes,
         dl.status, dl.created_by, dl.created_at, dl.updated_at,
         c.name AS client_name,
         e.name AS equipment_name,
         v.name AS vehicle_name,
         u.username AS created_by_username,
         u.full_name AS created_by_full_name
       FROM daily_logs dl
       JOIN clients c ON c.id = dl.client_id
       JOIN equipment e ON e.id = dl.equipment_id
       LEFT JOIN vehicles v ON v.id = dl.vehicle_id
       LEFT JOIN users u ON u.id = dl.created_by
       WHERE dl.id = ? AND dl.tenant_id = ?`,
    [id, tenantId],
  );

  if (!log) {
    notFound();
  }

  if (userRole === 'operator' && log.created_by !== userId) {
    redirect('/daily-log');
  }

  const assignments = await db.query<AssignmentDetail>(
    `SELECT wa.id, wa.worker_id, wa.daily_rate, wa.revenue,
              w.full_name AS worker_name
       FROM worker_assignments wa
       JOIN workers w ON w.id = wa.worker_id
       WHERE wa.daily_log_id = ?
       ORDER BY w.full_name`,
    [id],
  );

  const labelRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    [tenantId],
  );

  const equipmentLabel = (labelRow?.value ?? '').trim() || 'ציוד';
  const canEdit =
    log.status === 'draft' &&
    hasPermission(userRole, 'daily_log.write') &&
    (userRole !== 'operator' || log.created_by === userId);

  return (
    <LogDetails
      log={log}
      assignments={assignments}
      equipmentLabel={equipmentLabel}
      canEdit={canEdit}
    />
  );
}
