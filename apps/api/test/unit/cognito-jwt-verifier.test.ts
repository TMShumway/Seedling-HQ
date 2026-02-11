import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { CognitoJwtVerifier } from '../../src/infra/auth/cognito-jwt-verifier.js';
import type { CognitoJwtConfig } from '../../src/infra/auth/cognito-jwt-verifier.js';

const POOL_ID = 'us-east-1_TestPool';
const CLIENT_ID = 'test-client-id';
const REGION = 'us-east-1';
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;

const config: CognitoJwtConfig = {
  COGNITO_USER_POOL_ID: POOL_ID,
  COGNITO_CLIENT_ID: CLIENT_ID,
  COGNITO_REGION: REGION,
};

let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;
let wrongPrivateKey: CryptoKey;

beforeAll(async () => {
  const kp = await generateKeyPair('RS256');
  privateKey = kp.privateKey;
  const publicJwk = await exportJWK(kp.publicKey);
  publicJwk.kid = 'test-key-1';
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';
  jwks = createLocalJWKSet({ keys: [publicJwk] });

  const wrongKp = await generateKeyPair('RS256');
  wrongPrivateKey = wrongKp.privateKey;
});

function buildToken(claims: Record<string, unknown> = {}, options: { key?: CryptoKey; issuer?: string; expiresIn?: string } = {}) {
  const { key = privateKey, issuer = ISSUER, expiresIn = '1h' } = options;

  return new SignJWT({
    token_use: 'access',
    client_id: CLIENT_ID,
    'custom:tenant_id': 'tenant-123',
    username: 'user-456',
    'cognito:groups': ['owner'],
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

describe('CognitoJwtVerifier', () => {
  it('verifies a valid access token', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken();

    const result = await verifier.verify(token);

    expect(result).toEqual({
      tenantId: 'tenant-123',
      userId: 'user-456',
      role: 'owner',
    });
  });

  it('rejects an expired token', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({}, { expiresIn: '-1h' });

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('rejects a token with wrong issuer', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({}, { issuer: 'https://wrong-issuer.example.com' });

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('rejects a token with wrong client_id', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ client_id: 'wrong-client' });

    await expect(verifier.verify(token)).rejects.toThrow('client_id');
  });

  it('rejects a token with wrong token_use (id instead of access)', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ token_use: 'id' });

    await expect(verifier.verify(token)).rejects.toThrow('not an access token');
  });

  it('rejects a token with missing custom:tenant_id', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ 'custom:tenant_id': undefined });

    await expect(verifier.verify(token)).rejects.toThrow('custom:tenant_id');
  });

  it('rejects a token with empty custom:tenant_id', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ 'custom:tenant_id': '' });

    await expect(verifier.verify(token)).rejects.toThrow('custom:tenant_id');
  });

  it('rejects a token with missing cognito:groups', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ 'cognito:groups': undefined });

    await expect(verifier.verify(token)).rejects.toThrow('exactly one');
  });

  it('rejects a token with empty cognito:groups', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ 'cognito:groups': [] });

    await expect(verifier.verify(token)).rejects.toThrow('exactly one');
  });

  it('rejects a token with multiple cognito:groups', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ 'cognito:groups': ['owner', 'admin'] });

    await expect(verifier.verify(token)).rejects.toThrow('exactly one');
  });

  it('rejects a token with unknown group name', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ 'cognito:groups': ['technician'] });

    await expect(verifier.verify(token)).rejects.toThrow("Unknown role 'technician'");
  });

  it('rejects a token signed with wrong key', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({}, { key: wrongPrivateKey });

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('rejects a token with missing username claim', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ username: undefined });

    await expect(verifier.verify(token)).rejects.toThrow('username');
  });

  it('rejects a token with empty username claim', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);
    const token = await buildToken({ username: '' });

    await expect(verifier.verify(token)).rejects.toThrow('username');
  });

  it('accepts all valid roles', async () => {
    const verifier = new CognitoJwtVerifier(config, jwks);

    for (const role of ['owner', 'admin', 'member'] as const) {
      const token = await buildToken({ 'cognito:groups': [role] });
      const result = await verifier.verify(token);
      expect(result.role).toBe(role);
    }
  });
});
