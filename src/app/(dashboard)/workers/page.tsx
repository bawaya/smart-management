import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import { WorkersManager, type WorkerRow } from './WorkersManager';

export const runtime = 'edge';

interface SettingRow {
  value: string;
}

export default async function WorkersPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'workers')) {
    redirect('/');
  }

  const db = getDb();

  const rateRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'default_worker_daily_rate'",
    [tenantId],
  );

  const parsed = Number((rateRow?.value ?? '').trim());
  const defaultRate = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const workers = await db.query<WorkerRow>(
    `SELECT id, full_name, id_number, phone, daily_rate, notes, is_active
       FROM workers
       WHERE tenant_id = ?
       ORDER BY is_active DESC, full_name`,
    [tenantId],
  );

  return (
    <WorkersManager
      tenantId={tenantId}
      defaultRate={defaultRate}
      workers={workers}
    />
  );
}
