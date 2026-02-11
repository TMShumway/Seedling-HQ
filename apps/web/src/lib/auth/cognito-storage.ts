import type { ICognitoStorage } from 'amazon-cognito-identity-js';

const COGNITO_PREFIX = 'CognitoIdentityServiceProvider.';

/**
 * SessionStorage-backed adapter for the Cognito SDK.
 * - Survives page refresh but cleared on tab close (security sweet spot).
 * - `clear()` only removes Cognito-prefixed keys so other sessionStorage data is unaffected.
 * - `getItem` returns empty string for missing keys — the SDK expects this (not null).
 */
export class SessionCognitoStorage implements ICognitoStorage {
  setItem(key: string, value: string): string {
    sessionStorage.setItem(key, value);
    return value;
  }

  getItem(key: string): string {
    return sessionStorage.getItem(key) ?? '';
  }

  removeItem(key: string): void {
    sessionStorage.removeItem(key);
  }

  clear(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(COGNITO_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      sessionStorage.removeItem(key);
    }
  }
}
