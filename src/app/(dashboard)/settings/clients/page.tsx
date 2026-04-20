import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { ClientsManager, type ClientRow } from './ClientsManager';

export const runtime = 'edge';

interface SettingRow {
  value: string;
}

export default async function ClientsPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';

  const db = getDb();
  const labelRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    [tenantId],
  );

  const clients = await db.query<ClientRow>(
    'SELECT id, name, contact_person, phone, email, address, tax_id, equipment_daily_rate, worker_daily_rate, notes, is_active FROM clients WHERE tenant_id = ? ORDER BY is_active DESC, name',
    [tenantId],
  );

  return (
    <ClientsManager
      tenantId={tenantId}
      equipmentLabel={(labelRow?.value ?? '').trim() || 'ציוד'}
      clients={clients}
    />
  );
}
