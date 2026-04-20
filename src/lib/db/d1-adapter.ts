import { getRequestContext } from '@cloudflare/next-on-pages';
import type { BatchStatement, RunResult, SmartDb } from './types';

// Minimal D1 types — avoids adding @cloudflare/workers-types as a dependency.
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

export class D1SmartDb implements SmartDb {
  constructor(private readonly d1: D1Database) {}

  async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.d1.prepare(sql).bind(...params).all<T>();
    return result.results;
  }

  async queryOne<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T | null> {
    const row = await this.d1.prepare(sql).bind(...params).first<T>();
    return row ?? null;
  }

  async run(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<RunResult> {
    const result = await this.d1.prepare(sql).bind(...params).run();
    return {
      changes: result.meta?.changes ?? 0,
      lastInsertRowid: result.meta?.last_row_id ?? null,
    };
  }

  async batch(statements: readonly BatchStatement[]): Promise<void> {
    const stmts = statements.map((s) =>
      this.d1.prepare(s.sql).bind(...(s.params ?? [])),
    );
    await this.d1.batch(stmts);
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
