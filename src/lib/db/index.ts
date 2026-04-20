import type { SmartDb } from './types';

export type { BatchStatement, RunResult, SmartDb } from './types';

// Returns the right adapter for the current runtime:
// - production (Cloudflare Pages / Edge) → D1 via @cloudflare/next-on-pages
// - development (local `next dev`) → better-sqlite3 over a local file
//
// BOTH adapters are loaded via require() inside the branches so webpack can
// dead-code eliminate the unused one based on NODE_ENV (Next.js replaces
// process.env.NODE_ENV with a literal at build time). This keeps
// better-sqlite3 (a native module) out of the production edge bundle, and
// keeps @cloudflare/next-on-pages out of the dev bundle.
export function getDb(): SmartDb {
  if (process.env.NODE_ENV === 'production') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { createD1SmartDb } = require('./d1-adapter');
    return createD1SmartDb();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { createSqliteSmartDb } = require('./sqlite-adapter');
  return createSqliteSmartDb();
}

export function getTenantId(): string {
  return 'default';
}
