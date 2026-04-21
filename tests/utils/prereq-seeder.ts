import type { Page } from '@playwright/test';
import { testName } from './test-data.js';
import { addEntry } from './master-helpers.js';
import { BASE_URL } from './config.js';

/**
 * Ensures at least one TEST_ client exists. Returns its display name so the
 * test can select it in a dropdown by text filter.
 */
export async function ensureTestClient(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/settings/clients`);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  const testRows = page
    .locator('[data-testid="clients-row"]:visible')
    .filter({ hasText: 'TEST_' });
  if ((await testRows.count()) > 0) {
    const name = await testRows
      .first()
      .locator('[data-testid="clients-row-name"]')
      .textContent();
    if (name?.startsWith('TEST_')) return name;
  }

  const name = testName('cli-prereq');
  const result = await addEntry(page, 'clients', { name });
  if (result.status === 'error') {
    throw new Error(`Failed to create TEST client: ${result.message}`);
  }
  return name;
}

export async function ensureTestWorker(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/workers`);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  const testRows = page
    .locator('[data-testid="workers-row"]:visible')
    .filter({ hasText: 'TEST_' });
  if ((await testRows.count()) > 0) {
    const name = await testRows
      .first()
      .locator('[data-testid="workers-row-name"]')
      .textContent();
    if (name?.startsWith('TEST_')) return name;
  }

  const name = testName('wrk-prereq');
  const result = await addEntry(page, 'workers', { 'full-name': name });
  if (result.status === 'error') {
    throw new Error(`Failed to create TEST worker: ${result.message}`);
  }
  return name;
}

/**
 * Returns name of any existing equipment row, or null if none exist on prod.
 * Daily-log needs equipment; creating one requires a type FK + status handling,
 * so we rely on an existing record. Tests should test.skip() when null.
 */
export async function ensureEquipmentAvailable(
  page: Page,
): Promise<string | null> {
  await page.goto(`${BASE_URL}/equipment`);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  const rows = page.locator('[data-testid="equipment-row"]:visible');
  if ((await rows.count()) === 0) return null;

  const testRow = rows.filter({ hasText: 'TEST_' }).first();
  const source = (await testRow.count()) > 0 ? testRow : rows.first();
  const name = await source
    .locator('[data-testid="equipment-row-name"]')
    .textContent();
  return name?.trim() ?? null;
}

/**
 * Creates a fresh unique TEST_ client (not reused). Returns its name and id.
 * Useful for daily-log tests where we need a unique client to identify the
 * resulting row (since the daily-log row displays client_name, not project_name).
 */
export async function createUniqueTestClient(
  page: Page,
): Promise<{ name: string; id: string }> {
  await page.goto(`${BASE_URL}/settings/clients`);
  const name = testName('cli-unique');
  const result = await addEntry(page, 'clients', { name });
  if (result.status === 'error') {
    throw new Error(`Failed to create unique TEST client: ${result.message}`);
  }
  const row = page
    .locator('[data-testid="clients-row"]:visible')
    .filter({ hasText: name })
    .first();
  const id = (await row.getAttribute('data-client-id')) ?? '';
  if (!id) throw new Error('Could not read client id from new row');
  return { name, id };
}

export async function getOptionalVehicle(page: Page): Promise<string | null> {
  await page.goto(`${BASE_URL}/vehicles`);
  const testRow = page
    .locator('[data-testid="vehicles-row"]:visible')
    .filter({ hasText: 'TEST_' })
    .first();
  if ((await testRow.count()) === 0) return null;
  return (
    (await testRow
      .locator('[data-testid="vehicles-row-name"]')
      .textContent())?.trim() ?? null
  );
}
