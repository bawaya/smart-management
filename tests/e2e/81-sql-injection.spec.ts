import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';
import { SQL_PAYLOADS } from '../utils/security-payloads';
import { addEntry } from '../utils/master-helpers';

test.use({ storageState: storageStatePath('owner') });
test.setTimeout(120_000);

const SQL_ERROR_PATTERNS = [
  /SQLITE_/,
  /D1_ERROR/,
  /near ["'][^"']+["']: syntax error/i,
  /unrecognized token/i,
  /no such column/i,
];

async function assertNoSQLError(page: Page, path: string): Promise<void> {
  const body = await page.locator('body').innerText().catch(() => '');
  for (const p of SQL_ERROR_PATTERNS) {
    expect(body, `SQL error visible on ${path} — matched ${p}`).not.toMatch(p);
  }
}

test.describe('SQL Injection — CRUD Inputs', () => {
  test('workers.full_name SQL payloads', async ({ page }) => {
    await page.goto('/workers');
    for (const payload of SQL_PAYLOADS) {
      await addEntry(page, 'workers', { 'full-name': payload });
      await assertNoSQLError(page, '/workers');
    }
    await page.goto('/workers');
    await assertNoSQLError(page, '/workers');
  });

  test('clients.name SQL payloads', async ({ page }) => {
    await page.goto('/settings/clients');
    for (const payload of SQL_PAYLOADS) {
      await addEntry(page, 'clients', { name: payload });
      await assertNoSQLError(page, '/settings/clients');
    }
  });

  test('no sensitive data leakage in list output', async ({ page }) => {
    await page.goto('/workers');
    const allRows = await page
      .locator('[data-testid="workers-row"]:visible')
      .allTextContents();

    // Check for actual hash values — bcrypt prefix `$2a$`/`$2b$`/`$2y$` followed
    // by cost + base64 hash. Don't match the word "password_hash" alone because
    // that appears literally in our own UNION SELECT payload which was stored
    // as inert text (which is the expected safe outcome).
    for (const text of allRows) {
      expect(
        text,
        'Row leaks a bcrypt hash value',
      ).not.toMatch(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
    }
  });
});

test.describe('SQL Injection — URL Parameters', () => {
  test('invoice detail with injected ID stays safe', async ({ page }) => {
    const payloads = [
      `1' OR '1'='1`,
      `1; DROP TABLE users`,
      `1 UNION SELECT * FROM users`,
    ];
    for (const p of payloads) {
      await page.goto(`/invoices/${encodeURIComponent(p)}`);
      await assertNoSQLError(page, `/invoices/${p}`);
    }
  });

  test('search/filter params stay safe', async ({ page }) => {
    const injections = [
      `/workers?name=${encodeURIComponent(`' OR '1'='1`)}`,
      `/expenses?category=${encodeURIComponent(`' UNION SELECT *--`)}`,
    ];
    for (const path of injections) {
      await page.goto(path);
      await assertNoSQLError(page, path);
    }
  });
});
