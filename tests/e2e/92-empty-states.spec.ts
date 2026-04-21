import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';

test.use({ storageState: storageStatePath('owner') });

const MODULES_WITH_EMPTY_STATE: Array<{
  path: string;
  testid: string;
  name: string;
}> = [
  { path: '/equipment', testid: 'equipment-empty', name: 'equipment' },
  { path: '/vehicles', testid: 'vehicles-empty', name: 'vehicles' },
  { path: '/workers', testid: 'workers-empty', name: 'workers' },
  { path: '/fuel', testid: 'fuel-empty', name: 'fuel' },
  { path: '/expenses', testid: 'expenses-empty', name: 'expenses' },
  { path: '/daily-log', testid: 'daily-log-empty', name: 'daily-log' },
  { path: '/invoices', testid: 'invoices-empty', name: 'invoices' },
  { path: '/settings/clients', testid: 'clients-empty', name: 'clients' },
  {
    path: '/settings/equipment-types',
    testid: 'equipment-types-empty',
    name: 'equipment-types',
  },
  { path: '/finance', testid: 'bank-accounts-empty', name: 'bank-accounts' },
  {
    path: '/finance/credit-cards',
    testid: 'credit-cards-empty',
    name: 'credit-cards',
  },
  { path: '/finance/checks', testid: 'checks-empty', name: 'checks' },
  {
    path: '/finance/standing-orders',
    testid: 'standing-orders-empty',
    name: 'standing-orders',
  },
  {
    path: '/finance/transactions',
    testid: 'transactions-empty',
    name: 'transactions',
  },
  { path: '/finance/debts', testid: 'debts-empty', name: 'debts' },
  {
    path: '/finance/reconciliation',
    testid: 'reconciliation-empty',
    name: 'reconciliation',
  },
];

test.describe('Empty States — each CRUD module renders empty OR list', () => {
  for (const { path, testid, name } of MODULES_WITH_EMPTY_STATE) {
    test(`${name} — ${testid} or list element present`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});

      const emptyEl = page.locator(`[data-testid="${testid}"]`);
      const moduleId = testid.replace('-empty', '');
      const listEl = page.locator(`[data-testid="${moduleId}-list"]:visible`);

      const emptyCount = await emptyEl.count();
      const hasList = (await listEl.count()) > 0;

      expect(
        emptyCount > 0 || hasList,
        `Neither ${testid} nor ${moduleId}-list rendered on ${path} — page likely broken`,
      ).toBe(true);
    });
  }

  test('reports page loads with some content', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle').catch(() => {});
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Application error/i);
    expect(body.length).toBeGreaterThan(50);
  });
});
