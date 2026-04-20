import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import {
  type BankAccountOption,
  type ReconciliationRow,
  ReconciliationManager,
} from './ReconciliationManager';

export const runtime = 'edge';

export default async function FinanceReconciliationPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userId = requestHeaders.get('x-user-id') ?? '';

  const db = getDb();

  const bankAccounts = await db.query<BankAccountOption>(
    `SELECT id, bank_name, account_number, current_balance
     FROM bank_accounts
     WHERE tenant_id = ? AND is_active = 1
     ORDER BY bank_name`,
    [tenantId],
  );

  const reconciliations = await db.query<ReconciliationRow>(
    `SELECT r.id, r.bank_account_id, r.reconciliation_date,
            r.statement_balance, r.system_balance, r.difference,
            r.status, r.notes,
            ba.bank_name, ba.account_number
     FROM bank_reconciliations r
     JOIN bank_accounts ba ON ba.id = r.bank_account_id
     WHERE r.tenant_id = ?
     ORDER BY r.reconciliation_date DESC, r.created_at DESC
     LIMIT 12`,
    [tenantId],
  );

  return (
    <ReconciliationManager
      tenantId={tenantId}
      userId={userId}
      bankAccounts={bankAccounts}
      reconciliations={reconciliations}
    />
  );
}
