import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { testName } from '../utils/test-data';
import { addEntry } from '../utils/master-helpers';
import { getBudgetedAmount } from '../utils/flow-helpers';
import { todayISO } from '../utils/finance-helpers';

test.use({ storageState: storageStatePath('owner') });
test.setTimeout(90_000);

/**
 * Helper: open the budget update modal (not auto-shown on /budget).
 */
async function openBudgetModal(page: Page): Promise<void> {
  await page.goto('/budget');
  await page
    .waitForLoadState('networkidle', { timeout: 10_000 })
    .catch(() => {});
  const updateBtn = page
    .locator('[data-testid="budget-update-button"]')
    .first();
  await expect(updateBtn).toBeVisible({ timeout: 5_000 });
  await updateBtn.click();
  await expect(page.locator('[data-testid="budget-form"]')).toBeVisible({
    timeout: 5_000,
  });
}

async function fillBudgetCategoryAndSubmit(
  page: Page,
  category: string,
  amount: string,
): Promise<boolean> {
  const row = page
    .locator(
      `[data-testid="budget-category-row"][data-budget-category="${category}"]`,
    )
    .first();
  const rowCount = await row.count();
  if (rowCount === 0) {
    const total = await page
      .locator('[data-testid="budget-category-row"]')
      .count();
    const cats = await page
      .locator('[data-testid="budget-category-row"]')
      .evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-budget-category')),
      );
    console.log(
      `[DEBUG] category=${category} not found. total rows=${total}, categories=${JSON.stringify(cats)}`,
    );
    return false;
  }

  await row.locator('[data-testid="budget-category-amount"]').fill(amount);
  await page.locator('[data-testid="budget-submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const err = page.locator('[data-testid="budget-error"]');
  const hasError = await err.isVisible().catch(() => false);
  if (hasError) {
    const msg = await err.textContent();
    console.log(`[DEBUG] budget-error visible: ${msg}`);
  }
  return !hasError;
}

test.describe('Flow D — Budget Cycle', () => {
  test('set budget for office → add expenses → budget intact', async ({
    page,
  }) => {
    // Step 1: set budget for 'office' = 2000
    await openBudgetModal(page);
    const saved = await fillBudgetCategoryAndSubmit(page, 'expense_office', '2000');
    expect(saved, 'Budget save should not error').toBe(true);
    console.log(`[D] ✓ Budget set: expense_office = 2000`);

    // Step 2: verify budget persisted
    const persisted = await getBudgetedAmount(page, 'expense_office');
    console.log(`[D]   persisted value: ${persisted}`);
    expect(persisted).toBe(2000);
    console.log(`[D] ✓ Budget persisted`);

    // Step 3: add 2 office expenses
    for (const amount of ['500', '300']) {
      await page.goto('/expenses');
      const desc = testName(`exp-office-${amount}`);
      const result = await addEntry(page, 'expenses', {
        'expense-date': todayISO(),
        category: 'office',
        amount,
        description: desc,
      });
      expect(result.status).not.toBe('error');
      console.log(`[D] ✓ Expense added: office ${amount} (${desc})`);
    }

    // Step 4: re-check budget — adding expenses doesn't corrupt budget value
    const after = await getBudgetedAmount(page, 'expense_office');
    expect(after).toBe(2000);
    console.log(`[D] ✓ Budget intact after expenses: ${after}`);
  });

  test('upsert budget twice → no crash, final value wins', async ({ page }) => {
    // First save: 1000
    await openBudgetModal(page);
    const ok1 = await fillBudgetCategoryAndSubmit(page, 'expense_office', '1000');
    expect(ok1).toBe(true);
    console.log(`[D-U] ✓ First save: 1000`);

    // Second save: 1500 (same year/month/category)
    await openBudgetModal(page);
    const ok2 = await fillBudgetCategoryAndSubmit(page, 'expense_office', '1500');
    expect(ok2, 'Second save should not crash — DELETE+INSERT pattern avoids UNIQUE violation').toBe(true);
    console.log(`[D-U] ✓ Second save: 1500 (no crash)`);

    // Verify final value
    const final = await getBudgetedAmount(page, 'expense_office');
    expect(final).toBe(1500);
    console.log(`[D-U] ✓ Final value: ${final}`);
  });
});
