import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import { findRowByText } from '../utils/master-helpers';
import { ensureTestBankAccount, todayISO } from '../utils/finance-helpers';

test.use({ storageState: storageStatePath('owner') });
const M = 'transactions' as const;

test.describe('Transactions — Smoke', () => {
  test('الصפחה תפתחת', async ({ page }) => {
    await page.goto('/finance/transactions');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Transactions — CRUD', () => {
  test('add transaction', async ({ page }) => {
    await ensureTestBankAccount(page);

    await page.goto('/finance/transactions');
    await page.locator(`[data-testid="${M}-add-button"]`).click();
    await expect(page.locator(`[data-testid="${M}-form"]`)).toBeVisible();

    const marker = testName('tx');
    await page
      .locator(`[data-testid="${M}-form-transaction-date"]`)
      .fill(todayISO());

    const typeSelect = page.locator(
      `[data-testid="${M}-form-transaction-type"]`,
    );
    const firstType = await typeSelect
      .locator('option')
      .nth(1)
      .getAttribute('value');
    if (firstType) await typeSelect.selectOption(firstType);

    await page.locator(`[data-testid="${M}-form-amount"]`).fill('1000');
    await page.locator(`[data-testid="${M}-form-description"]`).fill(marker);

    // direction (sr-only radio)
    const dirRadio = page.locator(
      `[data-testid="${M}-form-direction"] input[value="in"]`,
    );
    if ((await dirRadio.count()) > 0) {
      await dirRadio.check({ force: true });
    }

    // bank_account_id (optional)
    const bankSelect = page.locator(`[data-testid="${M}-form-bank-account-id"]`);
    if (await bankSelect.isVisible()) {
      const firstBank = await bankSelect
        .locator('option')
        .nth(1)
        .getAttribute('value');
      if (firstBank) await bankSelect.selectOption(firstBank);
    }

    await page.locator(`[data-testid="${M}-form-submit"]`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await expect(await findRowByText(page, M, marker)).toBeVisible({
      timeout: 10_000,
    });
  });
});
