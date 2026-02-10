import { createHmac } from 'node:crypto';

/**
 * Hash a raw token using HMAC-SHA256 with the given secret.
 * Returns the hex-encoded hash. Never store the raw token.
 */
export function hashToken(secret: string, rawToken: string): string {
  return createHmac('sha256', secret).update(rawToken).digest('hex');
}
