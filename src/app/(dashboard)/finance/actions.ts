'use server';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import type { Role } from '@/lib/auth/rbac';
import { getDb } from '@/lib/db';

export type FinanceMutationResult =
  | { success: true; id?: string }
  | { success: false; error: string };

export type BankAccountType = 'checking' | 'savings' | 'business';
export type CreditCardType =
  | 'visa'
  | 'mastercard'
  | 'isracard'
  | 'amex'
  | 'diners'
  | 'other';

export type StandingOrderFrequency =
  | 'weekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'yearly';

const VALID_FREQUENCIES: readonly StandingOrderFrequency[] = [
  'weekly',
  'monthly',
  'bimonthly',
  'quarterly',
  'yearly',
];

export type DebtType = 'owed_to_me' | 'i_owe';
export type DebtStatus = 'active' | 'partial' | 'paid' | 'written_off';
export type DebtCounterpartyType = 'worker' | 'supplier' | 'client' | 'other';
export type DebtPaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'check'
  | 'credit_card'
  | 'salary_deduction';

const VALID_DEBT_TYPES: readonly DebtType[] = ['owed_to_me', 'i_owe'];
const VALID_COUNTERPARTY_TYPES: readonly DebtCounterpartyType[] = [
  'worker',
  'supplier',
  'client',
  'other',
];
const VALID_PAYMENT_METHODS: readonly DebtPaymentMethod[] = [
  'cash',
  'bank_transfer',
  'check',
  'credit_card',
  'salary_deduction',
];

export type ReconciliationStatus =
  | 'pending'
  | 'matched'
  | 'discrepancy'
  | 'resolved';

const VALID_RECONCILIATION_STATUSES: readonly ReconciliationStatus[] = [
  'pending',
  'matched',
  'discrepancy',
  'resolved',
];

export interface DebtPayload {
  debtType: string;
  counterparty: string;
  counterpartyType?: string;
  workerId?: string;
  clientId?: string;
  amount: string;
  issueDate: string;
  dueDate?: string;
  description?: string;
  notes?: string;
}

export type TransactionType =
  | 'bank_deposit'
  | 'bank_withdrawal'
  | 'bank_transfer'
  | 'credit_card_charge'
  | 'credit_card_payment'
  | 'check_incoming'
  | 'check_outgoing'
  | 'standing_order'
  | 'cash_in'
  | 'cash_out'
  | 'invoice_payment'
  | 'expense_payment'
  | 'salary_payment'
  | 'debt_given'
  | 'debt_received'
  | 'debt_repayment';

export type TransactionDirection = 'in' | 'out';

const VALID_TRANSACTION_TYPES: readonly TransactionType[] = [
  'bank_deposit',
  'bank_withdrawal',
  'bank_transfer',
  'credit_card_charge',
  'credit_card_payment',
  'check_incoming',
  'check_outgoing',
  'standing_order',
  'cash_in',
  'cash_out',
  'invoice_payment',
  'expense_payment',
  'salary_payment',
  'debt_given',
  'debt_received',
  'debt_repayment',
];

const VALID_DIRECTIONS: readonly TransactionDirection[] = ['in', 'out'];

export type CheckDirection = 'incoming' | 'outgoing';

export type CheckStatus =
  | 'pending'
  | 'deposited'
  | 'cleared'
  | 'bounced'
  | 'cancelled'
  | 'post_dated';

const VALID_CHECK_DIRECTIONS: readonly CheckDirection[] = [
  'incoming',
  'outgoing',
];

const VALID_CHECK_STATUSES: readonly CheckStatus[] = [
  'pending',
  'deposited',
  'cleared',
  'bounced',
  'cancelled',
  'post_dated',
];

const VALID_BANK_TYPES: readonly BankAccountType[] = [
  'checking',
  'savings',
  'business',
];
const VALID_CARD_TYPES: readonly CreditCardType[] = [
  'visa',
  'mastercard',
  'isracard',
  'amex',
  'diners',
  'other',
];

export interface BankAccountPayload {
  bankName: string;
  branchNumber?: string;
  accountNumber: string;
  accountName?: string;
  accountType?: string;
  currentBalance?: string;
  isPrimary?: boolean;
  notes?: string;
}

export interface CreditCardPayload {
  bankAccountId: string;
  cardName: string;
  lastFourDigits: string;
  cardType?: string;
  creditLimit?: string;
  billingDay?: string;
  closingDay?: string;
  notes?: string;
}

export interface TransactionPayload {
  transactionDate: string;
  transactionType: string;
  amount: string;
  direction: string;
  bankAccountId?: string;
  creditCardId?: string;
  counterparty?: string;
  category?: string;
  description?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface StandingOrderPayload {
  bankAccountId: string;
  payeeName: string;
  amount: string;
  frequency: string;
  dayOfMonth?: string;
  category?: string;
  description?: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

export interface CheckPayload {
  checkNumber: string;
  bankAccountId: string;
  direction: string;
  amount: string;
  payeeOrPayer: string;
  issueDate: string;
  dueDate: string;
  category?: string;
  description?: string;
  notes?: string;
}

const FINANCE_ROLES: readonly Role[] = ['owner', 'accountant'];

async function requireFinanceRole(): Promise<
  { tenantId: string; userId: string; role: Role } | { error: string }
> {
  const token = cookies().get('auth-token')?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return { error: 'אין הרשאה' };
  const role = payload.role as Role;
  if (!FINANCE_ROLES.includes(role)) return { error: 'אין הרשאה' };
  return { tenantId: payload.tenantId, userId: payload.userId, role };
}

function generateId(): string {
  return randomBytes(16).toString('hex');
}

function emptyToNull(v: string | undefined | null): string | null {
  const trimmed = (v ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(v: string | undefined | null): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeDay(v: string | undefined, fallback: number): number {
  if (v == null || v === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 31) return fallback;
  return n;
}

function normalizeBankType(v: string | undefined): BankAccountType {
  if (v && (VALID_BANK_TYPES as readonly string[]).includes(v)) {
    return v as BankAccountType;
  }
  return 'checking';
}

function normalizeCardType(v: string | undefined): CreditCardType {
  if (v && (VALID_CARD_TYPES as readonly string[]).includes(v)) {
    return v as CreditCardType;
  }
  return 'visa';
}

function normalizeLastFour(v: string): string {
  const digits = (v ?? '').replace(/\D/g, '').slice(-4);
  return digits;
}

async function clearOtherPrimaries(
  tenantId: string,
  exceptId: string | null,
): Promise<void> {
  const db = getDb();
  if (exceptId) {
    await db
      .prepare(
        "UPDATE bank_accounts SET is_primary = 0, updated_at = datetime('now') WHERE tenant_id = ? AND id != ? AND is_primary = 1",
      )
      .bind(tenantId, exceptId)
      .run();
  } else {
    await db
      .prepare(
        "UPDATE bank_accounts SET is_primary = 0, updated_at = datetime('now') WHERE tenant_id = ? AND is_primary = 1",
      )
      .bind(tenantId)
      .run();
  }
}

export async function addBankAccount(
  tenantId: string,
  data: BankAccountPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };

  const bankName = data.bankName?.trim() ?? '';
  if (!bankName) return { success: false, error: 'שם הבנק חובה' };
  const accountNumber = data.accountNumber?.trim() ?? '';
  if (!accountNumber) return { success: false, error: 'מספר חשבון חובה' };

  const id = generateId();
  const db = getDb();
  await db.exec('BEGIN');
  try {
    if (data.isPrimary) {
      await clearOtherPrimaries(tenantId, null);
    }
    await db
      .prepare(
        'INSERT INTO bank_accounts (id, tenant_id, bank_name, branch_number, account_number, account_name, account_type, current_balance, is_primary, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        tenantId,
        bankName,
        emptyToNull(data.branchNumber),
        accountNumber,
        emptyToNull(data.accountName),
        normalizeBankType(data.accountType),
        normalizeNumber(data.currentBalance),
        data.isPrimary ? 1 : 0,
        emptyToNull(data.notes),
      )
      .run();
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  return { success: true, id };
}

export async function updateBankAccount(
  tenantId: string,
  accountId: string,
  data: BankAccountPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!accountId) return { success: false, error: 'מזהה חסר' };

  const bankName = data.bankName?.trim() ?? '';
  if (!bankName) return { success: false, error: 'שם הבנק חובה' };
  const accountNumber = data.accountNumber?.trim() ?? '';
  if (!accountNumber) return { success: false, error: 'מספר חשבון חובה' };

  const db = getDb();
  await db.exec('BEGIN');
  try {
    if (data.isPrimary) {
      await clearOtherPrimaries(tenantId, accountId);
    }
    const result = await db
      .prepare(
        "UPDATE bank_accounts SET bank_name = ?, branch_number = ?, account_number = ?, account_name = ?, account_type = ?, current_balance = ?, is_primary = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
      )
      .bind(
        bankName,
        emptyToNull(data.branchNumber),
        accountNumber,
        emptyToNull(data.accountName),
        normalizeBankType(data.accountType),
        normalizeNumber(data.currentBalance),
        data.isPrimary ? 1 : 0,
        emptyToNull(data.notes),
        accountId,
        tenantId,
      )
      .run();
    if (result.changes === 0) {
      await db.exec('ROLLBACK');
      return { success: false, error: 'החשבון לא נמצא' };
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  return { success: true, id: accountId };
}

export async function toggleBankAccount(
  tenantId: string,
  accountId: string,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!accountId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const result = await db
    .prepare(
      "UPDATE bank_accounts SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(accountId, tenantId)
    .run();
  if (result.changes === 0) {
    return { success: false, error: 'החשבון לא נמצא' };
  }
  return { success: true };
}

async function bankAccountBelongsToTenant(
  tenantId: string,
  accountId: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare(
      'SELECT id FROM bank_accounts WHERE id = ? AND tenant_id = ? AND is_active = 1',
    )
    .bind(accountId, tenantId)
    .first<{ id: string }>();
  return row != null;
}

export async function addCreditCard(
  tenantId: string,
  data: CreditCardPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };

  const cardName = data.cardName?.trim() ?? '';
  if (!cardName) return { success: false, error: 'שם הכרטיס חובה' };
  const lastFour = normalizeLastFour(data.lastFourDigits);
  if (lastFour.length !== 4)
    return { success: false, error: '4 ספרות אחרונות חובה' };
  if (!data.bankAccountId)
    return { success: false, error: 'חשבון בנק חובה' };
  if (!(await bankAccountBelongsToTenant(tenantId, data.bankAccountId))) {
    return { success: false, error: 'חשבון בנק לא חוקי' };
  }

  const id = generateId();
  const db = getDb();
  await db
    .prepare(
      'INSERT INTO credit_cards (id, tenant_id, bank_account_id, card_name, last_four_digits, card_type, credit_limit, billing_day, closing_day, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      tenantId,
      data.bankAccountId,
      cardName,
      lastFour,
      normalizeCardType(data.cardType),
      normalizeNumber(data.creditLimit),
      normalizeDay(data.billingDay, 10),
      normalizeDay(data.closingDay, 2),
      emptyToNull(data.notes),
    )
    .run();

  return { success: true, id };
}

export async function updateCreditCard(
  tenantId: string,
  cardId: string,
  data: CreditCardPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!cardId) return { success: false, error: 'מזהה חסר' };

  const cardName = data.cardName?.trim() ?? '';
  if (!cardName) return { success: false, error: 'שם הכרטיס חובה' };
  const lastFour = normalizeLastFour(data.lastFourDigits);
  if (lastFour.length !== 4)
    return { success: false, error: '4 ספרות אחרונות חובה' };
  if (!data.bankAccountId)
    return { success: false, error: 'חשבון בנק חובה' };
  if (!(await bankAccountBelongsToTenant(tenantId, data.bankAccountId))) {
    return { success: false, error: 'חשבון בנק לא חוקי' };
  }

  const db = getDb();
  const result = await db
    .prepare(
      "UPDATE credit_cards SET bank_account_id = ?, card_name = ?, last_four_digits = ?, card_type = ?, credit_limit = ?, billing_day = ?, closing_day = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(
      data.bankAccountId,
      cardName,
      lastFour,
      normalizeCardType(data.cardType),
      normalizeNumber(data.creditLimit),
      normalizeDay(data.billingDay, 10),
      normalizeDay(data.closingDay, 2),
      emptyToNull(data.notes),
      cardId,
      tenantId,
    )
    .run();
  if (result.changes === 0) {
    return { success: false, error: 'הכרטיס לא נמצא' };
  }

  return { success: true, id: cardId };
}

export async function toggleCreditCard(
  tenantId: string,
  cardId: string,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!cardId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const result = await db
    .prepare(
      "UPDATE credit_cards SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(cardId, tenantId)
    .run();
  if (result.changes === 0) {
    return { success: false, error: 'הכרטיס לא נמצא' };
  }
  return { success: true };
}

function normalizeDate(v: string | undefined | null): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return s.slice(0, 10);
}

function parsePositiveAmount(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function normalizeCheckDirection(v: string | undefined): CheckDirection | null {
  if (v && (VALID_CHECK_DIRECTIONS as readonly string[]).includes(v)) {
    return v as CheckDirection;
  }
  return null;
}

function normalizeCheckStatus(v: string | undefined): CheckStatus | null {
  if (v && (VALID_CHECK_STATUSES as readonly string[]).includes(v)) {
    return v as CheckStatus;
  }
  return null;
}

async function validateCheckPayload(
  tenantId: string,
  data: CheckPayload,
): Promise<
  | {
      ok: true;
      values: {
        checkNumber: string;
        bankAccountId: string;
        direction: CheckDirection;
        amount: number;
        payeeOrPayer: string;
        issueDate: string;
        dueDate: string;
      };
    }
  | { ok: false; error: string }
> {
  const checkNumber = (data.checkNumber ?? '').trim();
  if (!checkNumber) return { ok: false, error: 'מספר שיק חובה' };
  const direction = normalizeCheckDirection(data.direction);
  if (!direction) return { ok: false, error: 'כיוון השיק לא חוקי' };
  const amount = parsePositiveAmount(data.amount);
  if (amount == null) return { ok: false, error: 'סכום לא חוקי' };
  const payeeOrPayer = (data.payeeOrPayer ?? '').trim();
  if (!payeeOrPayer) {
    return {
      ok: false,
      error: direction === 'outgoing' ? 'לטובת חובה' : 'מאת חובה',
    };
  }
  const issueDate = normalizeDate(data.issueDate);
  const dueDate = normalizeDate(data.dueDate);
  if (!issueDate) return { ok: false, error: 'תאריך הנפקה חובה' };
  if (!dueDate) return { ok: false, error: 'תאריך פירעון חובה' };
  if (!data.bankAccountId)
    return { ok: false, error: 'חשבון בנק חובה' };
  if (!(await bankAccountBelongsToTenant(tenantId, data.bankAccountId))) {
    return { ok: false, error: 'חשבון בנק לא חוקי' };
  }
  return {
    ok: true,
    values: {
      checkNumber,
      bankAccountId: data.bankAccountId,
      direction,
      amount,
      payeeOrPayer,
      issueDate,
      dueDate,
    },
  };
}

export async function addCheckAction(
  tenantId: string,
  userId: string,
  data: CheckPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (auth.userId !== userId) return { success: false, error: 'אין הרשאה' };

  const check = await validateCheckPayload(tenantId, data);
  if (!check.ok) return { success: false, error: check.error };
  const v = check.values;

  const id = generateId();
  const db = getDb();
  await db
    .prepare(
      'INSERT INTO checks (id, tenant_id, check_number, bank_account_id, direction, amount, payee_or_payer, issue_date, due_date, status, category, description, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      tenantId,
      v.checkNumber,
      v.bankAccountId,
      v.direction,
      v.amount,
      v.payeeOrPayer,
      v.issueDate,
      v.dueDate,
      'pending',
      emptyToNull(data.category),
      emptyToNull(data.description),
      emptyToNull(data.notes),
      auth.userId,
    )
    .run();

  return { success: true, id };
}

export async function updateCheckAction(
  tenantId: string,
  checkId: string,
  data: CheckPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!checkId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const existing = await db
    .prepare(
      'SELECT status FROM checks WHERE id = ? AND tenant_id = ?',
    )
    .bind(checkId, tenantId)
    .first<{ status: string }>();
  if (!existing) return { success: false, error: 'השיק לא נמצא' };
  if (existing.status !== 'pending') {
    return { success: false, error: 'ניתן לערוך רק שיק ממתין' };
  }

  const check = await validateCheckPayload(tenantId, data);
  if (!check.ok) return { success: false, error: check.error };
  const v = check.values;

  await db
    .prepare(
      "UPDATE checks SET check_number = ?, bank_account_id = ?, direction = ?, amount = ?, payee_or_payer = ?, issue_date = ?, due_date = ?, category = ?, description = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(
      v.checkNumber,
      v.bankAccountId,
      v.direction,
      v.amount,
      v.payeeOrPayer,
      v.issueDate,
      v.dueDate,
      emptyToNull(data.category),
      emptyToNull(data.description),
      emptyToNull(data.notes),
      checkId,
      tenantId,
    )
    .run();

  return { success: true, id: checkId };
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeFrequency(v: string | undefined): StandingOrderFrequency | null {
  if (v && (VALID_FREQUENCIES as readonly string[]).includes(v)) {
    return v as StandingOrderFrequency;
  }
  return null;
}

function calculateNextExecution(
  frequency: StandingOrderFrequency,
  dayOfMonth: number | null,
  startDateStr: string,
  endDateStr: string | null = null,
): string | null {
  const startDate = new Date(startDateStr);
  if (Number.isNaN(startDate.getTime())) return null;
  startDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = endDateStr ? new Date(endDateStr) : null;
  if (endDate) endDate.setHours(0, 0, 0, 0);

  function finalize(next: Date): string | null {
    if (endDate && next > endDate) return null;
    return toIsoDate(next);
  }

  if (startDate > today) return finalize(startDate);

  if (frequency === 'weekly') {
    const next = new Date(startDate);
    while (next < today) next.setDate(next.getDate() + 7);
    return finalize(next);
  }

  if (frequency === 'yearly') {
    const month = startDate.getMonth();
    const day = startDate.getDate();
    let candidate = new Date(today.getFullYear(), month, day);
    candidate.setHours(0, 0, 0, 0);
    if (candidate < today) {
      candidate = new Date(today.getFullYear() + 1, month, day);
    }
    return finalize(candidate);
  }

  const step =
    frequency === 'monthly' ? 1 : frequency === 'bimonthly' ? 2 : 3;
  const dom = dayOfMonth ?? startDate.getDate();
  const startMonth = startDate.getFullYear() * 12 + startDate.getMonth();
  const todayMonth = today.getFullYear() * 12 + today.getMonth();
  const diff = todayMonth - startMonth;
  const alignedStep = Math.max(0, Math.ceil(diff / step) * step);
  let candidateMonth = startMonth + alignedStep;
  let year = Math.floor(candidateMonth / 12);
  let month = candidateMonth % 12;
  let candidate = new Date(year, month, dom);
  candidate.setHours(0, 0, 0, 0);

  if (candidate < today) {
    candidateMonth += step;
    year = Math.floor(candidateMonth / 12);
    month = candidateMonth % 12;
    candidate = new Date(year, month, dom);
    candidate.setHours(0, 0, 0, 0);
  }

  return finalize(candidate);
}

async function validateStandingOrderPayload(
  tenantId: string,
  data: StandingOrderPayload,
): Promise<
  | {
      ok: true;
      values: {
        bankAccountId: string;
        payeeName: string;
        amount: number;
        frequency: StandingOrderFrequency;
        dayOfMonth: number | null;
        startDate: string;
        endDate: string | null;
        nextExecution: string | null;
      };
    }
  | { ok: false; error: string }
> {
  if (!data.bankAccountId) return { ok: false, error: 'חשבון בנק חובה' };
  if (!(await bankAccountBelongsToTenant(tenantId, data.bankAccountId))) {
    return { ok: false, error: 'חשבון בנק לא חוקי' };
  }
  const payeeName = (data.payeeName ?? '').trim();
  if (!payeeName) return { ok: false, error: 'שם המוטב חובה' };
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'סכום לא חוקי' };
  }
  const frequency = normalizeFrequency(data.frequency);
  if (!frequency) return { ok: false, error: 'תדירות לא חוקית' };

  let dayOfMonth: number | null = null;
  if (
    frequency === 'monthly' ||
    frequency === 'bimonthly' ||
    frequency === 'quarterly'
  ) {
    const n = Number(data.dayOfMonth);
    if (Number.isInteger(n) && n >= 1 && n <= 31) dayOfMonth = n;
  }

  const startDate = normalizeDate(data.startDate);
  if (!startDate) return { ok: false, error: 'תאריך התחלה חובה' };
  const endDate = normalizeDate(data.endDate);
  if (endDate && endDate < startDate) {
    return { ok: false, error: 'תאריך סיום לפני תאריך התחלה' };
  }

  const nextExecution = calculateNextExecution(
    frequency,
    dayOfMonth,
    startDate,
    endDate,
  );

  return {
    ok: true,
    values: {
      bankAccountId: data.bankAccountId,
      payeeName,
      amount: Math.round(amount * 100) / 100,
      frequency,
      dayOfMonth,
      startDate,
      endDate,
      nextExecution,
    },
  };
}

export async function addStandingOrderAction(
  tenantId: string,
  data: StandingOrderPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };

  const validated = await validateStandingOrderPayload(tenantId, data);
  if (!validated.ok) return { success: false, error: validated.error };
  const v = validated.values;

  const id = generateId();
  const db = getDb();
  await db
    .prepare(
      'INSERT INTO standing_orders (id, tenant_id, bank_account_id, payee_name, amount, frequency, day_of_month, category, description, start_date, end_date, next_execution, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      tenantId,
      v.bankAccountId,
      v.payeeName,
      v.amount,
      v.frequency,
      v.dayOfMonth,
      (data.category ?? '').trim() || 'other',
      emptyToNull(data.description),
      v.startDate,
      v.endDate,
      v.nextExecution,
      emptyToNull(data.notes),
    )
    .run();

  return { success: true, id };
}

export async function updateStandingOrderAction(
  tenantId: string,
  orderId: string,
  data: StandingOrderPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!orderId) return { success: false, error: 'מזהה חסר' };

  const validated = await validateStandingOrderPayload(tenantId, data);
  if (!validated.ok) return { success: false, error: validated.error };
  const v = validated.values;

  const db = getDb();
  const result = await db
    .prepare(
      "UPDATE standing_orders SET bank_account_id = ?, payee_name = ?, amount = ?, frequency = ?, day_of_month = ?, category = ?, description = ?, start_date = ?, end_date = ?, next_execution = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(
      v.bankAccountId,
      v.payeeName,
      v.amount,
      v.frequency,
      v.dayOfMonth,
      (data.category ?? '').trim() || 'other',
      emptyToNull(data.description),
      v.startDate,
      v.endDate,
      v.nextExecution,
      emptyToNull(data.notes),
      orderId,
      tenantId,
    )
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'הוראת הקבע לא נמצאה' };
  }

  return { success: true, id: orderId };
}

function normalizeTransactionType(v: string | undefined): TransactionType | null {
  if (v && (VALID_TRANSACTION_TYPES as readonly string[]).includes(v)) {
    return v as TransactionType;
  }
  return null;
}

function normalizeDirection(v: string | undefined): TransactionDirection | null {
  if (v && (VALID_DIRECTIONS as readonly string[]).includes(v)) {
    return v as TransactionDirection;
  }
  return null;
}

async function creditCardBelongsToTenant(
  tenantId: string,
  cardId: string,
): Promise<boolean> {
  const db = getDb();
  const row = await db
    .prepare('SELECT id FROM credit_cards WHERE id = ? AND tenant_id = ?')
    .bind(cardId, tenantId)
    .first<{ id: string }>();
  return row != null;
}

async function validateTransactionPayload(
  tenantId: string,
  data: TransactionPayload,
): Promise<
  | {
      ok: true;
      values: {
        transactionDate: string;
        transactionType: TransactionType;
        amount: number;
        direction: TransactionDirection;
        bankAccountId: string | null;
        creditCardId: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const transactionDate = normalizeDate(data.transactionDate);
  if (!transactionDate) return { ok: false, error: 'תאריך חובה' };
  const transactionType = normalizeTransactionType(data.transactionType);
  if (!transactionType) return { ok: false, error: 'סוג תנועה לא חוקי' };
  const direction = normalizeDirection(data.direction);
  if (!direction) return { ok: false, error: 'כיוון לא חוקי' };
  const amount = parsePositiveAmount(data.amount);
  if (amount == null) return { ok: false, error: 'סכום לא חוקי' };

  let bankAccountId: string | null = null;
  if (data.bankAccountId && data.bankAccountId.trim()) {
    if (!(await bankAccountBelongsToTenant(tenantId, data.bankAccountId))) {
      return { ok: false, error: 'חשבון בנק לא חוקי' };
    }
    bankAccountId = data.bankAccountId;
  }
  let creditCardId: string | null = null;
  if (data.creditCardId && data.creditCardId.trim()) {
    if (!(await creditCardBelongsToTenant(tenantId, data.creditCardId))) {
      return { ok: false, error: 'כרטיס אשראי לא חוקי' };
    }
    creditCardId = data.creditCardId;
  }

  return {
    ok: true,
    values: {
      transactionDate,
      transactionType,
      amount,
      direction,
      bankAccountId,
      creditCardId,
    },
  };
}

export async function addTransactionAction(
  tenantId: string,
  userId: string,
  data: TransactionPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (auth.userId !== userId) return { success: false, error: 'אין הרשאה' };

  const validated = await validateTransactionPayload(tenantId, data);
  if (!validated.ok) return { success: false, error: validated.error };
  const v = validated.values;

  const id = generateId();
  const db = getDb();
  await db
    .prepare(
      'INSERT INTO financial_transactions (id, tenant_id, transaction_date, transaction_type, amount, direction, bank_account_id, credit_card_id, counterparty, category, description, reference_number, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      tenantId,
      v.transactionDate,
      v.transactionType,
      v.amount,
      v.direction,
      v.bankAccountId,
      v.creditCardId,
      emptyToNull(data.counterparty),
      emptyToNull(data.category),
      emptyToNull(data.description),
      emptyToNull(data.referenceNumber),
      emptyToNull(data.notes),
      auth.userId,
    )
    .run();

  return { success: true, id };
}

export async function updateTransactionAction(
  tenantId: string,
  transactionId: string,
  data: TransactionPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!transactionId) return { success: false, error: 'מזהה חסר' };

  const validated = await validateTransactionPayload(tenantId, data);
  if (!validated.ok) return { success: false, error: validated.error };
  const v = validated.values;

  const db = getDb();
  const result = await db
    .prepare(
      'UPDATE financial_transactions SET transaction_date = ?, transaction_type = ?, amount = ?, direction = ?, bank_account_id = ?, credit_card_id = ?, counterparty = ?, category = ?, description = ?, reference_number = ?, notes = ? WHERE id = ? AND tenant_id = ?',
    )
    .bind(
      v.transactionDate,
      v.transactionType,
      v.amount,
      v.direction,
      v.bankAccountId,
      v.creditCardId,
      emptyToNull(data.counterparty),
      emptyToNull(data.category),
      emptyToNull(data.description),
      emptyToNull(data.referenceNumber),
      emptyToNull(data.notes),
      transactionId,
      tenantId,
    )
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'התנועה לא נמצאה' };
  }

  return { success: true, id: transactionId };
}

function normalizeDebtType(v: string | undefined): DebtType | null {
  if (v && (VALID_DEBT_TYPES as readonly string[]).includes(v)) {
    return v as DebtType;
  }
  return null;
}

function normalizeCounterpartyType(
  v: string | undefined,
): DebtCounterpartyType {
  if (v && (VALID_COUNTERPARTY_TYPES as readonly string[]).includes(v)) {
    return v as DebtCounterpartyType;
  }
  return 'other';
}

function normalizePaymentMethod(v: string | undefined): DebtPaymentMethod {
  if (v && (VALID_PAYMENT_METHODS as readonly string[]).includes(v)) {
    return v as DebtPaymentMethod;
  }
  return 'cash';
}

export async function addDebtAction(
  tenantId: string,
  data: DebtPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };

  const debtType = normalizeDebtType(data.debtType);
  if (!debtType) return { success: false, error: 'סוג חוב לא חוקי' };
  const counterparty = (data.counterparty ?? '').trim();
  if (!counterparty)
    return { success: false, error: 'שם הצד השני חובה' };
  const amount = parsePositiveAmount(data.amount);
  if (amount == null) return { success: false, error: 'סכום לא חוקי' };
  const issueDate = normalizeDate(data.issueDate);
  if (!issueDate) return { success: false, error: 'תאריך חובה' };
  const dueDate = normalizeDate(data.dueDate);

  const id = generateId();
  const db = getDb();
  await db
    .prepare(
      'INSERT INTO debts (id, tenant_id, debt_type, counterparty, counterparty_type, worker_id, client_id, original_amount, remaining_amount, issue_date, due_date, description, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      tenantId,
      debtType,
      counterparty,
      normalizeCounterpartyType(data.counterpartyType),
      emptyToNull(data.workerId),
      emptyToNull(data.clientId),
      amount,
      amount,
      issueDate,
      dueDate,
      emptyToNull(data.description),
      emptyToNull(data.notes),
      auth.userId,
    )
    .run();

  return { success: true, id };
}

export async function updateDebtAction(
  tenantId: string,
  debtId: string,
  data: DebtPayload,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!debtId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const existing = await db
    .prepare(
      'SELECT original_amount, remaining_amount FROM debts WHERE id = ? AND tenant_id = ?',
    )
    .bind(debtId, tenantId)
    .first<{ original_amount: number; remaining_amount: number }>();
  if (!existing) return { success: false, error: 'החוב לא נמצא' };

  const debtType = normalizeDebtType(data.debtType);
  if (!debtType) return { success: false, error: 'סוג חוב לא חוקי' };
  const counterparty = (data.counterparty ?? '').trim();
  if (!counterparty)
    return { success: false, error: 'שם הצד השני חובה' };
  const amount = parsePositiveAmount(data.amount);
  if (amount == null) return { success: false, error: 'סכום לא חוקי' };
  const issueDate = normalizeDate(data.issueDate);
  if (!issueDate) return { success: false, error: 'תאריך חובה' };
  const dueDate = normalizeDate(data.dueDate);

  const delta = amount - existing.original_amount;
  const newRemaining = Math.max(
    0,
    Math.round((existing.remaining_amount + delta) * 100) / 100,
  );

  const result = await db
    .prepare(
      "UPDATE debts SET debt_type = ?, counterparty = ?, counterparty_type = ?, worker_id = ?, client_id = ?, original_amount = ?, remaining_amount = ?, issue_date = ?, due_date = ?, description = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(
      debtType,
      counterparty,
      normalizeCounterpartyType(data.counterpartyType),
      emptyToNull(data.workerId),
      emptyToNull(data.clientId),
      amount,
      newRemaining,
      issueDate,
      dueDate,
      emptyToNull(data.description),
      emptyToNull(data.notes),
      debtId,
      tenantId,
    )
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'החוב לא נמצא' };
  }

  return { success: true, id: debtId };
}

function normalizeReconciliationStatus(
  v: string | undefined,
): ReconciliationStatus | null {
  if (v && (VALID_RECONCILIATION_STATUSES as readonly string[]).includes(v)) {
    return v as ReconciliationStatus;
  }
  return null;
}

export async function createReconciliationAction(
  tenantId: string,
  userId: string,
  bankAccountId: string,
  dateStr: string,
  statementBalanceStr: string,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (auth.userId !== userId) return { success: false, error: 'אין הרשאה' };

  const date = normalizeDate(dateStr);
  if (!date) return { success: false, error: 'תאריך לא חוקי' };
  if (!bankAccountId) return { success: false, error: 'חשבון בנק חובה' };

  const statementBalance = Number(statementBalanceStr);
  if (!Number.isFinite(statementBalance)) {
    return { success: false, error: 'יתרת בנק לא חוקית' };
  }

  const db = getDb();
  const account = await db
    .prepare(
      'SELECT current_balance FROM bank_accounts WHERE id = ? AND tenant_id = ?',
    )
    .bind(bankAccountId, tenantId)
    .first<{ current_balance: number }>();
  if (!account) return { success: false, error: 'חשבון בנק לא חוקי' };

  const systemBalance = Number(account.current_balance ?? 0);
  const statementRounded = Math.round(statementBalance * 100) / 100;
  const systemRounded = Math.round(systemBalance * 100) / 100;
  const difference =
    Math.round((statementRounded - systemRounded) * 100) / 100;
  const status: ReconciliationStatus =
    Math.abs(difference) < 0.01 ? 'matched' : 'discrepancy';

  const id = generateId();
  await db
    .prepare(
      'INSERT INTO bank_reconciliations (id, tenant_id, bank_account_id, reconciliation_date, statement_balance, system_balance, difference, status, reconciled_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      id,
      tenantId,
      bankAccountId,
      date,
      statementRounded,
      systemRounded,
      difference,
      status,
      auth.userId,
    )
    .run();

  return { success: true, id };
}

export async function updateReconciliationStatusAction(
  tenantId: string,
  reconciliationId: string,
  newStatus: string,
  notes: string,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!reconciliationId) return { success: false, error: 'מזהה חסר' };

  const status = normalizeReconciliationStatus(newStatus);
  if (!status) return { success: false, error: 'סטטוס לא חוקי' };

  const db = getDb();
  const result = await db
    .prepare(
      'UPDATE bank_reconciliations SET status = ?, notes = ? WHERE id = ? AND tenant_id = ?',
    )
    .bind(status, emptyToNull(notes), reconciliationId, tenantId)
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'ההתאמה לא נמצאה' };
  }

  return { success: true };
}

export async function addDebtPaymentAction(
  tenantId: string,
  debtId: string,
  amountStr: string,
  dateStr: string,
  method: string,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!debtId) return { success: false, error: 'מזהה חסר' };

  const amount = parsePositiveAmount(amountStr);
  if (amount == null) return { success: false, error: 'סכום לא חוקי' };
  const paymentDate = normalizeDate(dateStr);
  if (!paymentDate) return { success: false, error: 'תאריך לא חוקי' };
  const paymentMethod = normalizePaymentMethod(method);

  const db = getDb();
  const debt = await db
    .prepare(
      'SELECT original_amount, remaining_amount, status FROM debts WHERE id = ? AND tenant_id = ?',
    )
    .bind(debtId, tenantId)
    .first<{
      original_amount: number;
      remaining_amount: number;
      status: string;
    }>();
  if (!debt) return { success: false, error: 'החוב לא נמצא' };
  if (debt.status === 'paid' || debt.status === 'written_off') {
    return { success: false, error: 'החוב כבר נסגר' };
  }

  const newRemaining = Math.max(
    0,
    Math.round((debt.remaining_amount - amount) * 100) / 100,
  );
  const newStatus: DebtStatus = newRemaining <= 0.01 ? 'paid' : 'partial';

  await db.exec('BEGIN');
  try {
    await db
      .prepare(
        'INSERT INTO debt_payments (id, tenant_id, debt_id, payment_date, amount, payment_method, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        generateId(),
        tenantId,
        debtId,
        paymentDate,
        amount,
        paymentMethod,
        auth.userId,
      )
      .run();

    await db
      .prepare(
        "UPDATE debts SET remaining_amount = ?, status = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
      )
      .bind(newRemaining, newStatus, debtId, tenantId)
      .run();

    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }

  return { success: true, id: debtId };
}

export async function deleteTransactionAction(
  tenantId: string,
  transactionId: string,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!transactionId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const result = await db
    .prepare(
      'DELETE FROM financial_transactions WHERE id = ? AND tenant_id = ?',
    )
    .bind(transactionId, tenantId)
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'התנועה לא נמצאה' };
  }

  return { success: true };
}

export async function toggleStandingOrderAction(
  tenantId: string,
  orderId: string,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!orderId) return { success: false, error: 'מזהה חסר' };

  const db = getDb();
  const result = await db
    .prepare(
      "UPDATE standing_orders SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(orderId, tenantId)
    .run();
  if (result.changes === 0) {
    return { success: false, error: 'הוראת הקבע לא נמצאה' };
  }
  return { success: true };
}

export async function updateCheckStatusAction(
  tenantId: string,
  checkId: string,
  newStatus: string,
  bounceReason?: string,
): Promise<FinanceMutationResult> {
  const auth = await requireFinanceRole();
  if ('error' in auth) return { success: false, error: auth.error };
  if (auth.tenantId !== tenantId)
    return { success: false, error: 'אין הרשאה' };
  if (!checkId) return { success: false, error: 'מזהה חסר' };

  const status = normalizeCheckStatus(newStatus);
  if (!status) return { success: false, error: 'סטטוס לא חוקי' };

  let reason: string | null = null;
  if (status === 'bounced') {
    reason = (bounceReason ?? '').trim();
    if (!reason) {
      return { success: false, error: 'יש להזין סיבת חזרה' };
    }
  }

  const db = getDb();
  const result = await db
    .prepare(
      "UPDATE checks SET status = ?, bounce_reason = ?, updated_at = datetime('now') WHERE id = ? AND tenant_id = ?",
    )
    .bind(status, reason, checkId, tenantId)
    .run();

  if (result.changes === 0) {
    return { success: false, error: 'השיק לא נמצא' };
  }

  return { success: true, id: checkId };
}
