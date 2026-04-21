import { BASE_URL, CREDS, Role, assertCreds } from './config.js';

/** يسجّل دخول عبر API ويرجع الـ token من الـ cookie */
export async function apiLogin(role: Role): Promise<string> {
  assertCreds(role);
  const { username, password } = CREDS[role];
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    redirect: 'manual',
  });

  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/auth-token=([^;]+)/);
  if (!match) throw new Error(`Login failed for ${role}. Status: ${res.status}. Body: ${await res.text()}`);
  return match[1];
}

/** للـ Playwright: يسجّل دخول UI مع الكوكيز */
export async function loginViaUI(context: import('@playwright/test').BrowserContext, role: Role) {
  assertCreds(role);
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/שם משתמש|username/i).fill(CREDS[role].username);
  await page.getByLabel(/סיסמה|password/i).fill(CREDS[role].password);
  await page.getByRole('button', { name: /כניסה|login/i }).click();
  await page.waitForURL(/\/dashboard|\/change-password/, { timeout: 10_000 });
  await page.close();
}
