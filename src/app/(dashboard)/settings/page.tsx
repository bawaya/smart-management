import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import { CompanyForm } from './CompanyForm';

interface SettingRow {
  key: string;
  value: string;
}

const COMPANY_KEYS = [
  'company_name',
  'company_phone',
  'company_address',
  'company_tax_id',
  'company_logo_path',
] as const;

export default async function SettingsCompanyPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';

  const db = getDb();
  const placeholders = COMPANY_KEYS.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `SELECT key, value FROM settings WHERE tenant_id = ? AND key IN (${placeholders})`,
    )
    .bind(tenantId, ...COMPANY_KEYS)
    .all<SettingRow>();

  const map = new Map(rows.map((r) => [r.key, r.value ?? '']));

  return (
    <CompanyForm
      tenantId={tenantId}
      initialData={{
        companyName: map.get('company_name') ?? '',
        phone: map.get('company_phone') ?? '',
        address: map.get('company_address') ?? '',
        taxId: map.get('company_tax_id') ?? '',
        hasLogo: Boolean((map.get('company_logo_path') ?? '').trim()),
      }}
    />
  );
}
