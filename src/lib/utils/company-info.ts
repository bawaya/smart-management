import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
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
  'company_logo_path',
] as const;

async function loadLogo(
  logoPath: string | null | undefined,
): Promise<string | null> {
  const path = logoPath?.trim();
  if (!path) return null;
  try {
    const buffer = await readFile(path);
    const ext = extname(path).slice(1).toLowerCase();
    const mime =
      ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

export const getCompanyInfo = cache(
  async (tenantId: string): Promise<CompanyInfo> => {
    const db = getDb();
    const placeholders = COMPANY_KEYS.map(() => '?').join(', ');
    const rows = await db
      .prepare(
        `SELECT key, value FROM settings WHERE tenant_id = ? AND key IN (${placeholders})`,
      )
      .bind(tenantId, ...COMPANY_KEYS)
      .all<{ key: string; value: string }>();
    const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
    const logoDataUrl = await loadLogo(map.get('company_logo_path'));
    return {
      name: (map.get('company_name') ?? '').trim(),
      phone: (map.get('company_phone') ?? '').trim(),
      address: (map.get('company_address') ?? '').trim(),
      taxId: (map.get('company_tax_id') ?? '').trim(),
      logoDataUrl,
    };
  },
);
