export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint | null;
}

export interface BatchStatement {
  sql: string;
  params?: readonly unknown[];
}

// Legacy prepared-statement pattern — retained for existing call sites that
// use `db.prepare(sql).bind(...params).first()/all()/run()`. New code should
// prefer the top-level query/run/batch methods on SmartDb directly.
export interface Statement {
  bind(...values: unknown[]): Statement;
  all<T = Record<string, unknown>>(): Promise<T[]>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<RunResult>;
}

export interface SmartDb {
  // Unified API — preferred going forward.
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
  run(sql: string, params?: readonly unknown[]): Promise<RunResult>;
  batch(statements: readonly BatchStatement[]): Promise<void>;
  exec(sql: string): Promise<void>;

  // Legacy prepare API — kept so existing 48 call sites continue to compile
  // until they are migrated in subsequent commits.
  prepare(sql: string): Statement;
}
