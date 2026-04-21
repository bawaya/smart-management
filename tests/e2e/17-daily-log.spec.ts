import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import {
  openAddForm,
  fillFormFields,
  submitForm,
  editByText,
  findRowByText,
} from '../utils/master-helpers';
import { confirmDailyLogByText } from '../utils/daily-log-helpers';
import {
  ensureTestClient,
  ensureEquipmentAvailable,
  ensureTestWorker,
  createUniqueTestClient,
} from '../utils/prereq-seeder';

test.use({ storageState: storageStatePath('owner') });
// Prereq seeders add ~10-15s overhead; bump timeout accordingly.
test.setTimeout(60_000);

const M = 'daily-log' as const;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

async function firstNonEmptyOption(
  page: Page,
  selectTestId: string,
): Promise<string | null> {
  const options = await page
    .locator(`[data-testid="${selectTestId}"] option`)
    .all();
  for (const o of options) {
    const v = await o.getAttribute('value');
    if (v && v !== '') return v;
  }
  return null;
}

test.describe('Daily-log — Smoke', () => {
  test('الصفحة תפתחת', async ({ page }) => {
    await page.goto('/daily-log');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });
});

test.describe('Daily-log — CREATE', () => {
  test('add min fields (no workers)', async ({ page }) => {
    const client = await createUniqueTestClient(page);
    const eq = await ensureEquipmentAvailable(page);
    test.skip(!eq, 'No equipment on prod — seed one first');

    await page.goto('/daily-log');
    await openAddForm(page, M);

    const equipVal = await firstNonEmptyOption(page, `${M}-form-equipment-id`);
    test.skip(!equipVal, 'No equipment option');

    await fillFormFields(page, M, {
      'log-date': todayISO(),
      'client-id': client.id,
      'equipment-id': equipVal!,
      'equipment-revenue': '500',
      'project-name': testName('log-min'),
    });

    const result = await submitForm(page, M);
    expect(result.status, `Failed: ${result.message}`).not.toBe('error');

    // daily-log row displays client_name (not project_name) — filter by client
    await expect(await findRowByText(page, M, client.name)).toBeVisible();
  });

  test('add with 1 worker assignment', async ({ page }) => {
    await ensureTestClient(page);
    const eq = await ensureEquipmentAvailable(page);
    test.skip(!eq, 'No equipment on prod — seed one first');
    await ensureTestWorker(page);

    await page.goto('/daily-log');
    await openAddForm(page, M);

    const clientVal = await firstNonEmptyOption(page, `${M}-form-client-id`);
    const equipVal = await firstNonEmptyOption(page, `${M}-form-equipment-id`);
    test.skip(!clientVal || !equipVal, 'Prereq dropdowns empty');

    const marker = testName('log-1w');
    await fillFormFields(page, M, {
      'log-date': todayISO(),
      'client-id': clientVal!,
      'equipment-id': equipVal!,
      'equipment-revenue': '500',
      'project-name': marker,
    });

    // open a worker row, then read options and pick first non-empty
    await page.locator(`[data-testid="${M}-form-worker-add"]`).click();
    const lastRow = page
      .locator(`[data-testid="${M}-form-worker-row"]`)
      .last();
    await expect(lastRow).toBeVisible({ timeout: 3_000 });

    const workerOpts = await lastRow
      .locator(`[data-testid="${M}-form-worker-select"] option`)
      .all();
    let firstWorkerVal: string | null = null;
    for (const o of workerOpts) {
      const v = await o.getAttribute('value');
      if (v && v !== '') {
        firstWorkerVal = v;
        break;
      }
    }
    if (firstWorkerVal) {
      await lastRow
        .locator(`[data-testid="${M}-form-worker-select"]`)
        .selectOption(firstWorkerVal);
      await lastRow
        .locator(`[data-testid="${M}-form-worker-rate"]`)
        .fill('400');
      await lastRow
        .locator(`[data-testid="${M}-form-worker-revenue"]`)
        .fill('500');
    }

    const result = await submitForm(page, M);
    expect(result.status, `Failed: ${result.message}`).not.toBe('error');
  });

  test('add + remove worker row', async ({ page }) => {
    await ensureTestClient(page);
    const eq = await ensureEquipmentAvailable(page);
    test.skip(!eq, 'No equipment on prod — seed one first');

    await page.goto('/daily-log');
    await openAddForm(page, M);

    const addBtn = page.locator(`[data-testid="${M}-form-worker-add"]`);
    await addBtn.click();
    await expect(
      page.locator(`[data-testid="${M}-form-worker-row"]`),
    ).toHaveCount(1);

    await addBtn.click();
    await expect(
      page.locator(`[data-testid="${M}-form-worker-row"]`),
    ).toHaveCount(2);

    await page
      .locator(`[data-testid="${M}-form-worker-row"]`)
      .nth(1)
      .locator(`[data-testid="${M}-form-worker-remove"]`)
      .click();
    await expect(
      page.locator(`[data-testid="${M}-form-worker-row"]`),
    ).toHaveCount(1);
  });

  test('add بدون client → error', async ({ page }) => {
    await page.goto('/daily-log');
    await openAddForm(page, M);
    const equipVal = await firstNonEmptyOption(page, `${M}-form-equipment-id`);
    test.skip(!equipVal, 'No equipment option');

    await fillFormFields(page, M, {
      'log-date': todayISO(),
      'equipment-id': equipVal!,
      'equipment-revenue': '500',
      'project-name': testName('log-noclient'),
    });
    const result = await submitForm(page, M);
    expect(result.status === 'error' || result.status === 'unknown').toBe(true);
  });
});

test.describe('Daily-log — STATUS TRANSITION', () => {
  test('draft → confirmed via ConfirmModal', async ({ page }) => {
    const client = await createUniqueTestClient(page);
    const eq = await ensureEquipmentAvailable(page);
    test.skip(!eq, 'No equipment on prod — seed one first');

    await page.goto('/daily-log');
    await openAddForm(page, M);

    const equipVal = await firstNonEmptyOption(page, `${M}-form-equipment-id`);
    test.skip(!equipVal, 'No equipment option');

    await fillFormFields(page, M, {
      'log-date': todayISO(),
      'client-id': client.id,
      'equipment-id': equipVal!,
      'equipment-revenue': '500',
      'project-name': testName('log-confirm'),
    });
    await submitForm(page, M);

    const row = await findRowByText(page, M, client.name);
    const confirmBtn = row.locator(`[data-testid="${M}-row-confirm"]`);
    await expect(confirmBtn).toBeVisible();

    const result = await confirmDailyLogByText(page, client.name);
    expect(result.status, `Confirm failed: ${result.message}`).not.toBe(
      'error',
    );

    await page.reload();
    const rowAfter = await findRowByText(page, M, client.name);
    const statusText = await rowAfter
      .locator(`[data-testid="${M}-row-status"]`)
      .textContent();
    expect(statusText?.toLowerCase()).toMatch(
      /confirmed|מאושר|אישור|مؤكد/i,
    );
  });
});

test.describe('Daily-log — UPDATE', () => {
  test('edit project_name (while draft)', async ({ page }) => {
    const client = await createUniqueTestClient(page);
    const eq = await ensureEquipmentAvailable(page);
    test.skip(!eq, 'No equipment on prod — seed one first');

    await page.goto('/daily-log');
    await openAddForm(page, M);

    const equipVal = await firstNonEmptyOption(page, `${M}-form-equipment-id`);
    test.skip(!equipVal, 'No equipment option');

    await fillFormFields(page, M, {
      'log-date': todayISO(),
      'client-id': client.id,
      'equipment-id': equipVal!,
      'equipment-revenue': '500',
      'project-name': testName('log-edit'),
    });
    await submitForm(page, M);

    await editByText(page, M, client.name);
    await fillFormFields(page, M, { 'project-name': testName('log-edited') });
    const result = await submitForm(page, M);
    expect(result.status).not.toBe('error');

    // row still identified by same client name (project_name change doesn't
    // affect the displayed row text)
    await expect(await findRowByText(page, M, client.name)).toBeVisible();
  });
});
