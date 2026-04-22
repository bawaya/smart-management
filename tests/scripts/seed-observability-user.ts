/**
 * Create a single ephemeral D1 user for the observability test spec.
 *
 * Writes the random credentials to `.tmp/observability-creds.json` so the
 * spec can pick them up. The cleanup script (cleanup-observability-user.ts)
 * reverses this — use `run-observability.ts` for the seed→test→cleanup cycle.
 *
 * Design choices:
 *  - Username prefix `e2e_obs_` + 8-char hex — unique per run, safe to
 *    pattern-delete for orphan recovery after crashes.
 *  - Role `viewer` — minimum privilege; the spec only performs GET on
 *    protected routes, no writes.
 *  - tenant_id `default` — same as the real app's single tenant.
 *  - bcrypt 12 rounds — matches the app's seed + production policy.
 */

import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'https://smart-management.pages.dev';
const TMP_DIR = join(process.cwd(), '.tmp');
const CREDS_PATH = join(TMP_DIR, 'observability-creds.json');
const SQL_PATH = join(TMP_DIR, 'seed-observability-user.sql');
const PROJECT_ROOT = join(process.cwd(), '..');

const DB_NAME = 'smart-management';
const TENANT_ID = 'default';
const BCRYPT_ROUNDS = 12;

function sqlEscape(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function genPassword(): string {
  // 24 chars from URL-safe alphabet — plenty of entropy, no quoting concerns.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(24);
  let pw = '';
  for (let i = 0; i < 24; i += 1) pw += chars[bytes[i] % chars.length];
  return pw;
}

async function main(): Promise<void> {
  const suffix = randomBytes(4).toString('hex');
  const username = `e2e_obs_${suffix}`;
  const id = `e2e_obs_user_${suffix}`;
  const password = genPassword();
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const now = new Date().toISOString();

  console.log('▶ Seeding ephemeral observability test user');
  console.log(`  username: ${username}`);
  console.log(`  id:       ${id}`);
  console.log(`  role:     viewer`);
  console.log(`  tenant:   ${TENANT_ID}`);

  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

  // Single-line INSERT — passed inline via --command so wrangler treats it
  // as a one-shot query (no non-interactive confirmation prompt issues).
  const sql = `INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, phone, role, is_active, must_change_password, created_at, updated_at) VALUES (${sqlEscape(id)}, ${sqlEscape(TENANT_ID)}, ${sqlEscape(username)}, ${sqlEscape(`${username}@test.local`)}, ${sqlEscape(hash)}, ${sqlEscape('Observability Test User')}, ${sqlEscape('+972500000099')}, 'viewer', 1, 0, ${sqlEscape(now)}, ${sqlEscape(now)});`;
  writeFileSync(SQL_PATH, sql, 'utf8');
  console.log(`▶ Executing INSERT on remote D1...`);
  try {
    // Use --command (not --file) because --file triggers an interactive
    // "destructive operation" prompt that silently no-ops in child_process.
    // IMPORTANT: escape $ as well — bcrypt hashes contain `$2b$12$...` and
    // bash would interpret `$2b` as a variable (expands to empty string),
    // truncating the hash to 41 chars and breaking authentication.
    const shellSafeSql = sql.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --command="${shellSafeSql}"`,
      { cwd: PROJECT_ROOT, stdio: 'inherit' },
    );
  } catch {
    console.error('\n✗ wrangler execute failed');
    process.exit(1);
  }

  // Verify the user can actually log in BEFORE writing the creds file —
  // if login fails the spec would fail in a confusing way later.
  console.log(`▶ Verifying login...`);
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    redirect: 'manual',
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  if (!/auth-token=/.test(setCookie)) {
    const body = await res.text().catch(() => '');
    console.error(
      `✗ Login verification failed: HTTP ${res.status} — ${body.slice(0, 200)}`,
    );
    console.error('  The user was INSERTed but cannot authenticate.');
    console.error('  Run cleanup-observability-user.ts to remove it.');
    process.exit(1);
  }
  console.log(`✓ Login verified`);

  // Write creds so the spec can pick them up
  const creds = { username, password, id, role: 'viewer', tenant_id: TENANT_ID };
  writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2), 'utf8');
  console.log(`✓ Creds written to .tmp/observability-creds.json`);
  console.log('\n✓ Seed complete — ready to run observability tests');
}

main().catch((e) => {
  console.error('✗ Fatal:', e);
  process.exit(1);
});
