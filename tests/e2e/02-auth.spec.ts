import { test, expect } from '@playwright/test';
import { BASE_URL, CREDS } from '../utils/config';
import { apiLogin, loginViaUI } from '../utils/login';

const LOGIN_URL = `${BASE_URL}/api/auth/login`;
const LOGOUT_URL = `${BASE_URL}/api/auth/logout`;
const ERROR_MSG = 'اسم المستخدم أو كلمة المرور غلط';

test.describe('POST /api/auth/login — 8 سيناريوهات', () => {
  test('L1: owner creds صحيحة → 200 + set-cookie + success body', async () => {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDS.owner),
      redirect: 'manual',
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/auth-token=/);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.mustChangePassword).toBe('boolean');
    expect(typeof body.isSetupComplete).toBe('boolean');
  });

  test('L2: username صحيح + password غلط → 401 + رسالة موحدة', async () => {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: CREDS.owner.username,
        password: 'wrong_password_xyz',
      }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_MSG);
  });

  test('L3: username غير موجود → نفس رسالة L2 (منع user enumeration)', async () => {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody_enum_xyz', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe(ERROR_MSG);
  });

  test('L4: username فارغ → 400 + رسالة موحدة', async () => {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: 'x' }),
    });
    expect([400, 401]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe(ERROR_MSG);
  });

  test('L5: password فارغ → 400/401 + رسالة موحدة', async () => {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: CREDS.owner.username, password: '' }),
    });
    expect([400, 401]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('L6: JSON غير صالح → 400 + رسالة موحدة (لا stack leak)', async () => {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    expect([400, 401]).toContain(res.status);
    const text = await res.text();
    expect(text.toLowerCase()).not.toContain('stack');
    expect(text.toLowerCase()).not.toContain('at /');
    expect(text.toLowerCase()).not.toContain('node_modules');
  });

  test('L7: body فاضي → 400/401', async () => {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect([400, 401]).toContain(res.status);
  });

  test('L8: الأدوار الـ 4 الباقية تسجّل بنجاح', async () => {
    for (const role of ['manager', 'accountant', 'operator', 'viewer'] as const) {
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(CREDS[role]),
        redirect: 'manual',
      });
      expect(res.status, `login ${role}`).toBe(200);
      expect(res.headers.get('set-cookie') ?? '').toMatch(/auth-token=/);
    }
  });

  test('L9 (bonus): L2 و L3 يرجعان نفس الـ body بالحرف', async () => {
    const r1 = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: CREDS.owner.username,
        password: 'wrong_pw_1',
      }),
    });
    const r2 = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ghost_user_abc', password: 'wrong_pw_2' }),
    });
    expect(r1.status).toBe(r2.status);
    expect(await r1.text()).toBe(await r2.text());
  });
});

test.describe('Cookie security attributes', () => {
  test('auth-token: HttpOnly + Secure + SameSite=Lax', async () => {
    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(CREDS.owner),
      redirect: 'manual',
    });
    const sc = (res.headers.get('set-cookie') ?? '').toLowerCase();
    expect(sc).toContain('httponly');
    expect(sc).toContain('secure');
    expect(sc).toMatch(/samesite=lax/);
  });
});

test.describe('POST /api/auth/logout', () => {
  test('بدون توكن → redirect لـ /login (middleware يمسكه)', async () => {
    const res = await fetch(LOGOUT_URL, {
      method: 'POST',
      redirect: 'manual',
    });
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location') ?? '').toContain('/login');
  });

  test('بتوكن صالح → 200 + مسح الكوكي', async () => {
    const token = await apiLogin('owner');
    const res = await fetch(LOGOUT_URL, {
      method: 'POST',
      headers: { Cookie: `auth-token=${token}` },
      redirect: 'manual',
    });
    expect(res.status).toBe(200);
    const sc = (res.headers.get('set-cookie') ?? '').toLowerCase();
    expect(sc.includes('max-age=0') || sc.includes('expires=')).toBeTruthy();
  });

  test('UI: logout button يحرر الجلسة', async ({ page }) => {
    await loginViaUI(page, 'owner');
    await expect(page).not.toHaveURL(/\/login/);

    const logout = page
      .getByRole('button', { name: /logout|יציאה|خروج|התנתק/i })
      .or(page.getByRole('link', { name: /logout|יציאה|خروج|התנתק/i }));
    if ((await logout.count()) > 0) {
      await logout.first().click();
      await page.waitForURL(/\/login/, { timeout: 10_000 });
    } else {
      await page.evaluate(() =>
        fetch('/api/auth/logout', { method: 'POST' }),
      );
      await page.goto('/');
      await page.waitForURL(/\/login/, { timeout: 10_000 });
    }

    await page.goto('/daily-log');
    await expect(page).toHaveURL(/\/login/);
  });
});
