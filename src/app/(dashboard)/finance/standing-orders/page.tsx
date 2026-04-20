import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import {
  type BankAccountOption,
  StandingOrdersManager,
  type StandingOrderRow,
} from './StandingOrdersManager';

export const runtime = 'edge';

export default async function FinanceStandingOrdersPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const db = getDb();

  const orders = await db.query<StandingOrderRow>(
    `SELECT so.id, so.bank_account_id, so.payee_name, so.amount,
            so.frequency, so.day_of_month, so.category, so.description,
            so.start_date, so.end_date, so.next_execution, so.last_executed,
            so.notes, so.is_active,
            ba.bank_name, ba.account_number
     FROM standing_orders so
     JOIN bank_accounts ba ON ba.id = so.bank_account_id
     WHERE so.tenant_id = ?
     ORDER BY so.is_active DESC, so.next_execution`,
    [tenantId],
  );

  const bankAccounts = await db.query<BankAccountOption>(
    `SELECT id, bank_name, account_number
     FROM bank_accounts
     WHERE tenant_id = ? AND is_active = 1
     ORDER BY bank_name`,
    [tenantId],
  );

  return (
    <StandingOrdersManager
      tenantId={tenantId}
      orders={orders}
      bankAccounts={bankAccounts}
    />
  );
}
