import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'edge';

// Diagnostics endpoint — no auth required. Tests the DB adapter and also
// (on production) hits the raw D1 binding directly so we can compare what
// the SmartDb layer returns against what Cloudflare actually gives us.
//
// GET /api/health — always returns 200 with a JSON report; never throws
// (any failure is captured in the response body so it shows up in the
// browser without needing a console dive).
export async function GET(): Promise<NextResponse> {
  const report: Record<string, unknown> = {
    env: process.env.NODE_ENV,
    dbType: process.env.NODE_ENV === 'production' ? 'd1' : 'sqlite',
    timestamp: new Date().toISOString(),
    tests: {},
  };
  const tests = report.tests as Record<string, unknown>;

  // Test 1: query through SmartDb adapter
  try {
    const db = getDb();
    const rows = await db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM settings WHERE tenant_id = ?',
      ['default'],
    );
    tests.adapterQuery = {
      ok: true,
      isArray: Array.isArray(rows),
      length: rows.length,
      firstRow: rows[0] ?? null,
    };
  } catch (err) {
    tests.adapterQuery = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 2: raw D1 (production only) — bypasses the adapter
  if (process.env.NODE_ENV === 'production') {
    try {
      const { getRequestContext } = await import(
        '@cloudflare/next-on-pages'
      );
      const ctx = getRequestContext() as unknown as {
        env: { DB: { prepare(sql: string): { bind(...v: unknown[]): { all(): Promise<unknown> } } } };
      };
      const raw = await ctx.env.DB.prepare(
        'SELECT COUNT(*) as count FROM settings WHERE tenant_id = ?',
      )
        .bind('default')
        .all();
      const rawAny = raw as Record<string, unknown> | unknown[] | null;
      tests.rawD1 = {
        ok: true,
        typeOf: typeof raw,
        isArray: Array.isArray(rawAny),
        keys:
          rawAny && !Array.isArray(rawAny) && typeof rawAny === 'object'
            ? Object.keys(rawAny as Record<string, unknown>)
            : null,
        hasResults:
          rawAny != null &&
          typeof rawAny === 'object' &&
          !Array.isArray(rawAny) &&
          'results' in (rawAny as Record<string, unknown>),
        raw: rawAny,
      };
    } catch (err) {
      tests.rawD1 = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json(report);
}
