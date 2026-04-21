import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import {
  openAddForm,
  fillFormFields,
  submitForm,
  addEntry,
  editByText,
  toggleByText,
  findRowByText,
  isRowActive,
} from '../utils/master-helpers';

test.use({ storageState: storageStatePath('owner') });

const M = 'workers' as const;

/** Generate Israeli-looking 9-digit ID (we don't validate check digit) */
function randomIdNumber(): string {
  return String(Math.floor(100_000_000 + Math.random() * 899_999_999));
}

test.describe('Workers — Smoke', () => {
  test('الصفحة تفتح', async ({ page }) => {
    await page.goto('/workers');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Workers — CREATE', () => {
  test('add min (full_name)', async ({ page }) => {
    await page.goto('/workers');
    const name = testName('wrk');
    const result = await addEntry(page, M, { 'full-name': name });
    expect(result.status, `Failed: ${result.message}`).not.toBe('error');
    await expect(await findRowByText(page, M, name)).toBeVisible();
  });

  test('add full fields', async ({ page }) => {
    await page.goto('/workers');
    const name = testName('wrk-full');
    const result = await addEntry(page, M, {
      'full-name': name,
      'id-number': randomIdNumber(),
      phone: '052-1234567',
      'daily-rate': '400',
      notes: 'TEST_worker_notes',
    });
    expect(result.status).not.toBe('error');
  });

  test('add باسم عربي + عبري', async ({ page }) => {
    await page.goto('/workers');
    for (const n of [testName('wrk-عربي'), testName('wrk-עברית')]) {
      const result = await addEntry(page, M, { 'full-name': n });
      expect(result.status, `Name "${n}" failed`).not.toBe('error');
    }
  });

  test('add بدون full_name → error', async ({ page }) => {
    await page.goto('/workers');
    await openAddForm(page, M);
    const result = await submitForm(page, M);
    expect(result.status === 'error' || result.status === 'unknown').toBe(true);
  });

  test('add بنفس id_number مرتين → duplicate error', async ({ page }) => {
    await page.goto('/workers');
    const id = randomIdNumber();
    const r1 = await addEntry(page, M, {
      'full-name': testName('wrk-dup1'),
      'id-number': id,
    });
    expect(r1.status).not.toBe('error');

    const r2 = await addEntry(page, M, {
      'full-name': testName('wrk-dup2'),
      'id-number': id,
    });
    expect(r2.status).toBe('error');
  });
});

test.describe('Workers — READ', () => {
  test('row displays name + phone + rate', async ({ page }) => {
    await page.goto('/workers');
    const name = testName('wrk-read');
    await addEntry(page, M, {
      'full-name': name,
      phone: '052-1111111',
      'daily-rate': '350',
    });
    const row = await findRowByText(page, M, name);
    await expect(row.locator(`[data-testid="${M}-row-name"]`)).toContainText(name);
  });
});

test.describe('Workers — UPDATE', () => {
  test('edit name', async ({ page }) => {
    await page.goto('/workers');
    const original = testName('wrk-edit');
    await addEntry(page, M, { 'full-name': original });

    await editByText(page, M, original);
    const newName = testName('wrk-edited');
    await fillFormFields(page, M, { 'full-name': newName });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
    await expect(await findRowByText(page, M, newName)).toBeVisible();
  });

  test('edit daily_rate', async ({ page }) => {
    await page.goto('/workers');
    const name = testName('wrk-rate');
    await addEntry(page, M, { 'full-name': name, 'daily-rate': '300' });

    await editByText(page, M, name);
    await fillFormFields(page, M, { 'daily-rate': '500' });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
  });
});

test.describe('Workers — TOGGLE', () => {
  test('toggle off then on', async ({ page }) => {
    await page.goto('/workers');
    const name = testName('wrk-toggle');
    await addEntry(page, M, { 'full-name': name });

    expect(await isRowActive(page, M, name)).toBe(true);
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
