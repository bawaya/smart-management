import type {
  BatchStatement,
  RunResult,
  SmartDb,
  Statement,
} from './types';

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

class D1Statement implements Statement {
  constructor(private stmt: D1PreparedStatement) {}

  bind(...values: unknown[]): Statement {
    this.stmt = this.stmt.bind(...values);
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<T[]> {
    const result = await this.stmt.all<T>();
    return result.results;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (await this.stmt.first<T>()) ?? null;
  }

  async run(): Promise<RunResult> {
    const result = await this.stmt.run();
    return {
      changes: result.meta?.changes ?? 0,
      lastInsertRowid: result.meta?.last_row_id ?? null,
    };
  }
}

export class D1SmartDb implements SmartDb {
  constructor(private readonly d1: D1Database) {}

  prepare(sql: string): Statement {
    return new D1Statement(this.d1.prepare(sql));
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    const result = await this.d1.prepare(sql).bind(...params).all<T>();
    return result.results;
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
// from the incoming Cloudflare request context.
//
// @cloudflare/next-on-pages is ESM-only. getRequestContext uses
// AsyncLocalStorage to find the current request's env without needing to be
// threaded through call sites.
import { getRequestContext } from '@cloudflare/next-on-pages';

export function createD1SmartDb(): SmartDb {
  const ctx = getRequestContext() as unknown as { env: { DB: D1Database } };
  return new D1SmartDb(ctx.env.DB);
}
