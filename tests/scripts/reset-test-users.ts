/**
 * Reset test users: DELETE via wrangler D1 SQL.
 */

import 'dotenv/config';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const PROJECT_ROOT = join(process.cwd(), '..');
const DB_NAME = 'smart-management';

async function main() {
  console.log('▶ Deleting test users (test_manager, test_accountant, test_operator, test_viewer)');
  const sql = `DELETE FROM users WHERE tenant_id = 'default' AND username IN ('test_manager','test_accountant','test_operator','test_viewer');`;

  try {
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --command="${sql}"`,
      { cwd: PROJECT_ROOT, stdio: 'inherit' }
    );
    console.log('\n✓ Test users deleted');
  } catch {
    console.error('✗ wrangler execute failed');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
