import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName, testCheckNumber } from '../utils/test-data';
import { findRowByText } from '../utils/master-helpers';
import {
  ensureTestBankAccount,
  todayISO,
  dateOffsetISO,
} from '../utils/finance-helpers';

test.use({ storageState: storageStatePath('owner') });
const M = 'checks' as const;

test.describe('Checks — Smoke', () => {
  test('الصפחה תפתחת', async ({ page }) => {
    await page.goto('/finance/checks');
    const outgoing = page.locator(`[data-testid="${M}-add-button-outgoing"]`);
    const incoming = page.locator(`[data-testid="${M}-add-button-incoming"]`);
    await expect(outgoing.or(incoming).first()).toBeVisible();
  });
});

test.describe('Checks — CRUD', () => {
  test('add outgoing check', async ({ page }) => {
    await ensureTestBankAccount(page);

    await page.goto('/finance/checks');
    await page
      .locator(`[data-testid="${M}-add-button-outgoing"]`)
      .click();
    await expect(page.locator(`[data-testid="${M}-form"]`)).toBeVisible();

    const bankSelect = page.locator(`[data-testid="${M}-form-bank-account-id"]`);
    const firstBank = await bankSelect
      .locator('option')
      .nth(1)
      .getAttribute('value');
    test.skip(!firstBank, 'No bank option');

    const payee = testName('payee');
    await bankSelect.selectOption(firstBank!);
    await page
      .locator(`[data-testid="${M}-form-check-number"]`)
      .fill(testCheckNumber());
    await page.locator(`[data-testid="${M}-form-amount"]`).fill('1500');
    await page
      .locator(`[data-testid="${M}-form-payee-or-payer"]`)
      .fill(payee);
    await page
      .locator(`[data-testid="${M}-form-issue-date"]`)
      .fill(todayISO());
    await page
      .locator(`[data-testid="${M}-form-due-date"]`)
      .fill(dateOffsetISO(30));

    await page.locator(`[data-testid="${M}-form-submit"]`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await expect(await findRowByText(page, M, payee)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('add incoming check', async ({ page }) => {
    await ensureTestBankAccount(page);

    await page.goto('/finance/checks');
    const incomingBtn = page.locator(
      `[data-testid="${M}-add-button-incoming"]`,
    );
    if ((await incomingBtn.count()) === 0) test.skip();
    await incomingBtn.click();
    await expect(page.locator(`[data-testid="${M}-form"]`)).toBeVisible();

    const bankSelect = page.locator(`[data-testid="${M}-form-bank-account-id"]`);
    const firstBank = await bankSelect
      .locator('option')
      .nth(1)
      .getAttribute('value');
    test.skip(!firstBank, 'No bank option');

    const payer = testName('payer');
    await bankSelect.selectOption(firstBank!);
    await page
      .locator(`[data-testid="${M}-form-check-number"]`)
      .fill(testCheckNumber());
    await page.locator(`[data-testid="${M}-form-amount"]`).fill('2500');
    await page
      .locator(`[data-testid="${M}-form-payee-or-payer"]`)
      .fill(payer);
    await page
      .locator(`[data-testid="${M}-form-issue-date"]`)
      .fill(todayISO());
    await page
      .locator(`[data-testid="${M}-form-due-date"]`)
      .fill(dateOffsetISO(30));

    await page.locator(`[data-testid="${M}-form-submit"]`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await expect(await findRowByText(page, M, payer)).toBeVisible({
      timeout: 10_000,
    });
  });
});
