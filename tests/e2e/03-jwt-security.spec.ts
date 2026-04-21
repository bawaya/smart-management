import { test, expect } from '@playwright/test';
import { BASE_URL } from '../utils/config';
import { apiLogin } from '../utils/login';

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}
function b64urlEncode(obj: object): string {
  return Buffer.from(JSON.stringify(obj), 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

test.describe('JWT structure', () => {
  test('3 أجزاء + payload صالح', async () => {
    const token = await apiLogin('owner');
    const parts = token.split('.');
    expect(parts).toHaveLength(3);

    const payload = JSON.parse(b64urlDecode(parts[1]));
    expect(payload.userId).toBeTruthy();
    expect(payload.username).toBe('admin');
    expect(payload.role).toBe('owner');
    expect(payload.tenantId).toBe('default');
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

test.describe('JWT tampering — كل محاولة تُرفض', () => {
  test('توقيع مُعدَّل → redirect /login', async () => {
    const token = await apiLogin('owner');
    const [h, p] = token.split('.');
    const forged = `${h}.${p}.XXXXXXXXXXXXXXXXXXXX`;

    const res = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: `auth-token=${forged}` },
      redirect: 'manual',
    });
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get('location') ?? '').toContain('/login');
  });

  test('role مُعدَّل (viewer → owner) → redirect', async () => {
    const token = await apiLogin('viewer');
    const [h, p, s] = token.split('.');
    const payload = JSON.parse(b64urlDecode(p));
    payload.role = 'owner';
    const forged = `${h}.${b64urlEncode(payload)}.${s}`;

    const res = await fetch(`${BASE_URL}/settings`, {
      headers: { Cookie: `auth-token=${forged}` },
      redirect: 'manual',
    });
    expect([302, 307]).toContain(res.status);
  });

  test('alg:none → redirect', async () => {
    const header = b64urlEncode({ alg: 'none', typ: 'JWT' });
    const payload = b64urlEncode({
      userId: 'admin',
      username: 'admin',
      role: 'owner',
      tenantId: 'default',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const noneToken = `${header}.${payload}.`;

    const res = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: `auth-token=${noneToken}` },
      redirect: 'manual',
    });
    expect([302, 307]).toContain(res.status);
  });

  test('payload مُعدَّل بدون re-sign → redirect', async () => {
    const token = await apiLogin('owner');
    const [h, p, s] = token.split('.');
    const payload = JSON.parse(b64urlDecode(p));
    payload.userId = 'some_other_user';
    const forged = `${h}.${b64urlEncode(payload)}.${s}`;

    const res = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: `auth-token=${forged}` },
      redirect: 'manual',
    });
    expect([302, 307]).toContain(res.status);
  });

  test('توكن عشوائي مش JWT → redirect', async () => {
    const res = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: `auth-token=not-a-jwt-at-all` },
      redirect: 'manual',
    });
    expect([302, 307]).toContain(res.status);
  });

  test('exp مُعدَّل (بالماضي) → signature invalid → redirect', async () => {
    const token = await apiLogin('owner');
    const [h, p, s] = token.split('.');
    const payload = JSON.parse(b64urlDecode(p));
    payload.exp = Math.floor(Date.now() / 1000) - 60;
    const forged = `${h}.${b64urlEncode(payload)}.${s}`;

    const res = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: `auth-token=${forged}` },
      redirect: 'manual',
    });
    expect([302, 307]).toContain(res.status);
  });
});
