import { headers } from 'next/headers';
import { getCompanyInfo } from '@/lib/utils/company-info';
import { getProfitLossData } from '@/lib/utils/report-calculations';
import { ProfitLossReport } from './ProfitLossReport';

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

export default async function ProfitLossPage({ searchParams }: Props) {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const year = parseYear(searchParams.year);
  const month = parseMonth(searchParams.month);

  const [data, company] = await Promise.all([
    getProfitLossData(tenantId, year, month),
    getCompanyInfo(tenantId),
  ]);

  return <ProfitLossReport data={data} company={company} />;
}
