import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import {
  type BankAccountOption,
  type CheckRow,
  ChecksManager,
} from './ChecksManager';

export default async function FinanceChecksPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userId = requestHeaders.get('x-user-id') ?? '';

  const db = getDb();

  const checks = await db.query<CheckRow>(
    `SELECT c.id, c.check_number, c.bank_account_id, c.direction, c.amount,
            c.payee_or_payer, c.issue_date, c.due_date, c.status,
            c.category, c.description, c.bounce_reason, c.notes, c.updated_at,
            ba.bank_name, ba.account_number
     FROM checks c
     JOIN bank_accounts ba ON ba.id = c.bank_account_id
     WHERE c.tenant_id = ?
     ORDER BY c.due_date DESC, c.created_at DESC`,
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
    <ChecksManager
      tenantId={tenantId}
      userId={userId}
      checks={checks}
      bankAccounts={bankAccounts}
    />
  );
}
