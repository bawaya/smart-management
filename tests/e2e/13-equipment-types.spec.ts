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

const M = 'equipment-types' as const;

test.describe('Equipment Types — Smoke', () => {
  test('الصفحة تفتح', async ({ page }) => {
    await page.goto('/settings/equipment-types');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Equipment Types — CREATE', () => {
  test('add min (name)', async ({ page }) => {
    await page.goto('/settings/equipment-types');
    const name = testName('type');
    const result = await addEntry(page, M, { name });
    expect(result.status).not.toBe('error');
    await expect(await findRowByText(page, M, name)).toBeVisible();
  });

  test('add بدون name → error', async ({ page }) => {
    await page.goto('/settings/equipment-types');
    await openAddForm(page, M);
    const result = await submitForm(page, M);
    expect(result.status === 'error' || result.status === 'unknown').toBe(true);
  });
});

test.describe('Equipment Types — UPDATE', () => {
  test('edit name', async ({ page }) => {
    await page.goto('/settings/equipment-types');
    const original = testName('type-edit');
    await addEntry(page, M, { name: original });

    await editByText(page, M, original);
    const newName = testName('type-edited');
    await fillFormFields(page, M, { name: newName });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
    await expect(await findRowByText(page, M, newName)).toBeVisible();
  });
});

test.describe('Equipment Types — DELETE (hard)', () => {
  test('delete type غير مستخدم → يختفي', async ({ page }) => {
    await page.goto('/settings/equipment-types');
    const name = testName('type-del');
    await addEntry(page, M, { name });

    const result = await deleteByText(page, M, name);
    expect(result.status).not.toBe('error');

    const rows = page
      .locator(`[data-testid="${M}-row"]:visible`)
      .filter({ hasText: name });
    await expect(rows).toHaveCount(0, { timeout: 5_000 });
  });
});
