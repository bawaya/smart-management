import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import {
  ensureTestBankAccount,
  advanceReconciliationToStep2,
  todayISO,
} from '../utils/finance-helpers';

test.use({ storageState: storageStatePath('owner') });
const M = 'reconciliation' as const;

test.describe('Reconciliation — Smoke', () => {
  test('الصפחה תפתחת', async ({ page }) => {
    await page.goto('/finance/reconciliation');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Reconciliation — 2-step flow', () => {
  test('create reconciliation (step 1 → step 2 → submit)', async ({ page }) => {
    await ensureTestBankAccount(page);

    await page.goto('/finance/reconciliation');
    await page.locator(`[data-testid="${M}-add-button"]`).click();
    await expect(page.locator(`[data-testid="${M}-form"]`)).toBeVisible();

    // Step 1
    const bankSelect = page.locator(`[data-testid="${M}-form-bank-account-id"]`);
    const firstBank = await bankSelect
      .locator('option')
      .nth(1)
      .getAttribute('value');
    test.skip(!firstBank, 'No bank option');

    await bankSelect.selectOption(firstBank!);
    await page
      .locator(`[data-testid="${M}-form-reconciliation-date"]`)
      .fill(todayISO());
    await page
      .locator(`[data-testid="${M}-form-statement-balance"]`)
      .fill('10000');

    await advanceReconciliationToStep2(page);

    // Step 2: submit
    const submit = page.locator(`[data-testid="${M}-form-submit"]`);
    await expect(submit).toBeVisible({ timeout: 5_000 });
    await submit.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    const err = page.locator(`[data-testid="${M}-form-error"]`);
    expect(await err.isVisible().catch(() => false)).toBe(false);
  });
});
