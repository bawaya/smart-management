import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { testName } from './test-data.js';
import {
  addEntry,
  openAddForm,
  submitForm,
} from './master-helpers.js';
import { recordInvoicePayment, todayISO } from './finance-helpers.js';
import { submitAndWait, waitForServerAction } from './ui-helpers.js';
import { BASE_URL } from './config.js';

/** Step 1: create a unique TEST_ client for this flow. */
export async function createFlowClient(
  page: Page,
  rates?: { equipment: string; worker: string },
): Promise<string> {
  await page.goto(`${BASE_URL}/settings/clients`);
  const name = testName('flow-cli');
  const fields: Record<string, string> = { name };
  if (rates) {
    fields['equipment-rate'] = rates.equipment;
    fields['worker-rate'] = rates.worker;
  }
  const result = await addEntry(page, 'clients', fields);
  if (result.status === 'error') {
    throw new Error(`createFlowClient failed: ${result.message}`);
  }
  return name;
}

/**
 * Step 2: pick an existing equipment row (must be 'available' to appear in
 * daily-log's equipment dropdown). Creating new equipment needs FK + status
 * handling, so we reuse prod data.
 */
export async function pickAvailableEquipment(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/equipment`);
  await page
    .waitForLoadState('networkidle', { timeout: 10_000 })
    .catch(() => {});

  const rows = page.locator('[data-testid="equipment-row"]:visible');
  if ((await rows.count()) === 0) {
    throw new Error('No equipment available on prod — seed one first');
  }
  const name = await rows
    .first()
    .locator('[data-testid="equipment-row-name"]')
    .textContent();
  if (!name?.trim()) throw new Error('Could not read equipment name');
  return name.trim();
}

/** Step 3: create a unique TEST_ worker. */
export async function createFlowWorker(
  page: Page,
  dailyRate = '400',
): Promise<string> {
  await page.goto(`${BASE_URL}/workers`);
  const name = testName('flow-wrk');
  const result = await addEntry(page, 'workers', {
    'full-name': name,
    'daily-rate': dailyRate,
  });
  if (result.status === 'error') {
    throw new Error(`createFlowWorker failed: ${result.message}`);
  }
  return name;
}

/**
 * Step 4: create a daily-log with equipment_revenue + 1 worker assignment.
 * Returns the projectName used in the form (stored server-side but not
 * always displayed on the row).
 */
export async function createFlowDailyLog(
  page: Page,
  data: {
    clientName: string;
    equipmentName: string;
    workerName: string;
    equipmentRevenue: string;
    workerRate: string;
    workerRevenue: string;
  },
): Promise<string> {
  await page.goto(`${BASE_URL}/daily-log`);
  await openAddForm(page, 'daily-log');

  await page
    .locator('[data-testid="daily-log-form-client-id"]')
    .selectOption({ label: data.clientName });

  // Equipment dropdown shows "Name (Type)" format — labels don't match raw name.
  // Pick the first real (non-placeholder) option instead.
  const equipSelect = page.locator(
    '[data-testid="daily-log-form-equipment-id"]',
  );
  const firstEquipVal = await equipSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  if (!firstEquipVal) {
    throw new Error('No equipment option in daily-log form');
  }
  await equipSelect.selectOption(firstEquipVal);

  const projectName = testName('flow-proj');
  await page
    .locator('[data-testid="daily-log-form-log-date"]')
    .fill(todayISO());
  await page
    .locator('[data-testid="daily-log-form-equipment-revenue"]')
    .fill(data.equipmentRevenue);
  await page
    .locator('[data-testid="daily-log-form-project-name"]')
    .fill(projectName);

  // add worker row
  await page.locator('[data-testid="daily-log-form-worker-add"]').click();
  const lastRow = page
    .locator('[data-testid="daily-log-form-worker-row"]')
    .last();
  await expect(lastRow).toBeVisible({ timeout: 3_000 });

  await lastRow
    .locator('[data-testid="daily-log-form-worker-select"]')
    .selectOption({ label: data.workerName });
  await lastRow
    .locator('[data-testid="daily-log-form-worker-rate"]')
    .fill(data.workerRate);
  await lastRow
    .locator('[data-testid="daily-log-form-worker-revenue"]')
    .fill(data.workerRevenue);

  const result = await submitForm(page, 'daily-log');
  if (result.status === 'error') {
    throw new Error(`createFlowDailyLog failed: ${result.message}`);
  }
  await waitForServerAction(page);
  return projectName;
}

/**
 * Step 5: Generate invoice for client covering date range.
 * Returns the invoice number from the resulting row.
 */
export async function generateInvoiceForClient(
  page: Page,
  data: { clientName: string; periodStart: string; periodEnd: string },
): Promise<string> {
  await page.goto(`${BASE_URL}/invoices`);
  await page.locator('[data-testid="invoices-add-button"]').click();
  await expect(
    page.locator('[data-testid="invoices-generate-form"]'),
  ).toBeVisible({ timeout: 5_000 });

  await page
    .locator('[data-testid="invoices-generate-client-id"]')
    .selectOption({ label: data.clientName });
  await page
    .locator('[data-testid="invoices-generate-period-start"]')
    .fill(data.periodStart);
  await page
    .locator('[data-testid="invoices-generate-period-end"]')
    .fill(data.periodEnd);

  await page.locator('[data-testid="invoices-generate-search"]').click();
  await waitForServerAction(page);

  const submitBtn = page.locator('[data-testid="invoices-generate-submit"]');
  await expect(submitBtn).toBeVisible({ timeout: 5_000 });
  await submitBtn.click();
  await waitForServerAction(page);

  // Find the newly created invoice by client name (unique per test).
  await page.goto(`${BASE_URL}/invoices`);
  const invoiceRow = page
    .locator('[data-testid="invoices-row"]:visible')
    .filter({ hasText: data.clientName })
    .first();
  await expect(invoiceRow).toBeVisible({ timeout: 10_000 });

  const invoiceNumber = await invoiceRow
    .locator('[data-testid="invoices-row-number"]')
    .textContent();
  if (!invoiceNumber?.trim()) {
    throw new Error('Could not read invoice number from new row');
  }
  return invoiceNumber.trim();
}

/**
 * Step 6: mark invoice as sent (draft → sent). The Payment action requires
 * status=sent|partial in the UI, so this is a prerequisite for payInvoice.
 */
export async function sendInvoiceByNumber(
  page: Page,
  invoiceNumber: string,
): Promise<{ status: 'success' | 'error' | 'unknown'; message: string | null }> {
  await page.goto(`${BASE_URL}/invoices`);
  const row = page
    .locator('[data-testid="invoices-row"]:visible')
    .filter({ hasText: invoiceNumber })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.locator('[data-testid="invoices-row-send"]').click();

  const modal = page.locator('[data-testid="invoices-send-modal"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  const result = await submitAndWait(
    page,
    '[data-testid="invoices-send-confirm"]',
  );
  await waitForServerAction(page);
  return result;
}

/**
 * Step 7: record payment on invoice. Requires status=sent|partial for the
 * row-payment button to appear (InvoicesManager row logic).
 */
export async function payInvoiceByNumber(
  page: Page,
  invoiceNumber: string,
  amount: string,
): Promise<{ status: 'success' | 'error' | 'unknown'; message: string | null }> {
  await page.goto(`${BASE_URL}/invoices`);
  const row = page
    .locator('[data-testid="invoices-row"]:visible')
    .filter({ hasText: invoiceNumber })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.locator('[data-testid="invoices-row-payment"]').click();
  await waitForServerAction(page);

  return recordInvoicePayment(page, {
    amount,
    paymentDate: todayISO(),
  });
}

/** Step B: cancel invoice via row-cancel button + confirm modal. */
export async function cancelInvoiceByNumber(
  page: Page,
  invoiceNumber: string,
): Promise<{ status: 'success' | 'error' | 'unknown'; message: string | null }> {
  await page.goto(`${BASE_URL}/invoices`);
  const row = page
    .locator('[data-testid="invoices-row"]:visible')
    .filter({ hasText: invoiceNumber })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.locator('[data-testid="invoices-row-cancel"]').click();

  const cancelModal = page.locator('[data-testid="invoices-cancel-modal"]');
  await expect(cancelModal).toBeVisible({ timeout: 5_000 });

  const result = await submitAndWait(
    page,
    '[data-testid="invoices-cancel-confirm"]',
  );
  await waitForServerAction(page);
  return result;
}

/** Read invoice status label (Hebrew) from row. */
export async function getInvoiceStatus(
  page: Page,
  invoiceNumber: string,
): Promise<string> {
  await page.goto(`${BASE_URL}/invoices`);
  const row = page
    .locator('[data-testid="invoices-row"]:visible')
    .filter({ hasText: invoiceNumber })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const status = await row
    .locator('[data-testid="invoices-row-status"]')
    .textContent();
  return (status ?? '').trim();
}

/**
 * Flow D — read a category's saved budget amount by opening the update modal.
 * The display on /budget main page shows "תקציב X / ביצוע Y" as plain text
 * without per-field testids — the editable value is inside the modal.
 * Returns null if the category row doesn't exist.
 */
export async function getBudgetedAmount(
  page: Page,
  category: string,
): Promise<number | null> {
  await page.goto(`${BASE_URL}/budget`);
  await page
    .waitForLoadState('networkidle', { timeout: 10_000 })
    .catch(() => {});

  const updateBtn = page
    .locator('[data-testid="budget-update-button"]')
    .first();
  if ((await updateBtn.count()) === 0) return null;
  await updateBtn.click();
  await expect(page.locator('[data-testid="budget-form"]')).toBeVisible({
    timeout: 5_000,
  });

  const row = page
    .locator(
      `[data-testid="budget-category-row"][data-budget-category="${category}"]`,
    )
    .first();
  if ((await row.count()) === 0) {
    await page.locator('[data-testid="budget-cancel"]').click().catch(() => {});
    return null;
  }
  const input = row.locator('[data-testid="budget-category-amount"]');
  const val = await input.inputValue();

  // Close the modal so subsequent navigation is clean.
  await page.locator('[data-testid="budget-cancel"]').click().catch(() => {});

  return val ? parseFloat(val) : null;
}

/**
 * Flow E — change a check's status via the StatusModal.
 * The modal uses a `<select data-testid="checks-status-select">` plus a
 * conditional bounce-reason input and a submit button.
 */
export async function changeCheckStatus(
  page: Page,
  checkIdentifier: string,
  newStatus: 'pending' | 'deposited' | 'cleared' | 'bounced' | 'cancelled' | 'post_dated',
  options?: { bounceReason?: string },
): Promise<{ status: 'success' | 'error' | 'unknown'; message: string | null }> {
  await page.goto(`${BASE_URL}/finance/checks`);
  const row = page
    .locator('[data-testid="checks-row"]:visible')
    .filter({ hasText: checkIdentifier })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });

  await row.locator('[data-testid="checks-row-status-change"]').click();
  const modal = page.locator('[data-testid="checks-status-modal"]');
  await expect(modal).toBeVisible({ timeout: 5_000 });

  await modal
    .locator('[data-testid="checks-status-select"]')
    .selectOption(newStatus);

  if (newStatus === 'bounced') {
    const reason = options?.bounceReason ?? 'TEST_reason';
    await modal
      .locator('[data-testid="checks-status-bounce-reason"]')
      .fill(reason);
  }

  const result = await submitAndWait(
    page,
    '[data-testid="checks-status-submit"]',
  );
  await waitForServerAction(page);
  return result;
}

/** Read a check's current status from its row. */
export async function getCheckStatus(
  page: Page,
  checkIdentifier: string,
): Promise<string> {
  await page.goto(`${BASE_URL}/finance/checks`);
  const row = page
    .locator('[data-testid="checks-row"]:visible')
    .filter({ hasText: checkIdentifier })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const status = await row
    .locator('[data-testid="checks-row-status"]')
    .textContent();
  return (status ?? '').trim();
}

/** Read daily-log status label from row (filtered by client name). */
export async function getDailyLogStatus(
  page: Page,
  clientName: string,
): Promise<string> {
  await page.goto(`${BASE_URL}/daily-log`);
  const row = page
    .locator('[data-testid="daily-log-row"]:visible')
    .filter({ hasText: clientName })
    .first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  const status = await row
    .locator('[data-testid="daily-log-row-status"]')
    .textContent();
  return (status ?? '').trim();
}
