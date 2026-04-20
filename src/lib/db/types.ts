export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint | null;
}

export interface BatchStatement {
  sql: string;
  params?: readonly unknown[];
}

export interface SmartDb {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<T | null>;
  run(sql: string, params?: readonly unknown[]): Promise<RunResult>;
  batch(statements: readonly BatchStatement[]): Promise<void>;
  exec(sql: string): Promise<void>;
}
