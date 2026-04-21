import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';

test.use({ storageState: storageStatePath('owner') });

// All owner-accessible pages (paths verified against src/app/(dashboard)/).
const PAGES: Array<{ path: string; name: string }> = [
  // Main (10)
  { path: '/', name: 'dashboard' },
  { path: '/daily-log', name: 'daily-log' },
  { path: '/equipment', name: 'equipment' },
  { path: '/vehicles', name: 'vehicles' },
  { path: '/workers', name: 'workers' },
  { path: '/fuel', name: 'fuel' },
  { path: '/expenses', name: 'expenses' },
  { path: '/invoices', name: 'invoices' },
  { path: '/budget', name: 'budget' },
  { path: '/help', name: 'help' },

  // Finance (8)
  { path: '/finance', name: 'finance-bank-accounts' },
  { path: '/finance/cash-flow', name: 'finance-cash-flow' },
  { path: '/finance/credit-cards', name: 'finance-credit-cards' },
  { path: '/finance/checks', name: 'finance-checks' },
  { path: '/finance/standing-orders', name: 'finance-standing-orders' },
  { path: '/finance/transactions', name: 'finance-transactions' },
  { path: '/finance/debts', name: 'finance-debts' },
  { path: '/finance/reconciliation', name: 'finance-reconciliation' },

  // Reports (6) — matches src/app/(dashboard)/reports/ subdirs
  { path: '/reports', name: 'reports' },
  { path: '/reports/accountant', name: 'reports-accountant' },
  { path: '/reports/budget-report', name: 'reports-budget' },
  { path: '/reports/cost-analysis', name: 'reports-cost-analysis' },
  { path: '/reports/fuel', name: 'reports-fuel' },
  { path: '/reports/workers', name: 'reports-workers' },

  // Settings (5) — matches src/app/(dashboard)/settings/ subdirs
  { path: '/settings', name: 'settings' },
  { path: '/settings/users', name: 'settings-users' },
  { path: '/settings/clients', name: 'settings-clients' },
  { path: '/settings/equipment-types', name: 'settings-equipment-types' },
  { path: '/settings/pricing', name: 'settings-pricing' },
];

/**
 * Patterns that indicate a page crash/error.
 */
const CRASH_PATTERNS = [
  /Application error/i,
  /500:\s*INTERNAL/i,
  /TypeError:/,
  /ReferenceError:/,
  /Cannot read propert/i,
  /is not a function/i,
  /Hydration failed/i,
];

test.describe('Smoke — All Pages Render Without Crash', () => {
  for (const { path, name } of PAGES) {
    test(`${name} — ${path} loads clean`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(`PAGEERROR: ${err.message}`);
      });

      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (response) {
        const status = response.status();
        expect(status, `HTTP ${status} on ${path}`).toBeLessThan(500);
      }

      const bodyText = await page
        .locator('body')
        .innerText()
        .catch(() => '');
      for (const pattern of CRASH_PATTERNS) {
        expect(
          bodyText,
          `Crash pattern ${pattern} found on ${path}`,
        ).not.toMatch(pattern);
      }

      const nextError = page
        .locator('[data-nextjs-dialog]')
        .or(page.locator('text=/Unhandled Runtime Error/i'));
      const hasRuntimeError = await nextError
        .isVisible({ timeout: 1_000 })
        .catch(() => false);
      expect(hasRuntimeError, `Runtime error visible on ${path}`).toBe(false);

      const crashyConsoleErrors = consoleErrors.filter((e) =>
        CRASH_PATTERNS.some((p) => p.test(e)),
      );
      expect(
        crashyConsoleErrors,
        `Console crash on ${path}:\n${crashyConsoleErrors.join('\n')}`,
      ).toHaveLength(0);
    });
  }
});
