import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import {
  type ClientOption,
  type InvoiceRow,
  InvoicesManager,
} from './InvoicesManager';

export const runtime = 'edge';

interface SettingRow {
  value: string;
}

export default async function InvoicesPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userId = requestHeaders.get('x-user-id') ?? '';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'invoices')) {
    redirect('/');
  }

  const db = getDb();

  const labelRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    [tenantId],
  );

  const invoices = await db.query<InvoiceRow>(
    `SELECT
         i.id, i.invoice_number, i.client_id, i.period_start, i.period_end,
         i.total_equipment_days, i.total_equipment_revenue,
         i.total_worker_days, i.total_worker_revenue,
         i.subtotal, i.vat_rate, i.vat_amount, i.total,
         i.status, i.paid_amount, i.paid_date, i.created_at,
         c.name AS client_name
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.tenant_id = ?
       ORDER BY i.created_at DESC`,
    [tenantId],
  );

  const clients = await db.query<ClientOption>(
    `SELECT id, name FROM clients
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY name`,
    [tenantId],
  );

  return (
    <InvoicesManager
      tenantId={tenantId}
      userId={userId}
      equipmentLabel={(labelRow?.value ?? '').trim() || 'ציוד'}
      invoices={invoices}
      clients={clients}
    />
  );
}
