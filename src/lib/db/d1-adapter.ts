import { getRequestContext } from '@cloudflare/next-on-pages';
import type { BatchStatement, RunResult, SmartDb } from './types';

// Minimal D1 types — avoids adding @cloudflare/workers-types as a dependency.
// Documented D1 return shapes:
//   .all()   → { results: T[], success: boolean, meta: object }
//   .first() → T | null (row directly)
//   .run()   → { success: boolean, meta: { changes: number, last_row_id: number, ... } }
//   .batch() → D1Result<T>[] (array of all()-shaped results)
export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta?: { changes?: number; last_row_id?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{
    success: boolean;
    meta?: { changes?: number; last_row_id?: number };
  }>;
}

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch<T = unknown>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<T>[]>;
  exec(sql: string): Promise<unknown>;
}

// D1 throws when .bind() is called with zero arguments. Skip the bind call
// entirely when there are no parameters.
function prepare(
  d1: D1Database,
  sql: string,
  params: readonly unknown[],
): D1PreparedStatement {
  const stmt = d1.prepare(sql);
  return params.length > 0 ? stmt.bind(...params) : stmt;
}

// D1's .all() documents its return as { results, success, meta }. Some
// wrappers/mocks have returned bare arrays, and occasional edge cases have
// surfaced undefined.results. Accept all three shapes defensively so one
// unexpected response doesn't surface as "d.map is not a function".
function toArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const wrapped = raw as { results?: unknown } | null | undefined;
  return Array.isArray(wrapped?.results) ? (wrapped!.results as T[]) : [];
}

// TEMPORARY DEBUG LOGGING — remove once D1 shape issue is identified.
// Truncates SQL and stringifies shape info; safe against circular refs.
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function logShape(tag: string, sql: string, raw: unknown): void {
  const sqlShort = sql.replace(/\s+/g, ' ').slice(0, 80);
  const isArr = Array.isArray(raw);
  const keys =
    !isArr && raw && typeof raw === 'object'
      ? Object.keys(raw as Record<string, unknown>).slice(0, 10)
      : null;
  console.log(
    `[d1-debug] ${tag} sql="${sqlShort}" typeof=${typeof raw} isArray=${isArr} keys=${safeStringify(keys)} raw=${safeStringify(raw).slice(0, 300)}`,
  );
}

export class D1SmartDb implements SmartDb {
  constructor(private readonly d1: D1Database) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const raw = (await prepare(this.d1, sql, params).all<T>()) as unknown;
    logShape('query', sql, raw);
    return toArray<T>(raw);
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const row = await prepare(this.d1, sql, params).first<T>();
    logShape('queryOne', sql, row);
    return row ?? null;
  }

  async run(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<RunResult> {
    const result = await prepare(this.d1, sql, params).run();
    logShape('run', sql, result);
    return {
      changes: result?.meta?.changes ?? 0,
      lastInsertRowid: result?.meta?.last_row_id ?? null,
    };
  }

  async batch(statements: readonly BatchStatement[]): Promise<void> {
    if (statements.length === 0) return;
    const stmts = statements.map((s) =>
      prepare(this.d1, s.sql, s.params ?? []),
    );
    const result = await this.d1.batch(stmts);
    logShape('batch', `(${statements.length} statements)`, result);
  }

  async exec(sql: string): Promise<void> {
    await this.d1.exec(sql);
  }
}

// Factory used only on the production (Edge) path. Resolves the D1 binding
// from the incoming Cloudflare request context. getRequestContext uses
// AsyncLocalStorage to find the current request's env without needing to be
// threaded through call sites.
export function createD1SmartDb(): SmartDb {
  const ctx = getRequestContext() as unknown as { env: { DB: D1Database } };
  return new D1SmartDb(ctx.env.DB);
}
