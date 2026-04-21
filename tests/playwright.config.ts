import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';
import { resolve } from 'node:path';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true, // RBAC tests مستقلة تماماً
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : 5, // كل الاختبارات read-only
  globalSetup: resolve('./global-setup.ts'),
  globalTeardown: resolve('./global-teardown.ts'),
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'https://smart-management.pages.dev',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
