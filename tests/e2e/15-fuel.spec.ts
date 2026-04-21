import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import {
  openAddForm,
  fillFormFields,
  submitForm,
  editByText,
  deleteByText,
} from '../utils/master-helpers';

test.use({ storageState: storageStatePath('owner') });

const M = 'fuel' as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function firstVehicleValue(page: import('@playwright/test').Page) {
  return page
    .locator(`[data-testid="${M}-form-vehicle-id"] option`)
    .nth(1)
    .getAttribute('value');
}

test.describe('Fuel — Smoke', () => {
  test('الصفحة تفتح', async ({ page }) => {
    await page.goto('/fuel');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Fuel — CREATE', () => {
  test('add min fields', async ({ page }) => {
    await page.goto('/fuel');
    await openAddForm(page, M);
    const firstVal = await firstVehicleValue(page);
    if (!firstVal) {
      throw new Error('No vehicle available for fuel test — seed one first');
    }

    await fillFormFields(page, M, {
      'record-date': todayISO(),
      'vehicle-id': firstVal,
      liters: '50',
      'price-per-liter': '6.5',
      notes: testName('fuel-min'),
    });
    const result = await submitForm(page, M);
    expect(result.status, `Failed: ${result.message}`).not.toBe('error');
  });

  test('add with all fields', async ({ page }) => {
    await page.goto('/fuel');
    await openAddForm(page, M);
    const firstVal = await firstVehicleValue(page);
    test.skip(!firstVal, 'No vehicle available');

    await fillFormFields(page, M, {
      'record-date': todayISO(),
      'vehicle-id': firstVal!,
      liters: '75',
      'price-per-liter': '7.0',
      odometer: '123456',
      'station-name': 'TEST_station',
      'receipt-ref': 'TEST_R001',
      notes: testName('fuel-full'),
    });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
  });

  test('add بدون vehicle → error', async ({ page }) => {
    await page.goto('/fuel');
    await openAddForm(page, M);
    await fillFormFields(page, M, {
      'record-date': todayISO(),
      liters: '50',
      'price-per-liter': '6.5',
      notes: testName('fuel-novehicle'),
    });
    const result = await submitForm(page, M);
    expect(result.status === 'error' || result.status === 'unknown').toBe(true);
  });
});

test.describe('Fuel — UPDATE', () => {
  test('edit liters', async ({ page }) => {
    await page.goto('/fuel');
    await openAddForm(page, M);
    const firstVal = await firstVehicleValue(page);
    test.skip(!firstVal, 'No vehicle available');

    const marker = testName('fuel-edit');
    await fillFormFields(page, M, {
      'record-date': todayISO(),
      'vehicle-id': firstVal!,
      liters: '50',
      'price-per-liter': '6.5',
      'station-name': marker,
    });
    await submitForm(page, M);

    await editByText(page, M, marker);
    await fillFormFields(page, M, { liters: '100' });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
  });
});

test.describe('Fuel — DELETE', () => {
  test('delete fuel record', async ({ page }) => {
    await page.goto('/fuel');
    await openAddForm(page, M);
    const firstVal = await firstVehicleValue(page);
    test.skip(!firstVal, 'No vehicle available');

    const marker = testName('fuel-del');
    await fillFormFields(page, M, {
      'record-date': todayISO(),
      'vehicle-id': firstVal!,
      liters: '30',
      'price-per-liter': '6.0',
      'station-name': marker,
    });
    await submitForm(page, M);

    const result = await deleteByText(page, M, marker);
    expect(result.status).not.toBe('error');

    const rows = page
      .locator(`[data-testid="${M}-row"]:visible`)
      .filter({ hasText: marker });
    await expect(rows).toHaveCount(0, { timeout: 5_000 });
  });
});
