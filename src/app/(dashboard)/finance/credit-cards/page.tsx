import { headers } from 'next/headers';
import { getDb } from '@/lib/db';
import {
  type BankAccountOption,
  type CreditCardRow,
  CreditCardsManager,
} from './CreditCardsManager';

export default async function FinanceCreditCardsPage() {
  const tenantId = headers().get('x-tenant-id') ?? 'default';
  const db = getDb();

  const cards = await db.query<CreditCardRow>(
    `SELECT cc.id, cc.bank_account_id, cc.card_name, cc.last_four_digits,
            cc.card_type, cc.credit_limit, cc.billing_day, cc.closing_day,
            cc.current_balance, cc.notes, cc.is_active,
            ba.bank_name, ba.account_number
     FROM credit_cards cc
     JOIN bank_accounts ba ON ba.id = cc.bank_account_id
     WHERE cc.tenant_id = ?
     ORDER BY cc.is_active DESC, cc.card_name`,
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
    <CreditCardsManager
      tenantId={tenantId}
      cards={cards}
      bankAccounts={bankAccounts}
    />
  );
}
