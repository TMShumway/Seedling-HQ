import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Hash a password using scrypt. Returns a self-describing string:
 *   scrypt:N:r:p:salt_hex:hash_hex
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);

  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a password against a stored hash string.
 * Returns true if the password matches.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const N = parseInt(nStr, 10);
  const r = parseInt(rStr, 10);
  const p = parseInt(pStr, 10);
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, expectedHash.length, { N, r, p }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  return timingSafeEqual(derivedKey, expectedHash);
}
