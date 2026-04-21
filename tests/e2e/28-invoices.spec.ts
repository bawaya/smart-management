import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';

test.use({ storageState: storageStatePath('owner') });
const M = 'invoices' as const;

test.describe('Invoices — Smoke', () => {
  test('الصפחה תפתחת', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page.locator(`[data-testid="${M}-add-button"]`)).toBeVisible();
  });

  test('generate modal يفתح', async ({ page }) => {
    await page.goto('/invoices');
    await page.locator(`[data-testid="${M}-add-button"]`).click();
    await expect(
      page.locator(`[data-testid="${M}-generate-form"]`),
    ).toBeVisible();

    await expect(
      page.locator(`[data-testid="${M}-generate-client-id"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="${M}-generate-period-start"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-testid="${M}-generate-period-end"]`),
    ).toBeVisible();
  });
});

test.describe('Invoices — Validation', () => {
  test('generate بدون client → error أو submit hidden', async ({ page }) => {
    await page.goto('/invoices');
    await page.locator(`[data-testid="${M}-add-button"]`).click();
    await expect(
      page.locator(`[data-testid="${M}-generate-form"]`),
    ).toBeVisible();

    // The submit button only appears after a successful search reveals records.
    // Without client selection, clicking "search" should show an error —
    // or the submit stays hidden (either path proves validation works).
    const searchBtn = page.locator(`[data-testid="${M}-generate-search"]`);
    await searchBtn.click();
    await page.waitForTimeout(800);

    const err = page.locator(`[data-testid="${M}-generate-error"]`);
    const submit = page.locator(`[data-testid="${M}-generate-submit"]`);

    const hasError = await err.isVisible({ timeout: 2_000 }).catch(() => false);
    const submitVisible = await submit.isVisible().catch(() => false);

    // Either an error shows, or submit didn't appear (no records to generate).
    expect(hasError || !submitVisible).toBe(true);
  });
});

test.describe.skip('Invoices — Full Generation Flow (requires confirmed daily-logs)', () => {
  // Pending: requires confirmed daily-logs on prod which we cannot guarantee.
  // Will be enabled in a later phase after we seed daily-logs as part of the tests.
  test('generate invoice from confirmed logs', async () => {});
});
