import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import {
  type InvoiceDetailRow,
  InvoiceDetails,
  type InvoiceItemRow,
} from './InvoiceDetails';

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
  'equipment_label_he',
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

interface Props {
  params: { id: string };
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = params;
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userRole = (requestHeaders.get('x-user-role') ?? '') as Role;

  if (!hasPermission(userRole, 'invoices')) {
    redirect('/');
  }

  const db = getDb();

  const invoice = await db
    .prepare(
      `SELECT
         i.id, i.invoice_number, i.period_start, i.period_end,
         i.total_equipment_days, i.total_equipment_revenue,
         i.total_worker_days, i.total_worker_revenue,
         i.subtotal, i.vat_rate, i.vat_amount, i.total,
         i.status, i.paid_amount, i.paid_date, i.created_at,
         c.id AS client_id, c.name AS client_name,
         c.contact_person AS client_contact_person,
         c.phone AS client_phone,
         c.email AS client_email,
         c.address AS client_address,
         c.tax_id AS client_tax_id
       FROM invoices i
       JOIN clients c ON c.id = i.client_id
       WHERE i.id = ? AND i.tenant_id = ?`,
    )
    .bind(id, tenantId)
    .first<InvoiceDetailRow>();

  if (!invoice) {
    notFound();
  }

  const items = await db
    .prepare(
      `SELECT id, item_type, description, quantity, unit_price, total
       FROM invoice_items
       WHERE invoice_id = ? AND tenant_id = ?
       ORDER BY item_type, created_at`,
    )
    .bind(id, tenantId)
    .all<InvoiceItemRow>();

  const placeholders = COMPANY_KEYS.map(() => '?').join(', ');
  const settingsRows = await db
    .prepare(
      `SELECT key, value FROM settings WHERE tenant_id = ? AND key IN (${placeholders})`,
    )
    .bind(tenantId, ...COMPANY_KEYS)
    .all<SettingRow>();
  const settings = new Map(settingsRows.map((r) => [r.key, r.value ?? '']));

  const logoDataUrl = await loadLogo(settings.get('company_logo_path'));

  return (
    <InvoiceDetails
      invoice={invoice}
      items={items}
      equipmentLabel={
        (settings.get('equipment_label_he') ?? '').trim() || 'ציוד'
      }
      company={{
        name: (settings.get('company_name') ?? '').trim(),
        phone: (settings.get('company_phone') ?? '').trim(),
        address: (settings.get('company_address') ?? '').trim(),
        taxId: (settings.get('company_tax_id') ?? '').trim(),
        logoDataUrl,
      }}
    />
  );
}
