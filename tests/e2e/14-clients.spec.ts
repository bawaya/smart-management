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

const M = 'clients' as const;

test.describe('Clients — Smoke', () => {
  test('الصفحة تفتح', async ({ page }) => {
    await page.goto('/settings/clients');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Clients — CREATE', () => {
  test('add min (name)', async ({ page }) => {
    await page.goto('/settings/clients');
    const name = testName('cli');
    const result = await addEntry(page, M, { name });
    expect(result.status, `Failed: ${result.message}`).not.toBe('error');
    await expect(await findRowByText(page, M, name)).toBeVisible();
  });

  test('add full fields', async ({ page }) => {
    await page.goto('/settings/clients');
    const name = testName('cli-full');
    const result = await addEntry(page, M, {
      name,
      'contact-person': 'TEST_contact',
      phone: '03-1234567',
      email: 'test@example.com',
      address: 'TEST_address_street',
      'tax-id': '123456789',
      'equipment-rate': '500',
      'worker-rate': '300',
      notes: 'TEST_client_notes',
    });
    expect(result.status).not.toBe('error');
  });

  test('add بدون name → error', async ({ page }) => {
    await page.goto('/settings/clients');
    await openAddForm(page, M);
    const result = await submitForm(page, M);
    expect(result.status === 'error' || result.status === 'unknown').toBe(true);
  });
});

test.describe('Clients — UPDATE', () => {
  test('edit name', async ({ page }) => {
    await page.goto('/settings/clients');
    const original = testName('cli-edit');
    await addEntry(page, M, { name: original });

    await editByText(page, M, original);
    const newName = testName('cli-edited');
    await fillFormFields(page, M, { name: newName });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');
    await expect(await findRowByText(page, M, newName)).toBeVisible();
  });
});

test.describe('Clients — TOGGLE', () => {
  test('toggle off/on cycle', async ({ page }) => {
    await page.goto('/settings/clients');
    const name = testName('cli-toggle');
    await addEntry(page, M, { name });

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
