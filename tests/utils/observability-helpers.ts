/**
 * Helpers for querying the `request_log` table populated by
 * `src/middleware.ts`. All queries are read-only; no INSERT/UPDATE/DELETE.
 *
 * Runs `wrangler d1 execute --remote` under the hood, same as the existing
 * cleanup script (tests/scripts/cleanup-test-data.ts). The caller MUST invoke
 * tests from an environment where wrangler is authenticated and runnable
 * (WSL on Windows, Linux directly in CI).
 */

import { execSync } from 'node:child_process';
import { join } from 'node:path';

const PROJECT_ROOT = join(process.cwd(), '..');
const DB_NAME = 'smart-management';

export interface RequestLogRow {
  id: string;
  timestamp: string;
  url: string | null;
  method: string | null;
  status_code: number | null;
  outcome: string | null;
  duration_ms: number | null;
  user_id: string | null;
  tenant_id: string | null;
  exception_name: string | null;
  exception_message: string | null;
  exception_stack: string | null;
  log_count: number | null;
  logs: string | null;
  user_agent: string | null;
  cf_ray: string | null;
  cf_country: string | null;
  ip: string | null;
}

/**
 * Safely-formatted marker used both as the user-agent header on outgoing test
 * requests AND as the WHERE-clause value when querying the log. Contains only
 * `[a-z0-9-]` — no quoting concerns.
 */
export function makeMarker(name: string): string {
  const safe = name.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e-obs-${Date.now()}-${safe}-${rand}`;
}

/**
 * Throws if the input contains anything that would be dangerous inside a
 * single-quoted SQL literal. Markers produced by `makeMarker()` always pass.
 */
function assertSafeLiteral(s: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) {
    throw new Error(
      `Unsafe marker for SQL literal: ${JSON.stringify(s)}. ` +
        `Only [A-Za-z0-9_-] allowed — avoids quote-injection concerns.`,
    );
  }
}

/**
 * One round-trip to wrangler. Returns parsed rows (empty array on no match).
 * Any wrangler error propagates — callers typically let Playwright mark the
 * assertion as failed so the engineer investigates.
 */
function wranglerSelect(sql: string): RequestLogRow[] {
  // SQL escape for double-quoting the shell argument. Our SQL uses single
  // quotes for literals, so this is safe for both bash and (on WSL) Linux.
  const shellSafe = sql.replace(/"/g, '\\"');
  const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --json --command="${shellSafe}"`;
  const out = execSync(cmd, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = JSON.parse(out) as Array<{ results?: RequestLogRow[] }>;
  return parsed[0]?.results ?? [];
}

/**
 * SELECT rows from request_log whose user_agent equals the given marker.
 * Ordered newest-first, capped at 50 rows (more than enough for any test).
 */
export function queryByMarker(marker: string): RequestLogRow[] {
  assertSafeLiteral(marker);
  return wranglerSelect(
    `SELECT * FROM request_log WHERE user_agent = '${marker}' ORDER BY timestamp DESC LIMIT 50`,
  );
}

/** Count-only form for performance tests. */
export function countByMarker(marker: string): number {
  assertSafeLiteral(marker);
  const rows = wranglerSelect(
    `SELECT COUNT(*) AS n FROM request_log WHERE user_agent = '${marker}'`,
  ) as unknown as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

/**
 * Poll until at least one row appears for `marker`, or timeout.
 * `event.waitUntil` flushes D1 writes after the response, so there's a small
 * propagation gap. Default 8s is plenty for the 100-500ms typical delay.
 */
export async function waitForLogRow(opts: {
  marker: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<RequestLogRow | null> {
  const deadline = Date.now() + (opts.timeoutMs ?? 8_000);
  const interval = opts.pollIntervalMs ?? 800;
  while (Date.now() < deadline) {
    const rows = queryByMarker(opts.marker);
    if (rows.length > 0) return rows[0];
    await new Promise((r) => setTimeout(r, interval));
  }
  return null;
}

/**
 * Wait for rows to settle, then confirm the final count matches expected.
 * Used for "bypassed paths produce NO log row" assertions — we wait long
 * enough that a delayed write would have landed.
 */
export async function waitForStableCount(opts: {
  marker: string;
  stableForMs?: number;
}): Promise<number> {
  await new Promise((r) => setTimeout(r, opts.stableForMs ?? 3_500));
  return countByMarker(opts.marker);
}
