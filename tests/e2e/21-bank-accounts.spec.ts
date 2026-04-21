import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import {
  fillFormFields,
  submitForm,
  addEntry,
  editByText,
  toggleByText,
  findRowByText,
  isRowActive,
} from '../utils/master-helpers';

test.use({ storageState: storageStatePath('owner') });
const M = 'bank-accounts' as const;

test.describe('Bank Accounts — Smoke', () => {
  test('الصفحة תפתחת', async ({ page }) => {
    await page.goto('/finance');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Bank Accounts — CRUD', () => {
  test('add min fields', async ({ page }) => {
    await page.goto('/finance');
    const name = testName('bank');
    const result = await addEntry(page, M, {
      'bank-name': name,
      'account-number': `TEST_${Date.now()}`,
      'account-name': 'TEST_holder',
    });
    expect(result.status, `Failed: ${result.message}`).not.toBe('error');
    await expect(await findRowByText(page, M, name)).toBeVisible();
  });

  test('add with balance', async ({ page }) => {
    await page.goto('/finance');
    const name = testName('bank-balance');
    const result = await addEntry(page, M, {
      'bank-name': name,
      'account-number': `TEST_${Date.now()}`,
      'account-name': 'TEST_holder',
      'current-balance': '50000',
    });
    expect(result.status).not.toBe('error');
  });

  test('edit account_name', async ({ page }) => {
    await page.goto('/finance');
    const name = testName('bank-edit');
    await addEntry(page, M, {
      'bank-name': name,
      'account-number': `TEST_${Date.now()}`,
      'account-name': 'TEST_original',
    });
    await editByText(page, M, name);
    await fillFormFields(page, M, { 'account-name': 'TEST_updated' });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
  });

  test('toggle off/on', async ({ page }) => {
    await page.goto('/finance');
    const name = testName('bank-toggle');
    await addEntry(page, M, {
      'bank-name': name,
      'account-number': `TEST_${Date.now()}`,
      'account-name': 'TEST_holder',
    });
    await toggleByText(page, M, name);
    await expect
      .poll(() => isRowActive(page, M, name), { timeout: 5_000 })
      .toBe(false);
    await toggleByText(page, M, name);
    await expect
      .poll(() => isRowActive(page, M, name), { timeout: 5_000 })
      .toBe(true);
  });
});
