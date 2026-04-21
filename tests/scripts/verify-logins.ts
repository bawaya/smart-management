/**
 * يتحقق إن الـ 5 أدوار كلهم يقدروا يسجلوا دخول بنجاح.
 */

import 'dotenv/config';

const BASE = process.env.BASE_URL ?? 'https://smart-management.pages.dev';
const ROLES = ['OWNER', 'MANAGER', 'ACCOUNTANT', 'OPERATOR', 'VIEWER'] as const;

async function tryLogin(role: string, username: string, password: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    redirect: 'manual',
  });

  const ok = res.status === 200 || res.status === 302 || res.status === 303;
  const setCookie = res.headers.get('set-cookie') ?? '';
  const hasToken = /auth-token=[^;]+/.test(setCookie);

  if (!ok || !hasToken) {
    const body = await res.text().catch(() => '');
    console.log(`  ✗ ${role} (${username}) — ${res.status} ${body.slice(0, 100)}`);
    return false;
  }

  console.log(`  ✓ ${role} (${username})`);
  return true;
}

async function main() {
  console.log('▶ Verifying all 5 role logins...\n');

  let pass = 0, fail = 0;
  for (const role of ROLES) {
    const username = process.env[`${role}_USERNAME`] ?? '';
    const password = process.env[`${role}_PASSWORD`] ?? '';

    if (!username || !password) {
      console.log(`  ⚠  ${role} — credentials missing in .env`);
      fail++;
      continue;
    }

    const ok = await tryLogin(role, username, password);
    ok ? pass++ : fail++;
  }

  console.log(`\n${pass}/${ROLES.length} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error('✗ Fatal:', e); process.exit(1); });
