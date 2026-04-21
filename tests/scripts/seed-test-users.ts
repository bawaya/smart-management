/**
 * Seed 4 test users directly into D1 via wrangler.
 * Uses hardcoded tenant_id='default', bcrypt 12 rounds (matches app seed).
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execSync } from 'node:child_process';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL ?? 'https://smart-management.pages.dev';
const ENV_PATH = join(process.cwd(), '.env');
const TMP_DIR = join(process.cwd(), '.tmp');
const SQL_PATH = join(TMP_DIR, 'seed-test-users.sql');
const PROJECT_ROOT = join(process.cwd(), '..');

const DB_NAME = 'smart-management';
const TENANT_ID = 'default';
const BCRYPT_ROUNDS = 12;

type Role = 'manager' | 'accountant' | 'operator' | 'viewer';

const NEW_USERS: Array<{
  role: Role;
  username: string;
  full_name: string;
  email: string;
  phone: string;
}> = [
  { role: 'manager',    username: 'test_manager',    full_name: 'Test Manager',    email: 'test_manager@test.local',    phone: '+972500000002' },
  { role: 'accountant', username: 'test_accountant', full_name: 'Test Accountant', email: 'test_accountant@test.local', phone: '+972500000003' },
  { role: 'operator',   username: 'test_operator',   full_name: 'Test Operator',   email: 'test_operator@test.local',   phone: '+972500000004' },
  { role: 'viewer',     username: 'test_viewer',     full_name: 'Test Viewer',     email: 'test_viewer@test.local',     phone: '+972500000005' },
];

function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const special = '!@#$%&*';
  let pw = '';
  const bytes = randomBytes(18);
  for (let i = 0; i < 18; i++) pw += chars[bytes[i] % chars.length];
  pw += special[randomBytes(1)[0] % special.length];
  pw += (randomBytes(1)[0] % 10).toString();
  return pw;
}

function genUserId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

async function verifyOwnerLogin(): Promise<void> {
  const username = process.env.OWNER_USERNAME;
  const password = process.env.OWNER_PASSWORD;
  if (!username || !password) {
    console.error('✗ OWNER_USERNAME/OWNER_PASSWORD مفقودين في tests/.env');
    process.exit(1);
  }

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    redirect: 'manual',
  });

  const setCookie = res.headers.get('set-cookie') ?? '';
  if (!/auth-token=/.test(setCookie)) {
    const body = await res.text();
    throw new Error(`Owner login failed: ${res.status} — ${body.slice(0, 200)}`);
  }
  console.log(`✓ Owner login verified (${username})`);
}

function sqlEscape(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function buildSql(users: Array<typeof NEW_USERS[0] & { id: string; password_hash: string }>): string {
  const usernames = users.map(u => sqlEscape(u.username)).join(', ');
  const nowIso = new Date().toISOString();

  let sql = `-- Auto-generated. Do not commit.\n\n`;
  sql += `DELETE FROM users WHERE tenant_id = ${sqlEscape(TENANT_ID)} AND username IN (${usernames});\n\n`;

  for (const u of users) {
    sql += `INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, phone, role, is_active, must_change_password, created_at, updated_at) VALUES (\n`;
    sql += `  ${sqlEscape(u.id)},\n`;
    sql += `  ${sqlEscape(TENANT_ID)},\n`;
    sql += `  ${sqlEscape(u.username)},\n`;
    sql += `  ${sqlEscape(u.email)},\n`;
    sql += `  ${sqlEscape(u.password_hash)},\n`;
    sql += `  ${sqlEscape(u.full_name)},\n`;
    sql += `  ${sqlEscape(u.phone)},\n`;
    sql += `  ${sqlEscape(u.role)},\n`;
    sql += `  1,\n`;
    sql += `  0,\n`;
    sql += `  ${sqlEscape(nowIso)},\n`;
    sql += `  ${sqlEscape(nowIso)}\n`;
    sql += `);\n\n`;
  }

  return sql;
}

function updateEnv(pairs: Record<string, string>) {
  let content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
  for (const [key, value] of Object.entries(pairs)) {
    // Double-quote every value so special chars (#, =, spaces) don't break dotenv.
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const line = `${key}="${escaped}"`;
    const re = new RegExp(`^${key}=.*$`, 'm');
    if (re.test(content)) content = content.replace(re, line);
    else content += (content.endsWith('\n') || content === '' ? '' : '\n') + line + '\n';
  }
  writeFileSync(ENV_PATH, content, 'utf8');
}

async function main() {
  console.log('▶ Seeding test users via wrangler D1');
  console.log(`▶ Base: ${BASE}`);
  console.log(`▶ Tenant: ${TENANT_ID}`);
  console.log(`▶ bcrypt rounds: ${BCRYPT_ROUNDS}\n`);

  await verifyOwnerLogin();

  console.log('▶ Generating passwords + bcrypt hashes...');
  const prepared: Array<typeof NEW_USERS[0] & { id: string; password_hash: string; password: string }> = [];
  const envUpdates: Record<string, string> = {};

  for (const u of NEW_USERS) {
    const password = genPassword();
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const id = genUserId(u.username);
    prepared.push({ ...u, id, password, password_hash: hash });
    const up = u.role.toUpperCase();
    envUpdates[`${up}_USERNAME`] = u.username;
    envUpdates[`${up}_PASSWORD`] = password;
  }
  console.log(`✓ 4 hashes + IDs ready`);

  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
  const sql = buildSql(prepared);
  writeFileSync(SQL_PATH, sql, 'utf8');
  console.log(`✓ SQL written to .tmp/seed-test-users.sql`);

  console.log(`\n▶ Running: wrangler d1 execute ${DB_NAME} --remote --file=.tmp/seed-test-users.sql\n`);

  try {
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --file="${SQL_PATH}"`,
      { cwd: PROJECT_ROOT, stdio: 'inherit' }
    );
  } catch {
    console.error('\n✗ wrangler execute failed');
    process.exit(1);
  }

  updateEnv(envUpdates);
  console.log(`\n✓ Credentials saved to tests/.env`);

  console.log('\n▶ Verifying all 5 logins...\n');
  try {
    execSync('npx tsx scripts/verify-logins.ts', { stdio: 'inherit' });
    console.log('\n✓ Phase 1B complete');
  } catch {
    console.error('\n⚠ verify-logins reported failures');
    process.exit(1);
  }
}

main().catch(e => { console.error('✗ Fatal:', e); process.exit(1); });
