import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import {
  openAddForm,
  fillFormFields,
  submitForm,
  addEntry,
  editByText,
  deleteByText,
  findRowByText,
} from '../utils/master-helpers';

test.use({ storageState: storageStatePath('owner') });

const M = 'expenses' as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

test.describe('Expenses — Smoke', () => {
  test('الصفحة تفتح', async ({ page }) => {
    await page.goto('/expenses');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Expenses — CREATE', () => {
  test('add office expense', async ({ page }) => {
    await page.goto('/expenses');
    const desc = testName('exp-office');
    const result = await addEntry(page, M, {
      'expense-date': todayISO(),
      category: 'office',
      amount: '150',
      description: desc,
    });
    expect(result.status, `Failed: ${result.message}`).not.toBe('error');
    await expect(await findRowByText(page, M, desc)).toBeVisible();
  });

  test('add sample of categories', async ({ page }) => {
    await page.goto('/expenses');
    // 4 representative categories (vehicle-linked, worker-linked, unlinked, other)
    // — full 11-category coverage isn't needed for smoke; reduces prod load.
    const sampleCategories = ['fuel', 'worker_payment', 'office', 'other'];
    for (const cat of sampleCategories) {
      const desc = testName(`exp-${cat}`);
      const result = await addEntry(page, M, {
        'expense-date': todayISO(),
        category: cat,
        amount: '50',
        description: desc,
      });
      expect(
        result.status,
        `Category "${cat}" failed: ${result.message}`,
      ).not.toBe('error');
    }
  });

  test('add بدون amount → error', async ({ page }) => {
    await page.goto('/expenses');
    await openAddForm(page, M);
    await fillFormFields(page, M, {
      'expense-date': todayISO(),
      category: 'office',
      description: testName('exp-noamount'),
    });
    const result = await submitForm(page, M);
    expect(result.status === 'error' || result.status === 'unknown').toBe(true);
  });

  test('add بـ amount سالب → error', async ({ page }) => {
    await page.goto('/expenses');
    await openAddForm(page, M);
    await fillFormFields(page, M, {
      'expense-date': todayISO(),
      category: 'office',
      amount: '-50',
      description: testName('exp-negative'),
    });
    const result = await submitForm(page, M);
    expect(result.status === 'error' || result.status === 'unknown').toBe(true);
  });
});

test.describe('Expenses — UPDATE', () => {
  test('edit amount', async ({ page }) => {
    await page.goto('/expenses');
    const desc = testName('exp-edit');
    await addEntry(page, M, {
      'expense-date': todayISO(),
      category: 'office',
      amount: '100',
      description: desc,
    });

    await editByText(page, M, desc);
    await fillFormFields(page, M, { amount: '250' });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
  });

  test('edit category', async ({ page }) => {
    await page.goto('/expenses');
    const desc = testName('exp-cat');
    await addEntry(page, M, {
      'expense-date': todayISO(),
      category: 'office',
      amount: '100',
      description: desc,
    });

    await editByText(page, M, desc);
    await fillFormFields(page, M, { category: 'phone' });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
  });
});

test.describe('Expenses — DELETE', () => {
  test('delete expense', async ({ page }) => {
    await page.goto('/expenses');
    const desc = testName('exp-del');
    await addEntry(page, M, {
      'expense-date': todayISO(),
      category: 'other',
      amount: '75',
      description: desc,
    });

    const result = await deleteByText(page, M, desc);
    expect(result.status).not.toBe('error');

    const rows = page
      .locator(`[data-testid="${M}-row"]:visible`)
      .filter({ hasText: desc });
    await expect(rows).toHaveCount(0, { timeout: 5_000 });
  });
});
