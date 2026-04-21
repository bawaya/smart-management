import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import { findRowByText } from '../utils/master-helpers';
import { ensureTestBankAccount, todayISO } from '../utils/finance-helpers';

test.use({ storageState: storageStatePath('owner') });
const M = 'standing-orders' as const;

test.describe('Standing Orders — Smoke', () => {
  test('الصפחה תפתחת', async ({ page }) => {
    await page.goto('/finance/standing-orders');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Standing Orders — CRUD', () => {
  test('add monthly order', async ({ page }) => {
    await ensureTestBankAccount(page);

    await page.goto('/finance/standing-orders');
    await page.locator(`[data-testid="${M}-add-button"]`).click();
    await expect(page.locator(`[data-testid="${M}-form"]`)).toBeVisible();

    const bankSelect = page.locator(`[data-testid="${M}-form-bank-account-id"]`);
    const firstBank = await bankSelect
      .locator('option')
      .nth(1)
      .getAttribute('value');
    test.skip(!firstBank, 'No bank option');

    const payee = testName('so');
    await bankSelect.selectOption(firstBank!);
    await page.locator(`[data-testid="${M}-form-payee-name"]`).fill(payee);
    await page.locator(`[data-testid="${M}-form-amount"]`).fill('500');
    await page
      .locator(`[data-testid="${M}-form-frequency"]`)
      .selectOption('monthly');
    const dayField = page.locator(`[data-testid="${M}-form-day-of-month"]`);
    if (await dayField.isVisible()) await dayField.fill('15');
    await page
      .locator(`[data-testid="${M}-form-start-date"]`)
      .fill(todayISO());

    await page.locator(`[data-testid="${M}-form-submit"]`).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    await expect(await findRowByText(page, M, payee)).toBeVisible({
      timeout: 10_000,
    });
  });
});
