import type { Browser, BrowserContext, Page, APIRequestContext } from '@playwright/test';
import { BASE_URL, CREDS, Role, assertCreds } from './config.js';

/**
 * HTTP-level login — بدون UI. يرجع auth-token من set-cookie.
 */
export async function apiLogin(role: Role, _req?: APIRequestContext): Promise<string> {
  assertCreds(role);
  const { username, password } = CREDS[role];
  const body = JSON.stringify({ username, password });

  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    redirect: 'manual',
  });

  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/auth-token=([^;]+)/);
  if (!match) {
    const text = await res.text();
    throw new Error(`apiLogin(${role}) failed: ${res.status} — ${text.slice(0, 200)}`);
  }
  return match[1];
}

/**
 * UI login عبر المتصفح. يدير الـ redirect ويرجع الـ Page بعد ما توصل dashboard.
 *
 * المدخلات تستخدم placeholder فقط (ما في <label>)، فنحدد input name=".." للموثوقية.
 */
export async function loginViaUI(page: Page, role: Role): Promise<Page> {
  assertCreds(role);
  const { username, password } = CREDS[role];

  await page.goto(`${BASE_URL}/login`);
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /כניסה|login|دخول/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
  return page;
}

/**
 * Browser context مسجّل فيه دور معين — للاستخدام بالتوازي.
 */
export async function loginAsContext(
  browser: Browser,
  role: Role,
): Promise<BrowserContext> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginViaUI(page, role);
  await page.close();
  return ctx;
}

/**
 * يحقن cookie auth-token في context بدون فتح UI (أسرع من loginViaUI).
 */
export async function injectAuthCookie(
  ctx: BrowserContext,
  token: string,
): Promise<void> {
  const url = new URL(BASE_URL);
  await ctx.addCookies([
    {
      name: 'auth-token',
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);
}
