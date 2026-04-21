import { test, expect } from '@playwright/test';
import { BASE_URL } from '../utils/config';

// من src/middleware.ts
const BYPASS_EXACT = [
  '/login',
  '/api/auth/login',
  '/api/health',
  '/favicon.ico',
  '/manifest.json',
  '/offline.html',
  '/sw.js',
];
// /setup بيرجع redirect لـ / إذا الـ setup كامل. ما نختبره هون.

const PROTECTED = [
  '/',
  '/daily-log',
  '/equipment',
  '/vehicles',
  '/workers',
  '/fuel',
  '/expenses',
  '/invoices',
  '/budget',
  '/help',
  '/finance',
  '/finance/cash-flow',
  '/finance/credit-cards',
  '/finance/checks',
  '/finance/standing-orders',
  '/finance/transactions',
  '/finance/debts',
  '/finance/reconciliation',
  '/reports',
  '/reports/accountant',
  '/reports/budget-report',
  '/reports/cost-analysis',
  '/reports/fuel',
  '/reports/workers',
  '/settings',
  '/settings/pricing',
  '/settings/equipment-types',
  '/settings/users',
  '/settings/clients',
  '/api/auth/logout',
];

test.describe('Middleware — Bypass (7 مسارات exact)', () => {
  for (const path of BYPASS_EXACT) {
    test(`bypass: ${path} بدون توكن ≠ redirect للـ login`, async () => {
      const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' });
      if ([302, 307].includes(res.status)) {
        expect(res.headers.get('location') ?? '').not.toContain('/login');
      }
    });
  }
});

test.describe(`Middleware — Protected (${PROTECTED.length} مسار)`, () => {
  for (const path of PROTECTED) {
    test(`protected: ${path} بدون توكن → redirect /login`, async ({ page }) => {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }
});

test.describe('Middleware — Static bypass', () => {
  for (const path of [
    '/test.png',
    '/styles.css',
    '/app.js',
    '/font.woff2',
  ]) {
    test(`static: ${path} ≠ redirect`, async () => {
      const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' });
      if ([302, 307].includes(res.status)) {
        expect(res.headers.get('location') ?? '').not.toContain('/login');
      }
    });
  }
});
