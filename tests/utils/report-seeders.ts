import type { Page } from '@playwright/test';
import { testName } from './test-data.js';
import { addEntry } from './master-helpers.js';
import { BASE_URL } from './config.js';

/** Seed N expenses with same amount in same category. Returns total. */
export async function seedExpenses(
  page: Page,
  data: { count: number; amount: number; category: string; date: string },
): Promise<number> {
  await page.goto(`${BASE_URL}/expenses`);
  for (let i = 0; i < data.count; i++) {
    const result = await addEntry(page, 'expenses', {
      'expense-date': data.date,
      category: data.category,
      amount: String(data.amount),
      description: testName(`rep-${data.category}`),
    });
    if (result.status === 'error') {
      throw new Error(`Seed expense failed: ${result.message}`);
    }
  }
  return data.count * data.amount;
}

/** Seed N fuel records on first available vehicle. */
export async function seedFuelRecords(
  page: Page,
  data: { count: number; liters: number; pricePerLiter: number; date: string },
): Promise<{ totalLiters: number; totalCost: number; vehicleId: string }> {
  await page.goto(`${BASE_URL}/fuel`);
  await page.locator('[data-testid="fuel-add-button"]').click();
  await page.waitForSelector('[data-testid="fuel-form"]');
  const vehSelect = page.locator('[data-testid="fuel-form-vehicle-id"]');
  const vehVal = await vehSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  if (!vehVal) throw new Error('No vehicles available');
  await page.locator('[data-testid="fuel-form-cancel"]').click();

  for (let i = 0; i < data.count; i++) {
    const result = await addEntry(page, 'fuel', {
      'record-date': data.date,
      'vehicle-id': vehVal,
      liters: String(data.liters),
      'price-per-liter': String(data.pricePerLiter),
      'station-name': testName('rep-fuel'),
    });
    if (result.status === 'error') {
      throw new Error(`Seed fuel failed: ${result.message}`);
    }
  }
  return {
    totalLiters: data.count * data.liters,
    totalCost: data.count * data.liters * data.pricePerLiter,
    vehicleId: vehVal,
  };
}

/**
 * Parse a number from a currency-formatted string.
 * Examples: "₪ 1,500.00" → 1500, "1,500" → 1500, "—" → 0
 */
export function parseNumber(text: string | null | undefined): number {
  if (!text) return 0;
  const cleaned = text.replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Read a number from a testid element. */
export async function readReportNumber(
  page: Page,
  testId: string,
): Promise<number> {
  const text = await page.locator(`[data-testid="${testId}"]`).textContent();
  return parseNumber(text);
}

/** Get current month's date range + mid-month for safe seeding. */
export function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const midMonth = new Date(year, month, 15).toISOString().slice(0, 10);
  return { start, end, midMonth, year, month: month + 1 };
}
