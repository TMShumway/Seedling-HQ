import type { Role } from '../../domain/types/roles.js';

export interface JwtVerifyResult {
  tenantId: string;
  userId: string;
  role: Role;
}

export interface JwtVerifier {
  verify(token: string): Promise<JwtVerifyResult>;
}
