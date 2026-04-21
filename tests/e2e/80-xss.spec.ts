import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { XSS_PAYLOADS, XSS_MARKER_KEY } from '../utils/security-payloads';
import { addEntry } from '../utils/master-helpers';

test.use({ storageState: storageStatePath('owner') });
test.setTimeout(120_000);

async function assertNoXSSExecution(page: Page): Promise<void> {
  const triggered = await page.evaluate(
    (key: string) => (window as unknown as Record<string, unknown>)[key] === true,
    XSS_MARKER_KEY,
  );
  expect(triggered, 'XSS payload was executed in browser').toBe(false);
}

test.describe('XSS — User Input in Text Fields', () => {
  test('workers.full_name XSS payloads', async ({ page }) => {
    await page.goto('/workers');
    for (const payload of XSS_PAYLOADS) {
      await addEntry(page, 'workers', { 'full-name': payload });
      await assertNoXSSExecution(page);
    }
    await page.goto('/workers');
    await assertNoXSSExecution(page);
  });

  test('expenses.description XSS payloads', async ({ page }) => {
    await page.goto('/expenses');
    for (const payload of XSS_PAYLOADS) {
      await addEntry(page, 'expenses', {
        'expense-date': new Date().toISOString().slice(0, 10),
        category: 'other',
        amount: '10',
        description: payload,
      });
      await assertNoXSSExecution(page);
    }
    await page.goto('/expenses');
    await assertNoXSSExecution(page);
  });

  test('clients.name XSS payloads', async ({ page }) => {
    await page.goto('/settings/clients');
    for (const payload of XSS_PAYLOADS) {
      await addEntry(page, 'clients', { name: payload });
      await assertNoXSSExecution(page);
    }
    await page.goto('/settings/clients');
    await assertNoXSSExecution(page);
  });

  test('payloads render as escaped text, not as HTML', async ({ page }) => {
    await page.goto('/workers');
    const payload = `TEST_<script>window.__XSS_TRIGGERED=true</script>`;
    await addEntry(page, 'workers', { 'full-name': payload });

    await page.goto('/workers');
    const row = page
      .locator('[data-testid="workers-row"]:visible')
      .filter({ hasText: 'TEST_' })
      .first();
    const html = await row.innerHTML();

    // Raw executable <script> tag must not be present in rendered HTML
    expect(html).not.toMatch(/<script[^>]*>window\.__XSS_TRIGGERED/i);
    await assertNoXSSExecution(page);
  });
});

test.describe('XSS — URL Parameters', () => {
  test('search/filter query params do not execute', async ({ page }) => {
    const paths = [
      `/invoices?status=${encodeURIComponent(`<script>window.__XSS_TRIGGERED=true</script>`)}`,
      `/expenses?category=${encodeURIComponent(`"><script>window.__XSS_TRIGGERED=true</script>`)}`,
      `/daily-log?q=${encodeURIComponent(`<img src=x onerror="window.__XSS_TRIGGERED=true">`)}`,
    ];
    for (const path of paths) {
      await page.goto(path);
      await assertNoXSSExecution(page);
    }
  });
});
