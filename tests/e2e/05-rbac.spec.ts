import { test, expect, type Page } from '@playwright/test';
import { BASE_URL, type Role } from '../utils/config';
import { storageStatePath } from '../utils/storage-state';

/**
 * مصفوفة RBAC من src/lib/auth/rbac.ts + mapping الصفحات للـ permissions.
 * 29 صفحة × 5 أدوار = 145 test case (+ 1 sanity).
 * (الـ [id] dynamic routes مش ضمن المصفوفة — بتشارك permission الصفحة الأب.)
 */

type PageDef = {
  url: string;
  allowed: Role[];
};

const ALL: Role[] = ['owner', 'manager', 'accountant', 'operator', 'viewer'];

const PAGES: PageDef[] = [
  // كل الأدوار
  { url: '/',                         allowed: ALL },
  { url: '/daily-log',                allowed: ALL },
  { url: '/help',                     allowed: ALL },

  // equipment / workers — owner + manager
  { url: '/equipment',                allowed: ['owner', 'manager'] },
  { url: '/vehicles',                 allowed: ['owner', 'manager'] },
  { url: '/workers',                  allowed: ['owner', 'manager'] },

  // daily_log.write — owner + manager + operator
  { url: '/fuel',                     allowed: ['owner', 'manager', 'operator'] },
  { url: '/expenses',                 allowed: ['owner', 'manager', 'operator'] },

  // invoices / budget — owner + accountant
  { url: '/invoices',                 allowed: ['owner', 'accountant'] },
  { url: '/budget',                   allowed: ['owner', 'accountant'] },

  // finance (+ 7 sub) — owner + accountant
  { url: '/finance',                  allowed: ['owner', 'accountant'] },
  { url: '/finance/cash-flow',        allowed: ['owner', 'accountant'] },
  { url: '/finance/credit-cards',     allowed: ['owner', 'accountant'] },
  { url: '/finance/checks',           allowed: ['owner', 'accountant'] },
  { url: '/finance/standing-orders',  allowed: ['owner', 'accountant'] },
  { url: '/finance/transactions',     allowed: ['owner', 'accountant'] },
  { url: '/finance/debts',            allowed: ['owner', 'accountant'] },
  { url: '/finance/reconciliation',   allowed: ['owner', 'accountant'] },

  // reports (+ 5 sub) — owner + manager + accountant
  { url: '/reports',                  allowed: ['owner', 'manager', 'accountant'] },
  { url: '/reports/accountant',       allowed: ['owner', 'manager', 'accountant'] },
  { url: '/reports/budget-report',    allowed: ['owner', 'manager', 'accountant'] },
  { url: '/reports/cost-analysis',    allowed: ['owner', 'manager', 'accountant'] },
  { url: '/reports/fuel',             allowed: ['owner', 'manager', 'accountant'] },
  { url: '/reports/workers',          allowed: ['owner', 'manager', 'accountant'] },

  // settings (+ 4 sub) — owner فقط
  { url: '/settings',                 allowed: ['owner'] },
  { url: '/settings/pricing',         allowed: ['owner'] },
  { url: '/settings/equipment-types', allowed: ['owner'] },
  { url: '/settings/users',           allowed: ['owner'] },
  { url: '/settings/clients',         allowed: ['owner'] },
];

/**
 * محاولة وصول + تأكد من السلوك:
 *  - allowed: final URL === target path
 *  - denied:  final URL === '/' (silent redirect من الـ Server Component)
 */
async function assertAccess(page: Page, path: string, shouldAllow: boolean) {
  const response = await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
  });

  if (shouldAllow) {
    // Allow: give any unexpected client-side redirect up to networkidle to fire.
    await page.waitForLoadState('networkidle').catch(() => {});
    const finalPath = new URL(page.url()).pathname;
    expect(
      finalPath,
      `${path} should be accessible → got redirected to ${finalPath}`,
    ).toBe(path);
    expect(response?.status() ?? 200, `5xx on allowed ${path}`).toBeLessThan(500);
  } else {
    // Deny: the server-side redirect(' / ') from Next's redirect() updates the
    // URL after domcontentloaded. Wait explicitly for the URL to become '/'.
    await page
      .waitForURL((url) => url.pathname === '/', { timeout: 8_000 })
      .catch(() => {
        // falls through — the expect below gives a clearer failure message
      });
    const finalPath = new URL(page.url()).pathname;
    expect(
      finalPath,
      `${path} should be denied → landed on ${finalPath} instead of /`,
    ).toBe('/');
  }
}

// توليد المصفوفة كاملة
for (const pageDef of PAGES) {
  for (const role of ALL) {
    const shouldAllow = pageDef.allowed.includes(role);
    const tag = shouldAllow ? '✓ allow' : '✗ deny';

    test.describe(`[${role}] ${pageDef.url}`, () => {
      test.use({ storageState: storageStatePath(role) });

      test(`${tag}`, async ({ page }) => {
        await assertAccess(page, pageDef.url, shouldAllow);
      });
    });
  }
}

test('sanity: المصفوفة كاملة (29 صفحة × 5 أدوار = 145)', () => {
  expect(PAGES.length).toBe(29);
  const totalCells = PAGES.length * ALL.length;
  expect(totalCells).toBe(145);
});
