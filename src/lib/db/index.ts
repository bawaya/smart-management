import { createSqliteSmartDb } from './sqlite-adapter';
import type { SmartDb } from './types';

export type {
  BatchStatement,
  RunResult,
  SmartDb,
  Statement,
} from './types';

// Returns the right adapter for the current runtime:
// - production (Cloudflare Pages / Edge) → D1 via @cloudflare/next-on-pages
// - development (local `next dev`) → better-sqlite3 over a local file
//
// The D1 branch uses require() so the CF package isn't resolved in dev.
export function getDb(): SmartDb {
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { createD1SmartDb } = require('./d1-adapter');
    return createD1SmartDb();
  }
  return createSqliteSmartDb();
}

export function getTenantId(): string {
  return 'default';
}
