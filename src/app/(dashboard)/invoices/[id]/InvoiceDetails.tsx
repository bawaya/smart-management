'use client';

import Link from 'next/link';
import { printInvoice } from '@/lib/utils/generate-invoice-pdf';

export interface InvoiceDetailRow {
  id: string;
  invoice_number: string;
  period_start: string;
  period_end: string;
  total_equipment_days: number;
  total_equipment_revenue: number;
  total_worker_days: number;
  total_worker_revenue: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'partial' | 'cancelled';
  paid_amount: number | null;
  paid_date: string | null;
  created_at: string;
  client_id: string;
  client_name: string;
  client_contact_person: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  client_tax_id: string | null;
}

export interface InvoiceItemRow {
  id: string;
  item_type: 'equipment' | 'worker';
  description: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

interface CompanyInfo {
  name: string;
  phone: string;
  address: string;
  taxId: string;
  logoDataUrl: string | null;
}

interface InvoiceDetailsProps {
  invoice: InvoiceDetailRow;
  items: InvoiceItemRow[];
  equipmentLabel: string;
  company: CompanyInfo;
}

const STATUS_CONFIG: Record<
  InvoiceDetailRow['status'],
  { label: string; badge: string }
> = {
  draft: { label: 'טיוטה', badge: 'bg-gray-200 text-gray-800' },
  sent: { label: 'נשלחה', badge: 'bg-blue-100 text-blue-800' },
  paid: { label: 'שולמה', badge: 'bg-green-100 text-green-800' },
  partial: { label: 'שולמה חלקית', badge: 'bg-yellow-100 text-yellow-800' },
  cancelled: { label: 'בוטלה', badge: 'bg-red-100 text-red-800' },
};

function formatILS(n: number): string {
  return `₪${n.toLocaleString('he-IL', { maximumFractionDigits: 2 })}`;
}

function formatDateIL(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = iso.slice(0, 10);
  const parts = s.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function InvoiceDetails({
  invoice,
  items,
  equipmentLabel,
  company,
}: InvoiceDetailsProps) {
  const equipmentItems = items.filter((i) => i.item_type === 'equipment');
  const workerItems = items.filter((i) => i.item_type === 'worker');
  const orderedItems = [...equipmentItems, ...workerItems];
  const statusConfig = STATUS_CONFIG[invoice.status];
  const paidAmount = invoice.paid_amount ?? 0;
  const remaining = Math.max(0, invoice.total - paidAmount);
  const hasPayments = paidAmount > 0;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { background: white !important; }
          .invoice-print-hide { display: none !important; }
          .invoice-print-surface {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="max-w-4xl mx-auto">
        <div className="invoice-print-hide flex items-center justify-between gap-2 mb-4">
          <Link
            href="/invoices"
            className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
          >
            חזרה
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printInvoice}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              הדפס
            </button>
            <button
              type="button"
              onClick={printInvoice}
              className="px-4 py-2 rounded-md bg-[#f59e0b] text-black font-bold text-sm hover:bg-[#d97706] transition-colors"
            >
              ייצוא PDF
            </button>
          </div>
        </div>

        <article className="invoice-print-surface bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <header className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-gray-200">
            <div className="flex items-start gap-3">
              {company.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoDataUrl}
                  alt={company.name || 'לוגו'}
                  className="max-h-20 max-w-[120px] object-contain"
                />
              ) : null}
              <div className="min-w-0">
                {company.name && (
                  <h2 className="text-lg font-bold text-gray-900">
                    {company.name}
                  </h2>
                )}
                {company.address && (
                  <p className="text-sm text-gray-700 mt-0.5">
                    {company.address}
                  </p>
                )}
                {company.phone && (
                  <p className="text-sm text-gray-700 mt-0.5" dir="ltr">
                    {company.phone}
                  </p>
                )}
                {company.taxId && (
                  <p className="text-sm text-gray-700 mt-0.5">
                    מספר עוסק:{' '}
                    <span dir="ltr">{company.taxId}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="md:text-left">
              <h1 className="text-3xl font-bold text-gray-900">חשבונית</h1>
              <p className="mt-2 text-sm text-gray-700">
                מספר:{' '}
                <span className="font-medium" dir="ltr">
                  {invoice.invoice_number}
                </span>
              </p>
              <p className="text-sm text-gray-700 mt-0.5">
                תאריך:{' '}
                <span dir="ltr">{formatDateIL(invoice.created_at)}</span>
              </p>
              <div className="mt-2">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.badge}`}
                >
                  {statusConfig.label}
                </span>
              </div>
            </div>
          </header>

          <section className="mt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-2">
              פרטי הלקוח
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-0.5">
              <p className="font-medium text-gray-900">
                {invoice.client_name}
              </p>
              {invoice.client_contact_person && (
                <p className="text-gray-700">
                  איש קשר: {invoice.client_contact_person}
                </p>
              )}
              {invoice.client_phone && (
                <p className="text-gray-700" dir="ltr">
                  {invoice.client_phone}
                </p>
              )}
              {invoice.client_address && (
                <p className="text-gray-700">{invoice.client_address}</p>
              )}
              {invoice.client_tax_id && (
                <p className="text-gray-700">
                  מספר עוסק:{' '}
                  <span dir="ltr">{invoice.client_tax_id}</span>
                </p>
              )}
            </div>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-2">
              תקופת החשבונית
            </h3>
            <p className="text-sm text-gray-700">
              מ:{' '}
              <span className="font-medium" dir="ltr">
                {formatDateIL(invoice.period_start)}
              </span>{' '}
              עד:{' '}
              <span className="font-medium" dir="ltr">
                {formatDateIL(invoice.period_end)}
              </span>
            </p>
          </section>

          <section className="mt-6">
            <h3 className="text-sm font-bold text-gray-900 mb-2">בנודים</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-right">
                  <tr>
                    <th className="px-3 py-2 font-medium text-gray-700 w-10">
                      #
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700">
                      תיאור
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700 w-20">
                      כמות
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700 w-32">
                      מחיר ליחידה
                    </th>
                    <th className="px-3 py-2 font-medium text-gray-700 w-32">
                      סה״כ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {equipmentItems.length > 0 && (
                    <tr className="bg-amber-50">
                      <td
                        colSpan={5}
                        className="px-3 py-1.5 text-xs font-bold text-amber-900"
                      >
                        {equipmentLabel}
                      </td>
                    </tr>
                  )}
                  {equipmentItems.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-gray-500" dir="ltr">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        {item.description ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700" dir="ltr">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2 text-gray-700" dir="ltr">
                        {formatILS(item.unit_price)}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900" dir="ltr">
                        {formatILS(item.total)}
                      </td>
                    </tr>
                  ))}
                  {workerItems.length > 0 && (
                    <tr className="bg-blue-50">
                      <td
                        colSpan={5}
                        className="px-3 py-1.5 text-xs font-bold text-blue-900"
                      >
                        עובדים
                      </td>
                    </tr>
                  )}
                  {workerItems.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-gray-500" dir="ltr">
                        {equipmentItems.length + idx + 1}
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        {item.description ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-700" dir="ltr">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2 text-gray-700" dir="ltr">
                        {formatILS(item.unit_price)}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900" dir="ltr">
                        {formatILS(item.total)}
                      </td>
                    </tr>
                  ))}
                  {orderedItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-sm text-gray-500"
                      >
                        אין בנודים
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 flex justify-end">
            <dl className="w-full max-w-xs text-sm space-y-1">
              <div className="flex justify-between">
                <dt className="text-gray-700">סה״כ לפני מע״מ:</dt>
                <dd className="text-gray-900 font-medium" dir="ltr">
                  {formatILS(invoice.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-700">
                  מע״מ (<span dir="ltr">{invoice.vat_rate}%</span>):
                </dt>
                <dd className="text-gray-900 font-medium" dir="ltr">
                  {formatILS(invoice.vat_amount)}
                </dd>
              </div>
              <div className="flex justify-between border-t-2 border-gray-300 pt-2 mt-2">
                <dt className="text-gray-900 font-bold text-base">
                  סה״כ לתשלום:
                </dt>
                <dd
                  className="text-gray-900 font-bold text-base"
                  dir="ltr"
                >
                  {formatILS(invoice.total)}
                </dd>
              </div>
              {hasPayments && (
                <>
                  <div className="flex justify-between pt-1">
                    <dt className="text-gray-700">שולם:</dt>
                    <dd className="text-green-700 font-medium" dir="ltr">
                      {formatILS(paidAmount)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-700">יתרה:</dt>
                    <dd
                      className={`font-medium ${
                        remaining > 0 ? 'text-red-600' : 'text-green-700'
                      }`}
                      dir="ltr"
                    >
                      {formatILS(remaining)}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </section>
        </article>
      </div>
    </>
  );
}
