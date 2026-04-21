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

const M = 'vehicles' as const;

test.describe('Vehicles — Smoke', () => {
  test('الصفحة تفتح', async ({ page }) => {
    await page.goto('/vehicles');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Vehicles — CREATE', () => {
  test('add min fields (name + plate)', async ({ page }) => {
    await page.goto('/vehicles');
    const name = testName('veh');
    const plate = `TEST-${Date.now() % 100000}`;

    const result = await addEntry(page, M, {
      name,
      'license-plate': plate,
    });
    expect(result.status, `Submit failed: ${result.message}`).not.toBe('error');

    const row = await findRowByText(page, M, name);
    await expect(row).toBeVisible({ timeout: 10_000 });
  });

  test('add full fields (owned)', async ({ page }) => {
    await page.goto('/vehicles');
    const name = testName('veh-full');

    const result = await addEntry(page, M, {
      name,
      'license-plate': `TEST-${Date.now() % 100000}`,
      type: { type: 'radio', value: 'owned' },
      'insurance-expiry': '2027-06-30',
      'license-expiry': '2027-12-31',
      'annual-insurance-cost': '3500',
      'annual-license-cost': '1200',
      notes: 'TEST_vehicle_full',
    });
    expect(result.status).not.toBe('error');
  });

  test('add type=rented', async ({ page }) => {
    await page.goto('/vehicles');
    const name = testName('veh-rented');

    const result = await addEntry(page, M, {
      name,
      'license-plate': `TEST-${Date.now() % 100000}`,
      type: { type: 'radio', value: 'rented' },
    });
    expect(result.status).not.toBe('error');
  });

  test('add بدون plate → error', async ({ page }) => {
    await page.goto('/vehicles');
    await openAddForm(page, M);
    await fillFormFields(page, M, { name: testName('veh-noplate') });
    const result = await submitForm(page, M);
    expect(result.status === 'error' || result.status === 'unknown').toBe(true);
  });
});

test.describe('Vehicles — READ', () => {
  test('row name + plate visible', async ({ page }) => {
    await page.goto('/vehicles');
    const name = testName('veh-read');
    const plate = `TEST-${Date.now() % 100000}`;
    await addEntry(page, M, { name, 'license-plate': plate });

    const row = await findRowByText(page, M, name);
    await expect(row.locator(`[data-testid="${M}-row-name"]`)).toContainText(name);
    await expect(row.locator(`[data-testid="${M}-row-plate"]`)).toContainText(plate);
  });
});

test.describe('Vehicles — UPDATE', () => {
  test('edit name', async ({ page }) => {
    await page.goto('/vehicles');
    const original = testName('veh-edit');
    await addEntry(page, M, {
      name: original,
      'license-plate': `TEST-${Date.now() % 100000}`,
    });

    await editByText(page, M, original);
    const newName = testName('veh-edited');
    await fillFormFields(page, M, { name: newName });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');

    await expect(await findRowByText(page, M, newName)).toBeVisible();
  });
});

test.describe('Vehicles — TOGGLE (is_active)', () => {
  test('toggle off → row shows inactive', async ({ page }) => {
    await page.goto('/vehicles');
    const name = testName('veh-toggle');
    await addEntry(page, M, {
      name,
      'license-plate': `TEST-${Date.now() % 100000}`,
    });

    expect(await isRowActive(page, M, name)).toBe(true);
    const result = await toggleByText(page, M, name);
    expect(result.status).not.toBe('error');
    await expect
      .poll(() => isRowActive(page, M, name), { timeout: 5_000 })
      .toBe(false);
  });

  test('toggle off → on (cycle)', async ({ page }) => {
    await page.goto('/vehicles');
    const name = testName('veh-cycle');
    await addEntry(page, M, {
      name,
      'license-plate': `TEST-${Date.now() % 100000}`,
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
