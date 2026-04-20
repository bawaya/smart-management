import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import {
  type BankAccountOption,
  type CreditCardOption,
  type TransactionRow,
  TransactionsManager,
} from './TransactionsManager';

export default async function FinanceTransactionsPage() {
  const requestHeaders = headers();
  const tenantId = requestHeaders.get('x-tenant-id') ?? 'default';
  const userId = requestHeaders.get('x-user-id') ?? '';

  const db = getDb();

  const transactions = await db
    .prepare(
      `SELECT t.id, t.transaction_date, t.transaction_type, t.amount, t.direction,
              t.bank_account_id, t.credit_card_id,
              t.counterparty, t.category, t.description, t.reference_number,
              t.notes,
              ba.bank_name,
              cc.card_name, cc.last_four_digits
       FROM financial_transactions t
       LEFT JOIN bank_accounts ba ON ba.id = t.bank_account_id
       LEFT JOIN credit_cards cc ON cc.id = t.credit_card_id
       WHERE t.tenant_id = ?
         AND t.transaction_date >= date('now', '-60 days')
       ORDER BY t.transaction_date DESC, t.created_at DESC`,
    )
    .bind(tenantId)
    .all<TransactionRow>();

  const bankAccounts = await db
    .prepare(
      `SELECT id, bank_name, account_number
       FROM bank_accounts
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY bank_name`,
    )
    .bind(tenantId)
    .all<BankAccountOption>();

  const creditCards = await db
    .prepare(
      `SELECT id, card_name, last_four_digits
       FROM credit_cards
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY card_name`,
    )
    .bind(tenantId)
    .all<CreditCardOption>();

  return (
    <TransactionsManager
      tenantId={tenantId}
      userId={userId}
      transactions={transactions}
      bankAccounts={bankAccounts}
      creditCards={creditCards}
    />
  );
}
