import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { type Role, hasPermission } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';
import { getCompanyInfo } from '@/lib/utils/company-info';
import {
  type InvoiceDetailRow,
  InvoiceDetails,
  type InvoiceItemRow,
} from './InvoiceDetails';

export const runtime = 'edge';

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

  const invoice = await db.queryOne<InvoiceDetailRow>(
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
    [id, tenantId],
  );

  if (!invoice) {
    notFound();
  }

  const items = await db.query<InvoiceItemRow>(
    `SELECT id, item_type, description, quantity, unit_price, total
       FROM invoice_items
       WHERE invoice_id = ? AND tenant_id = ?
       ORDER BY item_type, created_at`,
    [id, tenantId],
  );

  const equipmentLabelRow = await db.queryOne<{ value: string }>(
    "SELECT value FROM settings WHERE tenant_id = ? AND key = 'equipment_label_he'",
    [tenantId],
  );
  const equipmentLabel =
    (equipmentLabelRow?.value ?? '').trim() || 'ציוד';

  const company = await getCompanyInfo(tenantId);

  return (
    <InvoiceDetails
      invoice={invoice}
      items={items}
      equipmentLabel={equipmentLabel}
      company={company}
    />
  );
}
