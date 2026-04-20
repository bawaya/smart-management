import { cookies } from 'next/headers';
import {
  type JWTPayload,
  signRefreshToken,
  signToken,
  verifyToken,
} from './jwt';

const AUTH_COOKIE = 'auth-token';
const REFRESH_COOKIE = 'refresh-token';
const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 7;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export async function createSession(
  userId: string,
  role: string,
  username: string,
  tenantId: string,
): Promise<void> {
  const payload: JWTPayload = { userId, role, username, tenantId };
  const [accessToken, refreshToken] = await Promise.all([
    signToken(payload),
    signRefreshToken(payload),
  ]);

  const store = cookies();
  store.set(AUTH_COOKIE, accessToken, cookieOptions(ACCESS_MAX_AGE));
  store.set(REFRESH_COOKIE, refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export async function getSession(): Promise<JWTPayload | null> {
  const store = cookies();

  const accessToken = store.get(AUTH_COOKIE)?.value;
  if (accessToken) {
    const payload = await verifyToken(accessToken);
    if (payload) return payload;
  }

  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  const refreshPayload = await verifyToken(refreshToken);
  if (!refreshPayload) return null;

  const newAccessToken = await signToken(refreshPayload);
  try {
    store.set(AUTH_COOKIE, newAccessToken, cookieOptions(ACCESS_MAX_AGE));
  } catch {
    // cookies().set() is only allowed in Server Actions / Route Handlers.
    // In a Server Component the rotation is skipped; the session is still
    // valid for this request and will be rotated on the next mutating call.
  }

  return refreshPayload;
}

export async function destroySession(): Promise<void> {
  const store = cookies();
  store.delete(AUTH_COOKIE);
  store.delete(REFRESH_COOKIE);
}
