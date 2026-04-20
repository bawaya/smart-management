import { headers } from 'next/headers';
import { getCompanyInfo } from '@/lib/utils/company-info';
import { getWorkersReportData } from '@/lib/utils/report-calculations';
import { WorkersReport } from './WorkersReport';

export const runtime = 'edge';

interface Props {
  searchParams: { year?: string; month?: string };
}

function parseYear(v: string | undefined): number {
  const n = Number(v);
  if (Number.isInteger(n) && n >= 2000 && n <= 3000) return n;
  return new Date().getFullYear();
}

function parseMonth(v: string | undefined): number | null {
  if (v == null || v === '' || v === 'all') return null;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  return null;
}

export default async function WorkersReportPage({ searchParams }: Props) {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const year = parseYear(searchParams.year);
  const month = parseMonth(searchParams.month);

  const [data, company] = await Promise.all([
    getWorkersReportData(tenantId, year, month),
    getCompanyInfo(tenantId),
  ]);

  return <WorkersReport data={data} company={company} />;
}
