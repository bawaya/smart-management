import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import {
  type BankAccountRow,
  BankAccountsManager,
} from './BankAccountsManager';

export const runtime = 'edge';

export default async function FinanceBankAccountsPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const db = getDb();
  const accounts = await db.query<BankAccountRow>(
    `SELECT id, bank_name, branch_number, account_number, account_name,
            account_type, current_balance, is_primary, notes, is_active
     FROM bank_accounts
     WHERE tenant_id = ?
     ORDER BY is_active DESC, is_primary DESC, bank_name`,
    [tenantId],
  );

  return <BankAccountsManager tenantId={tenantId} accounts={accounts} />;
}
