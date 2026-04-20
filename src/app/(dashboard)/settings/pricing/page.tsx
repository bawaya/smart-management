import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { PricingForm } from './PricingForm';

interface SettingRow {
  key: string;
  value: string;
}

const PRICING_KEYS = [
  'client_equipment_revenue',
  'client_worker_revenue',
  'default_worker_daily_rate',
  'default_equipment_daily_rate',
  'fuel_price_per_liter',
  'vat_rate',
  'equipment_label_he',
] as const;

export default async function SettingsPricingPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';

  const db = getDb();
  const placeholders = PRICING_KEYS.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `SELECT key, value FROM settings WHERE tenant_id = ? AND key IN (${placeholders})`,
    )
    .bind(tenantId, ...PRICING_KEYS)
    .all<SettingRow>();

  const map = new Map(rows.map((r) => [r.key, r.value ?? '']));

  return (
    <PricingForm
      tenantId={tenantId}
      equipmentLabel={(map.get('equipment_label_he') ?? '').trim() || 'ציוד'}
      initialData={{
        clientEquipmentRate: map.get('client_equipment_revenue') ?? '',
        clientWorkerRate: map.get('client_worker_revenue') ?? '',
        defaultWorkerRate: map.get('default_worker_daily_rate') ?? '',
        fuelPrice: map.get('fuel_price_per_liter') ?? '',
        vatRate: map.get('vat_rate') ?? '17',
      }}
    />
  );
}
