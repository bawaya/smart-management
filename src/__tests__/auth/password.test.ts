import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth/password';

describe('password', () => {
  it('produces a hash different from the original password', async () => {
    const plain = 'correct-horse-battery-staple';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.length).toBeGreaterThan(20);
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('verifies the correct password against its hash', async () => {
    const plain = 'my-real-password';
    const hash = await hashPassword(plain);

    const result = await verifyPassword(plain, hash);
    expect(result).toBe(true);
  });

  it('rejects a wrong password against the hash', async () => {
    const hash = await hashPassword('my-real-password');

    const result = await verifyPassword('not-the-password', hash);
    expect(result).toBe(false);
  });
});
