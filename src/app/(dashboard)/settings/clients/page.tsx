import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { ClientsManager, type ClientRow } from './ClientsManager';

interface SettingRow {
  value: string;
}

export default async function ClientsPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';

  const db = getDb();
  const labelRow = await db
    .prepare(
      "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    )
    .bind(tenantId)
    .first<SettingRow>();

  const clients = await db
    .prepare(
      'SELECT id, name, contact_person, phone, email, address, tax_id, equipment_daily_rate, worker_daily_rate, notes, is_active FROM clients WHERE tenant_id = ? ORDER BY is_active DESC, name',
    )
    .bind(tenantId)
    .all<ClientRow>();

  return (
    <ClientsManager
      tenantId={tenantId}
      equipmentLabel={(labelRow?.value ?? '').trim() || 'ציוד'}
      clients={clients}
    />
  );
}
