import { describe, it, expect } from 'vitest';
import { hashToken } from '../../src/shared/crypto.js';

describe('hashToken', () => {
  it('returns deterministic output for the same input', () => {
    const hash1 = hashToken('secret', 'my-token');
    const hash2 = hashToken('secret', 'my-token');
    expect(hash1).toBe(hash2);
  });

  it('returns a 64-character hex string', () => {
    const hash = hashToken('secret', 'my-token');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different tokens', () => {
    const hash1 = hashToken('secret', 'token-a');
    const hash2 = hashToken('secret', 'token-b');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different secrets', () => {
    const hash1 = hashToken('secret-1', 'my-token');
    const hash2 = hashToken('secret-2', 'my-token');
    expect(hash1).not.toBe(hash2);
  });
});
