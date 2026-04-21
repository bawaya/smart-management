import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { submitAndWait, waitForServerAction } from './ui-helpers.js';

/**
 * Add a worker row to the daily-log form (dynamic rows pattern).
 * Clicks "+ הוסף עובד" then fills the new row.
 */
export async function addWorkerRow(
  page: Page,
  data: { workerId: string; dailyRate: string; revenue: string },
): Promise<void> {
  const addBtn = page.locator('[data-testid="daily-log-form-worker-add"]');
  await addBtn.click();

  const rows = page.locator('[data-testid="daily-log-form-worker-row"]');
  await expect(rows.last()).toBeVisible({ timeout: 3_000 });

  const newRow = rows.last();
  await newRow
    .locator('[data-testid="daily-log-form-worker-select"]')
    .selectOption(data.workerId);
  await newRow
    .locator('[data-testid="daily-log-form-worker-rate"]')
    .fill(data.dailyRate);
  await newRow
    .locator('[data-testid="daily-log-form-worker-revenue"]')
    .fill(data.revenue);
}

export async function removeWorkerRow(page: Page, index: number): Promise<void> {
  const rows = page.locator('[data-testid="daily-log-form-worker-row"]');
  await rows
    .nth(index)
    .locator('[data-testid="daily-log-form-worker-remove"]')
    .click();
}

export async function countWorkerRows(page: Page): Promise<number> {
  return page.locator('[data-testid="daily-log-form-worker-row"]').count();
}

/**
 * Confirm a daily-log via the ConfirmModal (status: draft → confirmed).
 */
export async function confirmDailyLogByText(
  page: Page,
  rowText: string,
): Promise<{ status: 'success' | 'error' | 'unknown'; message: string | null }> {
  const row = page
    .locator('[data-testid="daily-log-list"]:visible')
    .locator('[data-testid="daily-log-row"]')
    .filter({ hasText: rowText })
    .first();

  const confirmBtn = row.locator('[data-testid="daily-log-row-confirm"]');
  await confirmBtn.click();

  const modal = page.locator('[data-testid="daily-log-confirm-modal"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  const result = await submitAndWait(
    page,
    '[data-testid="daily-log-confirm-submit"]',
  );
  await waitForServerAction(page);
  return result;
}

/**
 * Get first non-empty option value from a select dropdown.
 */
export async function getFirstDropdownOptionValue(
  page: Page,
  dropdownTestId: string,
): Promise<string | null> {
  const select = page.locator(`[data-testid="${dropdownTestId}"]`);
  const options = await select.locator('option').all();
  for (const opt of options) {
    const val = await opt.getAttribute('value');
    if (val && val !== '') return val;
  }
  return null;
}
