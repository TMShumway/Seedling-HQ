import type { SecureLinkToken } from '../../domain/entities/secure-link-token.js';

export interface SecureLinkTokenRepository {
  create(token: Omit<SecureLinkToken, 'createdAt' | 'lastUsedAt'>): Promise<SecureLinkToken>;
  getByTokenHash(tokenHash: string): Promise<SecureLinkToken | null>;
  updateLastUsedAt(id: string): Promise<void>;
  revokeBySubject(tenantId: string, subjectType: string, subjectId: string): Promise<void>;
}
