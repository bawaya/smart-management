import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';

/**
 * Deny pattern (from Phase 3 RBAC): server-side redirect lands on '/'.
 * Login-required pattern: redirect lands on '/login'.
 */

test.describe('Auth Bypass — Direct URL Access (viewer role)', () => {
  test.use({ storageState: storageStatePath('viewer') });

  test('viewer cannot access /settings/users', async ({ page }) => {
    await page.goto('/settings/users', { waitUntil: 'domcontentloaded' });
    await page
      .waitForURL((url) => url.pathname === '/', { timeout: 8_000 })
      .catch(() => {});
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('Auth Bypass — Direct URL Access (operator role)', () => {
  test.use({ storageState: storageStatePath('operator') });

  test('operator cannot access /invoices', async ({ page }) => {
    await page.goto('/invoices', { waitUntil: 'domcontentloaded' });
    await page
      .waitForURL((url) => url.pathname === '/', { timeout: 8_000 })
      .catch(() => {});
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('Auth Bypass — Direct URL Access (accountant role)', () => {
  test.use({ storageState: storageStatePath('accountant') });

  test('accountant cannot access /equipment (CRUD page)', async ({ page }) => {
    await page.goto('/equipment', { waitUntil: 'domcontentloaded' });
    await page
      .waitForURL((url) => url.pathname === '/', { timeout: 8_000 })
      .catch(() => {});
    expect(new URL(page.url()).pathname).toBe('/');
  });
});

test.describe('Auth Bypass — No/Invalid Credentials', () => {
  test('no cookie → redirect to login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/invoices', { waitUntil: 'domcontentloaded' });
    await page
      .waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 8_000 })
      .catch(() => {});
    expect(new URL(page.url()).pathname).toMatch(/^\/login/);
    await ctx.close();
  });

  test('tampered JWT cookie → login redirect', async ({ browser }) => {
    const ctx = await browser.newContext();
    await ctx.addCookies([
      {
        name: 'auth-token',
        value: 'eyJhbGciOiJIUzI1NiJ9.tampered.signature',
        domain: 'smart-management.pages.dev',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await ctx.newPage();
    await page.goto('/invoices', { waitUntil: 'domcontentloaded' });
    await page
      .waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 8_000 })
      .catch(() => {});
    expect(new URL(page.url()).pathname).toMatch(/^\/login/);
    await ctx.close();
  });
});

test.describe('Auth Bypass — Cross-Tenant / Invalid Resource ID', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('invoice detail with non-existent ID → no data leak', async ({
    page,
  }) => {
    await page.goto('/invoices/999999999-fake-id', {
      waitUntil: 'domcontentloaded',
    });
    const body = await page.locator('body').innerText().catch(() => '');
    expect(body).not.toMatch(/password_hash|\$2[aby]\$|SQLITE_/i);
  });
});
