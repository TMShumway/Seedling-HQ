import { describe, it, expect, beforeEach } from 'vitest';
import { SessionCognitoStorage } from '@/lib/auth/cognito-storage';

describe('SessionCognitoStorage', () => {
  let storage: SessionCognitoStorage;

  beforeEach(() => {
    sessionStorage.clear();
    storage = new SessionCognitoStorage();
  });

  it('setItem stores and returns the value', () => {
    const result = storage.setItem('key', 'value');
    expect(result).toBe('value');
    expect(sessionStorage.getItem('key')).toBe('value');
  });

  it('getItem returns stored value', () => {
    sessionStorage.setItem('testKey', 'testValue');
    expect(storage.getItem('testKey')).toBe('testValue');
  });

  it('getItem returns empty string for missing key', () => {
    expect(storage.getItem('nonexistent')).toBe('');
  });

  it('removeItem removes the key', () => {
    sessionStorage.setItem('toRemove', 'val');
    storage.removeItem('toRemove');
    expect(sessionStorage.getItem('toRemove')).toBeNull();
  });

  it('clear only removes Cognito-prefixed keys', () => {
    sessionStorage.setItem('CognitoIdentityServiceProvider.abc', '1');
    sessionStorage.setItem('CognitoIdentityServiceProvider.def', '2');
    sessionStorage.setItem('myAppKey', '3');

    storage.clear();

    expect(sessionStorage.getItem('CognitoIdentityServiceProvider.abc')).toBeNull();
    expect(sessionStorage.getItem('CognitoIdentityServiceProvider.def')).toBeNull();
    expect(sessionStorage.getItem('myAppKey')).toBe('3');
  });

  it('clear handles empty sessionStorage', () => {
    expect(() => storage.clear()).not.toThrow();
  });
});
