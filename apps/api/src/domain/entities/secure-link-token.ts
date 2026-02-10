export interface SecureLinkToken {
  id: string;
  tenantId: string;
  tokenHash: string;
  hashVersion: string;
  subjectType: string;
  subjectId: string;
  scopes: string[];
  expiresAt: Date;
  revokedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}
