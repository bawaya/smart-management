import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { testName } from './test-data.js';
import { addEntry } from './master-helpers.js';
import { BASE_URL } from './config.js';
import { submitAndWait, waitForServerAction } from './ui-helpers.js';

/**
 * Ensures at least one TEST_ bank account exists (for use as FK).
 * Returns the bank name.
 */
export async function ensureTestBankAccount(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/finance`);
  await page
    .waitForLoadState('networkidle', { timeout: 10_000 })
    .catch(() => {});

  const existing = page
    .locator('[data-testid="bank-accounts-row"]:visible')
    .filter({ hasText: 'TEST_' })
    .first();
  if ((await existing.count()) > 0) {
    const name = await existing
      .locator('[data-testid="bank-accounts-row-bank-name"]')
      .textContent();
    if (name?.trim()) return name.trim();
  }

  const bankName = testName('bank');
  const accNumber = `TEST_${Date.now()}`;
  const result = await addEntry(page, 'bank-accounts', {
    'bank-name': bankName,
    'account-number': accNumber,
    'account-name': 'TEST_holder',
    'current-balance': '10000',
  });
  if (result.status === 'error') {
    throw new Error(`Failed to create TEST bank: ${result.message}`);
  }
  return bankName;
}

/**
 * Click "השווה" (compare) to advance step 1 → step 2 in reconciliation.
 */
export async function advanceReconciliationToStep2(
  page: Page,
): Promise<void> {
  const compareBtn = page.locator(
    '[data-testid="reconciliation-form-compare"]',
  );
  await compareBtn.click();
  await waitForServerAction(page);
}

/**
 * Record payment on an invoice (opens InvoicePayment modal).
 */
export async function recordInvoicePayment(
  page: Page,
  data: { amount: string; paymentDate?: string },
) {
  const modal = page.locator('[data-testid="invoices-payment-modal"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  await modal
    .locator('[data-testid="invoices-payment-amount"]')
    .fill(data.amount);
  if (data.paymentDate) {
    await modal
      .locator('[data-testid="invoices-payment-date"]')
      .fill(data.paymentDate);
  }

  const result = await submitAndWait(
    page,
    '[data-testid="invoices-payment-submit"]',
  );
  await waitForServerAction(page);
  return result;
}

/**
 * Record payment on a debt.
 */
export async function recordDebtPayment(
  page: Page,
  data: { amount: string; paymentDate?: string; method?: string },
) {
  const modal = page.locator('[data-testid="debts-payment-modal"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  await modal
    .locator('[data-testid="debts-payment-amount"]')
    .fill(data.amount);
  if (data.paymentDate) {
    await modal
      .locator('[data-testid="debts-payment-date"]')
      .fill(data.paymentDate);
  }
  if (data.method) {
    await modal
      .locator('[data-testid="debts-payment-method"]')
      .selectOption(data.method);
  }

  const result = await submitAndWait(
    page,
    '[data-testid="debts-payment-submit"]',
  );
  await waitForServerAction(page);
  return result;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** date N days offset from today */
export function dateOffsetISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
