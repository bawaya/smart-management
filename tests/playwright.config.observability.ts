/**
 * Isolated Playwright config for the observability spec.
 *
 * Why a separate config:
 *  - The default `playwright.config.ts` has a `globalSetup` that builds
 *    storage states for 5 roles via UI login. If the `.env` creds are
 *    out of sync with prod, the whole suite aborts before any test runs.
 *  - The observability spec doesn't need those storage states — it uses
 *    a short-lived viewer user seeded by `seed-observability-user.ts`.
 *  - Skipping globalSetup / globalTeardown keeps this spec runnable
 *    independently of the rest of the suite.
 *
 * Usage:
 *  - Don't call this directly. Use the orchestrator:
 *      npm run test:observability
 *    which seeds the user, runs this config, then cleans up.
 */

import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: './e2e',
  testMatch: /93-observability\.spec\.ts$/,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // wrangler exec is expensive; avoid D1 rate-limit bursts
  workers: 1,
  retries: 0,
  reporter: [['list']],
  // globalSetup / globalTeardown intentionally omitted — this spec is self-contained
  use: {
    baseURL: process.env.BASE_URL ?? 'https://smart-management.pages.dev',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
