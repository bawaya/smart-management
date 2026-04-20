import { SignJWT, jwtVerify } from 'jose';

export interface JWTPayload {
  userId: string;
  role: string;
  username: string;
  tenantId: string;
}

const DEV_DEFAULT_SECRET = 'dev-only-insecure-secret-change-me';
const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL = '7d';

function getSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (raw && raw.length > 0) {
    return new TextEncoder().encode(raw);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  return new TextEncoder().encode(DEV_DEFAULT_SECRET);
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecret());
}

export async function signRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    });

    const { userId, role, username, tenantId } = payload as Record<
      string,
      unknown
    >;

    if (
      typeof userId !== 'string' ||
      typeof role !== 'string' ||
      typeof username !== 'string' ||
      typeof tenantId !== 'string'
    ) {
      return null;
    }

    return { userId, role, username, tenantId };
  } catch {
    return null;
  }
}
