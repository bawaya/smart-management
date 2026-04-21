import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import { findRowByText } from '../utils/master-helpers';
import { ensureTestBankAccount } from '../utils/finance-helpers';

test.use({ storageState: storageStatePath('owner') });
const M = 'credit-cards' as const;

test.describe('Credit Cards — Smoke', () => {
  test('الصפחה תפתחת', async ({ page }) => {
    await page.goto('/finance/credit-cards');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Credit Cards — CRUD', () => {
  test('add min fields', async ({ page }) => {
    await ensureTestBankAccount(page);

    await page.goto('/finance/credit-cards');
    const name = testName('card');

    await page.locator(`[data-testid="${M}-add-button"]`).click();
    await expect(page.locator(`[data-testid="${M}-form"]`)).toBeVisible();

    const bankSelect = page.locator(`[data-testid="${M}-form-bank-account-id"]`);
    const firstVal = await bankSelect
      .locator('option')
      .nth(1)
      .getAttribute('value');
    test.skip(!firstVal, 'No bank account option available');

    await bankSelect.selectOption(firstVal!);
    await page.locator(`[data-testid="${M}-form-card-name"]`).fill(name);
    await page
      .locator(`[data-testid="${M}-form-last-four-digits"]`)
      .fill('1234');

    const billing = page.locator(`[data-testid="${M}-form-billing-day"]`);
    if (await billing.isVisible()) await billing.fill('10');
    const closing = page.locator(`[data-testid="${M}-form-closing-day"]`);
    if (await closing.isVisible()) await closing.fill('2');

    await page.locator(`[data-testid="${M}-form-submit"]`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await expect(await findRowByText(page, M, name)).toBeVisible({
      timeout: 10_000,
    });
  });
});
