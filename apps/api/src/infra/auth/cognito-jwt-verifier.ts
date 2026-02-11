import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import type { JwtVerifier, JwtVerifyResult } from '../../application/ports/jwt-verifier.js';
import { ROLES } from '../../domain/types/roles.js';
import type { Role } from '../../domain/types/roles.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CognitoJwtConfig {
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  COGNITO_REGION: string;
}

export class CognitoJwtVerifier implements JwtVerifier {
  private readonly jwks: JWTVerifyGetKey;
  private readonly issuer: string;
  private readonly clientId: string;

  constructor(config: CognitoJwtConfig, jwksOverride?: JWTVerifyGetKey) {
    const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_REGION } = config;
    this.issuer = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
    this.clientId = COGNITO_CLIENT_ID;

    this.jwks = jwksOverride ?? createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );
  }

  async verify(token: string): Promise<JwtVerifyResult> {
    // Validate signature, issuer, and expiry via jose
    // Note: Do NOT pass `audience` — Cognito access tokens use `client_id`, not `aud`
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.issuer,
    });

    // Validate token_use is 'access' (reject ID tokens)
    if (payload.token_use !== 'access') {
      throw new Error('Token is not an access token');
    }

    // Validate client_id (Cognito access tokens use client_id, not aud)
    if (payload.client_id !== this.clientId) {
      throw new Error('Token client_id does not match');
    }

    // Extract custom:tenant_id (added by pre-token-generation Lambda trigger)
    const tenantId = payload['custom:tenant_id'];
    if (typeof tenantId !== 'string' || !tenantId) {
      throw new Error('Token missing custom:tenant_id claim');
    }
    if (!UUID_RE.test(tenantId)) {
      throw new Error('Token custom:tenant_id is not a valid UUID');
    }

    // Extract username — Contract: Cognito username must equal users.id (enforced at user provisioning time)
    const userId = payload.username;
    if (typeof userId !== 'string' || !userId) {
      throw new Error('Token missing username claim');
    }
    if (!UUID_RE.test(userId)) {
      throw new Error('Token username is not a valid UUID');
    }

    // Extract role from cognito:groups — enforce exactly one group
    const groups = payload['cognito:groups'];
    if (!Array.isArray(groups) || groups.length !== 1) {
      throw new Error('Token must have exactly one cognito:groups entry');
    }

    const role = groups[0] as string;
    if (!ROLES.includes(role as Role)) {
      throw new Error(`Unknown role '${role}' in cognito:groups`);
    }

    return { tenantId, userId, role: role as Role };
  }
}
