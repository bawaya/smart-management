import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import {
  EquipmentManager,
  type EquipmentRow,
  type EquipmentTypeOption,
} from './EquipmentManager';

export const runtime = 'edge';

interface SettingRow {
  value: string;
}

export default async function EquipmentPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'equipment')) {
    redirect('/');
  }

  const db = getDb();

  const labelRow = await db.queryOne<SettingRow>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    [tenantId],
  );

  const items = await db.query<EquipmentRow>(
    `SELECT e.id, e.name, e.equipment_type_id, e.identifier, e.status,
              e.insurance_expiry, e.license_expiry, e.last_maintenance, e.notes,
              COALESCE(NULLIF(TRIM(et.name_he), ''), et.name_ar) AS type_name
       FROM equipment e
       LEFT JOIN equipment_types et ON et.id = e.equipment_type_id
       WHERE e.tenant_id = ?
       ORDER BY e.name`,
    [tenantId],
  );

  const types = await db.query<EquipmentTypeOption>(
    `SELECT id, COALESCE(NULLIF(TRIM(name_he), ''), name_ar) AS name
       FROM equipment_types
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY sort_order, name_he`,
    [tenantId],
  );

  return (
    <EquipmentManager
      tenantId={tenantId}
      equipmentLabel={(labelRow?.value ?? '').trim() || 'ציוד'}
      items={items}
      types={types}
    />
  );
}
