import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';

test.use({ storageState: storageStatePath('owner') });

test.describe('Budget — Smoke', () => {
  test('الصفحة تفתחת', async ({ page }) => {
    await page.goto('/budget');
    await expect(page.locator('[data-testid="budget"]')).toBeVisible();
  });
});

test.describe('Budget — UPSERT', () => {
  test('save monthly budget for multiple categories', async ({ page }) => {
    await page.goto('/budget');
    await expect(page.locator('[data-testid="budget"]')).toBeVisible();

    // Click update button (header or empty-state) to open the modal form
    const updateBtn = page
      .locator('[data-testid="budget-update-button"]')
      .first();
    await expect(updateBtn).toBeVisible({ timeout: 5_000 });
    await updateBtn.click();

    await expect(page.locator('[data-testid="budget-form"]')).toBeVisible({
      timeout: 5_000,
    });

    // Fill planned amount for first 2 categories
    const rows = page.locator('[data-testid="budget-category-row"]');
    const count = await rows.count();
    test.skip(count === 0, 'No budget categories rendered');

    for (let i = 0; i < Math.min(count, 2); i++) {
      const amountInput = rows
        .nth(i)
        .locator('[data-testid="budget-category-amount"]');
      if (await amountInput.isVisible()) {
        await amountInput.fill('500');
      }
    }

    await page.locator('[data-testid="budget-submit"]').click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    const err = page.locator('[data-testid="budget-error"]');
    const hasError = await err.isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });
});
