/**
 * Phase 11 — Observability middleware tests.
 *
 * These tests verify `src/middleware.ts` fire-and-forget logging to the
 * `request_log` table in D1. They are strictly additive — they:
 *   - Do NOT modify or mock any source code
 *   - Do NOT write to any table directly
 *   - Do NOT touch tenant-scoped data; only send HTTP requests and READ
 *     the rows the middleware wrote on its own
 *
 * Isolation strategy:
 *   Each test sets a unique `User-Agent` marker (`e2e-obs-<ts>-<name>-<rand>`)
 *   on every request it makes. The helper queries request_log WHERE
 *   `user_agent = '<marker>'`, so test rows never collide with real traffic
 *   or with other tests running in parallel.
 *
 * Cleanup note:
 *   Rows survive forever (retention is manual). To prune accumulated test
 *   rows after many CI runs, execute:
 *
 *     npx wrangler d1 execute smart-management --remote \
 *       --command="DELETE FROM request_log WHERE user_agent LIKE 'e2e-obs-%';"
 */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  makeMarker,
  queryByMarker,
  waitForLogRow,
  waitForStableCount,
} from '../utils/observability-helpers';

/**
 * Ephemeral creds for the auth_ok test. Written by
 * `tests/scripts/seed-observability-user.ts` before the run and removed by
 * `cleanup-observability-user.ts` after. When missing (e.g. running the spec
 * directly without the orchestrator), the auth_ok test skips with a clear
 * message — the other 11 tests still run.
 */
interface ObsCreds {
  username: string;
  password: string;
  id: string;
  role: string;
  tenant_id: string;
}

const CREDS_PATH = join(process.cwd(), '.tmp', 'observability-creds.json');
const OBS_CREDS: ObsCreds | null = existsSync(CREDS_PATH)
  ? (JSON.parse(readFileSync(CREDS_PATH, 'utf8')) as ObsCreds)
  : null;

test.describe('Observability middleware — request_log', () => {
  // wrangler round-trips add latency (~1.5s each). Give each test 60s.
  test.describe.configure({ timeout: 60_000 });

  // ==========================================================
  // 1) Bypassed paths MUST NOT produce log rows
  // ==========================================================

  test('GET /login is bypassed (zero rows logged)', async ({ request }) => {
    const marker = makeMarker('bypass-login');
    const res = await request.get('/login', {
      headers: { 'User-Agent': marker },
    });
    expect(res.ok()).toBeTruthy();

    const count = await waitForStableCount({ marker });
    expect(count, 'login is in EXACT_BYPASS — must not be logged').toBe(0);
  });

  test('GET /api/health is bypassed', async ({ request }) => {
    const marker = makeMarker('bypass-health');
    const res = await request.get('/api/health', {
      headers: { 'User-Agent': marker },
    });
    expect(res.ok()).toBeTruthy();

    const count = await waitForStableCount({ marker });
    expect(count).toBe(0);
  });

  test('GET /favicon.ico is bypassed', async ({ request }) => {
    const marker = makeMarker('bypass-favicon');
    const res = await request.get('/favicon.ico', {
      headers: { 'User-Agent': marker },
    });
    // 200 (served) or 304 (cached) — both are "ok"
    expect([200, 304]).toContain(res.status());

    const count = await waitForStableCount({ marker });
    expect(count).toBe(0);
  });

  test('GET /manifest.json is bypassed', async ({ request }) => {
    const marker = makeMarker('bypass-manifest');
    await request.get('/manifest.json', {
      headers: { 'User-Agent': marker },
    });

    const count = await waitForStableCount({ marker });
    expect(count).toBe(0);
  });

  test('static asset (.js under /_next) is bypassed via matcher', async ({ request }) => {
    // We don't need this file to exist — just verify the middleware matcher
    // excludes /_next entirely (no 404 log, because middleware never runs).
    const marker = makeMarker('bypass-next-static');
    await request.get('/_next/static/does-not-exist.js', {
      headers: { 'User-Agent': marker },
      failOnStatusCode: false,
    });

    const count = await waitForStableCount({ marker });
    expect(count).toBe(0);
  });

  // ==========================================================
  // 2) Anonymous hits on protected routes → auth_redirect
  // ==========================================================

  test('anonymous GET /reports → auth_redirect with NULL user_id/tenant_id', async ({ request }) => {
    const marker = makeMarker('anon-reports');
    const res = await request.get('/reports', {
      headers: { 'User-Agent': marker },
      maxRedirects: 0,
    });
    expect([301, 302, 307, 308]).toContain(res.status());
    expect(res.headers()['location']).toContain('/login');

    const row = await waitForLogRow({ marker });
    expect(row, `No request_log row found for marker ${marker}`).not.toBeNull();

    expect(row!.outcome).toBe('auth_redirect');
    expect(row!.method).toBe('GET');
    expect(row!.url).toContain('/reports');
    expect(row!.user_id).toBeNull();
    expect(row!.tenant_id).toBeNull();
    // Middleware doesn't see the response status code — explicit NULL guard:
    expect(row!.status_code).toBeNull();
    // CF headers should always be populated in production
    expect(row!.cf_ray).toBeTruthy();
    expect(row!.cf_country).toBeTruthy();
    expect(row!.ip).toBeTruthy();
    // Duration is middleware-only, always a non-negative integer
    expect(typeof row!.duration_ms).toBe('number');
    expect(row!.duration_ms).toBeGreaterThanOrEqual(0);
    expect(row!.duration_ms).toBeLessThan(5_000);
  });

  test('anonymous GET /finance/transactions → auth_redirect', async ({ request }) => {
    const marker = makeMarker('anon-finance-tx');
    const res = await request.get('/finance/transactions', {
      headers: { 'User-Agent': marker },
      maxRedirects: 0,
    });
    expect([301, 302, 307, 308]).toContain(res.status());

    const row = await waitForLogRow({ marker });
    expect(row).not.toBeNull();
    expect(row!.outcome).toBe('auth_redirect');
    expect(row!.url).toContain('/finance/transactions');
  });

  // ==========================================================
  // 3) Authenticated requests → auth_ok with user_id + tenant_id
  // ==========================================================

  test('authenticated GET /reports → auth_ok with user_id/tenant_id', async ({ request }) => {
    test.skip(
      OBS_CREDS === null,
      'No ephemeral creds at .tmp/observability-creds.json — run via `npm run test:observability` (seeds + cleans up a temp user)',
    );
    const marker = makeMarker('auth-ok-reports');

    // Log in via the /api/auth/login endpoint (bypassed from middleware
    // logging) to get an auth-token cookie, then attach it + our UA marker
    // to the protected request.
    const loginRes = await request.post('/api/auth/login', {
      data: { username: OBS_CREDS!.username, password: OBS_CREDS!.password },
    });
    expect(loginRes.ok(), 'temp user login must succeed').toBeTruthy();
    const setCookie = loginRes.headers()['set-cookie'] ?? '';
    const tokenMatch = setCookie.match(/auth-token=([^;]+)/);
    expect(tokenMatch, 'auth-token cookie must be set by login').not.toBeNull();
    const authToken = tokenMatch![1];

    const res = await request.get('/reports', {
      headers: {
        'User-Agent': marker,
        Cookie: `auth-token=${authToken}`,
      },
      maxRedirects: 0,
    });
    // The middleware sees a valid token and records auth_ok — that is
    // what this test is about. The handler may then do anything: render
    // (200), return empty (204), or redirect internally (e.g. viewer →
    // /setup because the default tenant has is_setup_complete=0). We
    // accept any non-error status since the assertion below verifies the
    // log row explicitly.
    expect(
      res.status(),
      `Expected authenticated response <400; got ${res.status()}`,
    ).toBeLessThan(400);

    const row = await waitForLogRow({ marker });
    expect(row).not.toBeNull();
    expect(row!.outcome).toBe('auth_ok');
    expect(row!.user_id).toBe(OBS_CREDS!.id);
    expect(row!.tenant_id).toBe(OBS_CREDS!.tenant_id);
  });

  // ==========================================================
  // 4) Safety guarantees — truncation, no spam, bounded
  // ==========================================================

  test('very long URL is truncated to ≤ 2000 chars', async ({ request }) => {
    const marker = makeMarker('long-url');
    const padding = 'a'.repeat(2_500); // query string > 2000 chars
    await request.get(`/reports?x=${padding}`, {
      headers: { 'User-Agent': marker },
      maxRedirects: 0,
    });

    const row = await waitForLogRow({ marker });
    expect(row).not.toBeNull();
    expect(row!.url).toBeTruthy();
    expect(row!.url!.length).toBeLessThanOrEqual(2_000);
    // Sanity: the truncated URL still starts with our path so it's debuggable
    expect(row!.url).toContain('/reports');
  });

  test('5 sequential requests create exactly 5 rows (no dedup, no loss)', async ({ request }) => {
    const marker = makeMarker('multi-5');
    for (let i = 0; i < 5; i += 1) {
      await request.get(`/reports?seq=${i}`, {
        headers: { 'User-Agent': marker },
        maxRedirects: 0,
      });
    }
    // Wait for all 5 waitUntil promises to flush
    await waitForStableCount({ marker, stableForMs: 4_000 });
    const rows = queryByMarker(marker);
    expect(rows.length).toBe(5);
    // Each row should carry the same marker but distinct URL
    const uniqueUrls = new Set(rows.map((r) => r.url));
    expect(uniqueUrls.size).toBe(5);
    // All must be auth_redirect (same anonymous session)
    expect(rows.every((r) => r.outcome === 'auth_redirect')).toBe(true);
  });

  test('POST to a protected route is logged with method=POST', async ({ request }) => {
    const marker = makeMarker('post-method');
    // POST to a protected route (middleware runs before handler, so any
    // non-bypassed path works — we don't care about handler response)
    await request.post('/reports', {
      headers: { 'User-Agent': marker },
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    const row = await waitForLogRow({ marker });
    expect(row).not.toBeNull();
    expect(row!.method).toBe('POST');
    expect(row!.outcome).toBe('auth_redirect');
  });

  // ==========================================================
  // 5) request_log table is real-data-preserving
  //    (cleanup-test-data.ts must never touch it)
  // ==========================================================

  test('our test rows do NOT match any TEST_ prefix (cleanup-safe)', async ({ request }) => {
    const marker = makeMarker('cleanup-safe-check');
    await request.get('/reports', {
      headers: { 'User-Agent': marker },
      maxRedirects: 0,
    });

    const row = await waitForLogRow({ marker });
    expect(row).not.toBeNull();

    // The cleanup script targets only TEST_-prefixed user-visible fields.
    // request_log columns should never start with 'TEST_' so they're safe
    // from inadvertent deletion.
    const values: Array<[string, string | null]> = [
      ['url', row!.url],
      ['method', row!.method],
      ['user_agent', row!.user_agent],
      ['cf_ray', row!.cf_ray],
      ['cf_country', row!.cf_country],
      ['ip', row!.ip],
      ['outcome', row!.outcome],
    ];
    for (const [field, value] of values) {
      if (typeof value === 'string') {
        expect(
          value.startsWith('TEST_'),
          `${field}='${value}' accidentally matches TEST_ prefix`,
        ).toBe(false);
      }
    }
  });
});
