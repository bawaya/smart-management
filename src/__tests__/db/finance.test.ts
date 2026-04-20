import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, seedTestData, type SeededData } from '../helpers/test-db';

// Mimics addBankAccount: only one primary per tenant.
function addBankAccount(
  db: Database.Database,
  seed: SeededData,
  id: string,
  name: string,
  accountNumber: string,
  balance: number,
  isPrimary: boolean,
): void {
  if (isPrimary) {
    db.prepare('UPDATE bank_accounts SET is_primary = 0 WHERE tenant_id = ?').run(
      seed.tenantId,
    );
  }
  db.prepare(
    `INSERT INTO bank_accounts (id, tenant_id, bank_name, account_number, current_balance, is_primary) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, seed.tenantId, name, accountNumber, balance, isPrimary ? 1 : 0);
}

function addDebtPayment(
  db: Database.Database,
  seed: SeededData,
  debtId: string,
  amount: number,
  date: string,
  id?: string,
): void {
  db.prepare(
    `INSERT INTO debt_payments (id, tenant_id, debt_id, payment_date, amount, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id ?? `dp-${Math.random()}`,
    seed.tenantId,
    debtId,
    date,
    amount,
    seed.users.ownerId,
  );

  const debt = db
    .prepare('SELECT original_amount FROM debts WHERE id = ?')
    .get(debtId) as { original_amount: number };

  const totalPaid = (
    db
      .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM debt_payments WHERE debt_id = ?')
      .get(debtId) as { s: number }
  ).s;

  const remaining = debt.original_amount - totalPaid;
  let status: 'active' | 'partial' | 'paid';
  if (remaining <= 0) status = 'paid';
  else if (totalPaid > 0) status = 'partial';
  else status = 'active';

  db.prepare('UPDATE debts SET remaining_amount = ?, status = ? WHERE id = ?').run(
    Math.max(0, remaining),
    status,
    debtId,
  );
}

function createReconciliation(
  db: Database.Database,
  seed: SeededData,
  id: string,
  accountId: string,
  statementBalance: number,
  systemBalance: number,
): string {
  const difference = +(statementBalance - systemBalance).toFixed(2);
  const status = Math.abs(difference) < 0.01 ? 'matched' : 'discrepancy';

  db.prepare(
    `INSERT INTO bank_reconciliations (id, tenant_id, bank_account_id, reconciliation_date, statement_balance, system_balance, difference, status, reconciled_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    seed.tenantId,
    accountId,
    '2026-03-31',
    statementBalance,
    systemBalance,
    difference,
    status,
    seed.users.ownerId,
  );
  return status;
}

describe('finance', () => {
  let db: Database.Database;
  let seed: SeededData;

  beforeEach(() => {
    db = createTestDb();
    seed = seedTestData(db);
  });

  afterEach(() => {
    db.close();
  });

  it('reads seeded bank account balance', () => {
    const row = db
      .prepare('SELECT current_balance, is_primary FROM bank_accounts WHERE id = ?')
      .get(seed.bankAccountId) as { current_balance: number; is_primary: number };
    expect(row.current_balance).toBe(10000);
    expect(row.is_primary).toBe(1);
  });

  it('enforces "only one primary account per tenant" at the app layer', () => {
    addBankAccount(db, seed, 'ba-2', 'Bank Leumi', '87654321', 5000, true);

    const rows = db
      .prepare(
        'SELECT id, is_primary FROM bank_accounts WHERE tenant_id = ? ORDER BY id',
      )
      .all(seed.tenantId) as Array<{ id: string; is_primary: number }>;

    const primaries = rows.filter((r) => r.is_primary === 1);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe('ba-2');
  });

  it('links a credit card to a bank account (FK integrity)', () => {
    const row = db
      .prepare(
        `SELECT cc.card_name, ba.bank_name FROM credit_cards cc JOIN bank_accounts ba ON cc.bank_account_id = ba.id WHERE cc.id = ?`,
      )
      .get(seed.creditCardId) as { card_name: string; bank_name: string };
    expect(row.card_name).toBe('כרטיס ראשי');
    expect(row.bank_name).toBe('בנק הפועלים');
  });

  it('outgoing check transitions pending → cleared', () => {
    db.prepare(
      `INSERT INTO checks (id, tenant_id, check_number, bank_account_id, direction, amount, payee_or_payer, issue_date, due_date, status, created_by) VALUES ('ck-out', ?, '001', ?, 'outgoing', 1500, 'ספק א', '2026-03-01', '2026-03-15', 'pending', ?)`,
    ).run(seed.tenantId, seed.bankAccountId, seed.users.ownerId);

    db.prepare("UPDATE checks SET status = 'cleared' WHERE id = ?").run('ck-out');

    const row = db
      .prepare('SELECT status, direction FROM checks WHERE id = ?')
      .get('ck-out') as { status: string; direction: string };
    expect(row.status).toBe('cleared');
    expect(row.direction).toBe('outgoing');
  });

  it('incoming check can be marked bounced with a reason', () => {
    db.prepare(
      `INSERT INTO checks (id, tenant_id, check_number, bank_account_id, direction, amount, payee_or_payer, issue_date, due_date, status, created_by) VALUES ('ck-in', ?, '002', ?, 'incoming', 3000, 'לקוח ג', '2026-03-01', '2026-03-15', 'pending', ?)`,
    ).run(seed.tenantId, seed.bankAccountId, seed.users.ownerId);

    db.prepare(
      "UPDATE checks SET status = 'bounced', bounce_reason = ? WHERE id = ?",
    ).run('אין כיסוי', 'ck-in');

    const row = db
      .prepare('SELECT status, bounce_reason FROM checks WHERE id = ?')
      .get('ck-in') as { status: string; bounce_reason: string };
    expect(row.status).toBe('bounced');
    expect(row.bounce_reason).toBe('אין כיסוי');
  });

  it('stores a standing order with computed next_execution', () => {
    db.prepare(
      `INSERT INTO standing_orders (id, tenant_id, bank_account_id, payee_name, amount, frequency, day_of_month, category, start_date, next_execution) VALUES ('so-1', ?, ?, 'שכר דירה', 4500, 'monthly', 5, 'office', '2026-01-05', '2026-04-05')`,
    ).run(seed.tenantId, seed.bankAccountId);

    const row = db
      .prepare(
        'SELECT frequency, day_of_month, next_execution FROM standing_orders WHERE id = ?',
      )
      .get('so-1') as {
      frequency: string;
      day_of_month: number;
      next_execution: string;
    };
    expect(row.frequency).toBe('monthly');
    expect(row.day_of_month).toBe(5);
    expect(row.next_execution).toBe('2026-04-05');
  });

  it('records a bank_deposit financial transaction', () => {
    db.prepare(
      `INSERT INTO financial_transactions (id, tenant_id, transaction_date, transaction_type, amount, direction, bank_account_id, created_by) VALUES ('ft-dep', ?, '2026-03-15', 'bank_deposit', 5000, 'in', ?, ?)`,
    ).run(seed.tenantId, seed.bankAccountId, seed.users.ownerId);

    const row = db
      .prepare(
        'SELECT transaction_type, amount, direction FROM financial_transactions WHERE id = ?',
      )
      .get('ft-dep') as { transaction_type: string; amount: number; direction: string };
    expect(row.transaction_type).toBe('bank_deposit');
    expect(row.direction).toBe('in');
    expect(row.amount).toBe(5000);
  });

  it('partial debt payment transitions active → partial', () => {
    db.prepare(
      `INSERT INTO debts (id, tenant_id, debt_type, counterparty, original_amount, remaining_amount, issue_date, status, created_by) VALUES ('d-p', ?, 'owed_to_me', 'לקוח א', 5000, 5000, '2026-01-15', 'active', ?)`,
    ).run(seed.tenantId, seed.users.ownerId);

    addDebtPayment(db, seed, 'd-p', 2000, '2026-02-01', 'dp-1');

    const row = db
      .prepare('SELECT status, remaining_amount FROM debts WHERE id = ?')
      .get('d-p') as { status: string; remaining_amount: number };
    expect(row.status).toBe('partial');
    expect(row.remaining_amount).toBe(3000);
  });

  it('full debt payment transitions to paid', () => {
    db.prepare(
      `INSERT INTO debts (id, tenant_id, debt_type, counterparty, original_amount, remaining_amount, issue_date, status, created_by) VALUES ('d-f', ?, 'i_owe', 'ספק ב', 3000, 3000, '2026-01-15', 'active', ?)`,
    ).run(seed.tenantId, seed.users.ownerId);

    addDebtPayment(db, seed, 'd-f', 1000, '2026-02-01', 'dp-f1');
    addDebtPayment(db, seed, 'd-f', 2000, '2026-03-01', 'dp-f2');

    const row = db
      .prepare('SELECT status, remaining_amount FROM debts WHERE id = ?')
      .get('d-f') as { status: string; remaining_amount: number };
    expect(row.status).toBe('paid');
    expect(row.remaining_amount).toBe(0);
  });

  it('reconciliation with zero difference → matched', () => {
    const status = createReconciliation(
      db,
      seed,
      'rec-match',
      seed.bankAccountId,
      10000,
      10000,
    );
    expect(status).toBe('matched');

    const row = db
      .prepare('SELECT status, difference FROM bank_reconciliations WHERE id = ?')
      .get('rec-match') as { status: string; difference: number };
    expect(row.status).toBe('matched');
    expect(row.difference).toBe(0);
  });

  it('reconciliation with non-zero difference → discrepancy', () => {
    const status = createReconciliation(
      db,
      seed,
      'rec-diff',
      seed.bankAccountId,
      10500,
      10000,
    );
    expect(status).toBe('discrepancy');

    const row = db
      .prepare('SELECT status, difference FROM bank_reconciliations WHERE id = ?')
      .get('rec-diff') as { status: string; difference: number };
    expect(row.status).toBe('discrepancy');
    expect(row.difference).toBe(500);
  });
});
