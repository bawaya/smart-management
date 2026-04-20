import Database from 'better-sqlite3';
import type {
  BatchStatement,
  RunResult,
  SmartDb,
  Statement,
} from './types';

const DEV_DB_PATH = 'data/dev.db';

let devDbInstance: Database.Database | null = null;

export function openSqlite(): Database.Database {
  if (!devDbInstance) {
    devDbInstance = new Database(DEV_DB_PATH);
    devDbInstance.pragma('journal_mode = WAL');
    devDbInstance.pragma('foreign_keys = ON');
  }
  return devDbInstance;
}

class SqliteStatement implements Statement {
  private params: unknown[] = [];

  constructor(private readonly stmt: Database.Statement) {}

  bind(...values: unknown[]): Statement {
    this.params = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<T[]> {
    return this.stmt.all(...this.params) as T[];
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.stmt.get(...this.params);
    return (row as T | undefined) ?? null;
  }

  async run(): Promise<RunResult> {
    const info = this.stmt.run(...this.params);
    return {
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid ?? null,
    };
  }
}

export class SqliteSmartDb implements SmartDb {
  constructor(private readonly db: Database.Database) {}

  prepare(sql: string): Statement {
    return new SqliteStatement(this.db.prepare(sql));
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async run(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<RunResult> {
    const info = this.db.prepare(sql).run(...params);
    return {
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid ?? null,
    };
  }

  async batch(statements: readonly BatchStatement[]): Promise<void> {
    const db = this.db;
    const txn = db.transaction((stmts: readonly BatchStatement[]) => {
      for (const s of stmts) {
        db.prepare(s.sql).run(...(s.params ?? []));
      }
    });
    txn(statements);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }
}

export function createSqliteSmartDb(): SmartDb {
  return new SqliteSmartDb(openSqlite());
}
