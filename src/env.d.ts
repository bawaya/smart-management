// Type declarations for the Cloudflare Pages runtime environment.
// These are read by getRequestContext() inside src/lib/db/d1-adapter.ts on
// the production path, and by any other code that touches env bindings.

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    JWT_SECRET?: string;
    MAINTENANCE_MODE?: string;
  }

  // Minimal D1Database surface — mirrors what src/lib/db/d1-adapter.ts uses.
  // If you later install @cloudflare/workers-types, remove this and import
  // the official types instead.
  interface D1Database {
    prepare(sql: string): D1PreparedStatement;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<
      Array<{
        results: T[];
        success: boolean;
        meta?: { changes?: number; last_row_id?: number };
      }>
    >;
    exec(sql: string): Promise<unknown>;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    all<T = unknown>(): Promise<{
      results: T[];
      success: boolean;
      meta?: { changes?: number; last_row_id?: number };
    }>;
    first<T = unknown>(): Promise<T | null>;
    run(): Promise<{
      success: boolean;
      meta?: { changes?: number; last_row_id?: number };
    }>;
  }
}

export {};
