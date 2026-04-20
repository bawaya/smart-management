import { cache } from 'react';
import { getDb } from '@/lib/db';

export interface CompanyInfo {
  name: string;
  phone: string;
  address: string;
  taxId: string;
  logoDataUrl: string | null;
}

const COMPANY_KEYS = [
  'company_name',
  'company_phone',
  'company_address',
  'company_tax_id',
  'company_logo_base64',
  'company_logo_mime',
] as const;

function buildLogoDataUrl(
  base64: string | undefined,
  mime: string | undefined,
): string | null {
  const data = base64?.trim();
  const type = mime?.trim();
  if (!data || !type) return null;
  return `data:${type};base64,${data}`;
}

export const getCompanyInfo = cache(
  async (tenantId: string): Promise<CompanyInfo> => {
    const db = getDb();
    const placeholders = COMPANY_KEYS.map(() => '?').join(', ');
    const rows = await db.query<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE tenant_id = ? AND key IN (${placeholders})`,
      [tenantId, ...COMPANY_KEYS],
    );
    const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
    return {
      name: (map.get('company_name') ?? '').trim(),
      phone: (map.get('company_phone') ?? '').trim(),
      address: (map.get('company_address') ?? '').trim(),
      taxId: (map.get('company_tax_id') ?? '').trim(),
      logoDataUrl: buildLogoDataUrl(
        map.get('company_logo_base64'),
        map.get('company_logo_mime'),
      ),
    };
  },
);
