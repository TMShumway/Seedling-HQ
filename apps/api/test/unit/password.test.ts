import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/shared/password.js';

describe('hashPassword', () => {
  it('returns a self-describing scrypt string', async () => {
    const hash = await hashPassword('test-password');
    expect(hash).toMatch(/^scrypt:\d+:\d+:\d+:[a-f0-9]+:[a-f0-9]+$/);
  });

  it('produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyPassword', () => {
  it('returns true for correct password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('correct-password', hash);
    expect(result).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correct-password');
    const result = await verifyPassword('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('returns false for malformed hash string', async () => {
    const result = await verifyPassword('anything', 'not-a-valid-hash');
    expect(result).toBe(false);
  });

  it('returns false for empty password against valid hash', async () => {
    const hash = await hashPassword('some-password');
    const result = await verifyPassword('', hash);
    expect(result).toBe(false);
  });

  it('handles unicode passwords', async () => {
    const hash = await hashPassword('пароль-密码-🔑');
    expect(await verifyPassword('пароль-密码-🔑', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
