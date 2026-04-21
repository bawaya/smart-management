import { test, expect } from '@playwright/test';
import { storageStatePath } from '../utils/storage-state';

test.use({ storageState: storageStatePath('owner') });

const REPORTS = [
  { path: '/reports', name: 'reports-index' },
  { path: '/reports/accountant', name: 'accountant' },
  { path: '/reports/budget-report', name: 'budget-report' },
  { path: '/reports/cost-analysis', name: 'cost-analysis' },
  { path: '/reports/fuel', name: 'fuel' },
  { path: '/reports/workers', name: 'workers' },
];

test.describe('Reports — Smoke + Content Render', () => {
  for (const { path, name } of REPORTS) {
    test(`${name} — renders with content`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => {});
      const body = await page.locator('body').innerText();
      expect(
        body.length,
        `${path} body too short — likely error`,
      ).toBeGreaterThan(100);
      expect(body).not.toMatch(
        /Application error|TypeError|undefined is not/i,
      );
    });
  }
});
