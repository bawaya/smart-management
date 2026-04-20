import { SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { type JWTPayload, signToken, verifyToken } from '@/lib/auth/jwt';

const TEST_SECRET = 'test-secret-for-unit-tests-only-32-bytes-min';

const samplePayload: JWTPayload = {
  userId: 'user-123',
  role: 'owner',
  username: 'admin',
  tenantId: 'default',
};

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

describe('jwt', () => {
  it('signs and verifies a token preserving all payload fields including tenantId', async () => {
    const token = await signToken(samplePayload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded).toEqual(samplePayload);
    expect(decoded?.tenantId).toBe('default');
  });

  it('returns null for an expired token', async () => {
    const secret = new TextEncoder().encode(TEST_SECRET);
    const expiredToken = await new SignJWT({ ...samplePayload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);

    const result = await verifyToken(expiredToken);
    expect(result).toBeNull();
  });

  it('returns null for a tampered token', async () => {
    const token = await signToken(samplePayload);
    const tampered = token.slice(0, -6) + 'ABCDEF';

    const result = await verifyToken(tampered);
    expect(result).toBeNull();
  });
});
