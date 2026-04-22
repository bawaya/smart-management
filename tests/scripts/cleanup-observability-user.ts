/**
 * Delete every observability-test artifact from the remote D1:
 *   1. request_log rows from test requests (UA prefix `e2e-obs-`)
 *   2. request_log rows where user_id belongs to an `e2e_obs_*` user
 *   3. The `e2e_obs_*` users themselves
 *
 * Uses pattern-based deletion (LIKE `e2e_obs_%`) so orphaned users from
 * crashed runs get swept here too — idempotent and safe to run anytime.
 *
 * Does NOT touch:
 *   - real users (admin, test_manager, etc.) — they don't match `e2e_obs_`
 *   - real request_log rows — they don't have the `e2e-obs-` UA prefix
 *   - any other table
 */

import 'dotenv/config';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const TMP_DIR = join(process.cwd(), '.tmp');
const CREDS_PATH = join(TMP_DIR, 'observability-creds.json');
const SQL_PATH = join(TMP_DIR, 'cleanup-observability-user.sql');
const PROJECT_ROOT = join(process.cwd(), '..');

const DB_NAME = 'smart-management';
const TENANT_ID = 'default';

function main(): void {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  // Order matters: delete children (request_log) before parents (users)
  // because request_log.user_id is a TEXT reference (no FK cascade set).
  // Using --command per statement (not --file) — see seed script for why.
  const stmts: Array<{ sql: string; desc: string }> = [
    {
      sql: `DELETE FROM request_log WHERE user_agent LIKE 'e2e-obs-%';`,
      desc: "request_log rows from test UA marker 'e2e-obs-%'",
    },
    {
      sql: `DELETE FROM request_log WHERE user_id IN (SELECT id FROM users WHERE tenant_id = '${TENANT_ID}' AND username LIKE 'e2e_obs_%');`,
      desc: 'request_log rows attributed to e2e_obs_* user_id',
    },
    {
      sql: `DELETE FROM users WHERE tenant_id = '${TENANT_ID}' AND username LIKE 'e2e_obs_%';`,
      desc: 'ephemeral e2e_obs_* users (including orphans)',
    },
  ];

  // Also persist combined SQL as artifact for debugging.
  writeFileSync(SQL_PATH, stmts.map((s) => `-- ${s.desc}\n${s.sql}`).join('\n\n'), 'utf8');
  console.log('▶ Cleaning up observability test data on remote D1');

  try {
    for (const [i, { sql, desc }] of stmts.entries()) {
      const cmd = `npx wrangler d1 execute ${DB_NAME} --remote --command="${sql.replace(/"/g, '\\"')}"`;
      execSync(cmd, {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
      });
      console.log(`  [${i + 1}/${stmts.length}] ✓ ${desc}`);
    }
    console.log('✓ Cleanup complete');
  } catch {
    console.error('\n✗ wrangler execute failed');
    console.error('  Manual SQL to run:');
    console.error("    DELETE FROM request_log WHERE user_agent LIKE 'e2e-obs-%';");
    console.error(
      "    DELETE FROM request_log WHERE user_id IN (SELECT id FROM users WHERE tenant_id='default' AND username LIKE 'e2e_obs_%');",
    );
    console.error(
      "    DELETE FROM users WHERE tenant_id='default' AND username LIKE 'e2e_obs_%';",
    );
    process.exit(1);
  }

  // Remove local creds file last so a failed wrangler run leaves the file
  // around for retry/inspection.
  if (existsSync(CREDS_PATH)) {
    unlinkSync(CREDS_PATH);
    console.log('✓ Local creds file removed');
  }
}

main();
