import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { EquipmentTypesManager } from './EquipmentTypesManager';

export const runtime = 'edge';

interface SettingRow {
  key: string;
  value: string;
}

interface TypeRow {
  id: string;
  name_ar: string;
  name_he: string | null;
  sort_order: number;
}

export default async function EquipmentTypesPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';

  const db = getDb();

  const settingsRows = await db.query<SettingRow>(
    "SELECT key, value FROM settings WHERE tenant_id = ? AND key IN ('equipment_label_he', 'equipment_label_ar')",
    [tenantId],
  );
  const map = new Map(settingsRows.map((r) => [r.key, r.value ?? '']));

  const typeRows = await db.query<TypeRow>(
    'SELECT id, name_ar, name_he, sort_order FROM equipment_types WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order, name_he',
    [tenantId],
  );

  const types = typeRows.map((row) => ({
    id: row.id,
    name: (row.name_he ?? row.name_ar ?? '').trim() || row.name_ar,
  }));

  return (
    <EquipmentTypesManager
      tenantId={tenantId}
      initialLabelHe={(map.get('equipment_label_he') ?? '').trim()}
      initialLabelAr={(map.get('equipment_label_ar') ?? '').trim()}
      types={types}
    />
  );
}
