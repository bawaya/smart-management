import { headers } from 'next/headers';
import { getCashFlowProjection } from '@/lib/utils/cash-flow-calculations';
import { CashFlowView } from './CashFlowView';

export const runtime = 'edge';

interface Props {
  searchParams: { weeks?: string };
}

function parseWeeks(v: string | undefined): number {
  const n = Number(v);
  if (Number.isInteger(n) && (n === 4 || n === 8 || n === 13)) return n;
  return 13;
}

export default async function FinanceCashFlowPage({ searchParams }: Props) {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const weeks = parseWeeks(searchParams.weeks);
  const projection = await getCashFlowProjection(tenantId, weeks);
  return <CashFlowView projection={projection} weeks={weeks} />;
}
