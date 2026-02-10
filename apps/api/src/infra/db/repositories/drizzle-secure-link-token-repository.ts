import { eq, and, isNull, sql } from 'drizzle-orm';
import type { SecureLinkTokenRepository } from '../../../application/ports/secure-link-token-repository.js';
import type { SecureLinkToken } from '../../../domain/entities/secure-link-token.js';
import type { Database } from '../client.js';
import { secureLinkTokens } from '../schema.js';

function toEntity(row: typeof secureLinkTokens.$inferSelect): SecureLinkToken {
  return {
    id: row.id,
    tenantId: row.tenantId,
    tokenHash: row.tokenHash,
    hashVersion: row.hashVersion,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    scopes: (row.scopes ?? []) as string[],
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

export class DrizzleSecureLinkTokenRepository implements SecureLinkTokenRepository {
  constructor(private db: Database) {}

  async create(token: Omit<SecureLinkToken, 'createdAt' | 'lastUsedAt'>): Promise<SecureLinkToken> {
    const [row] = await this.db
      .insert(secureLinkTokens)
      .values({
        id: token.id,
        tenantId: token.tenantId,
        tokenHash: token.tokenHash,
        hashVersion: token.hashVersion,
        subjectType: token.subjectType,
        subjectId: token.subjectId,
        scopes: token.scopes,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        createdByUserId: token.createdByUserId,
      })
      .returning();
    return toEntity(row);
  }

  async getByTokenHash(tokenHash: string): Promise<SecureLinkToken | null> {
    const rows = await this.db
      .select()
      .from(secureLinkTokens)
      .where(eq(secureLinkTokens.tokenHash, tokenHash));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async updateLastUsedAt(id: string): Promise<void> {
    await this.db
      .update(secureLinkTokens)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(secureLinkTokens.id, id));
  }

  async revokeBySubject(tenantId: string, subjectType: string, subjectId: string): Promise<void> {
    await this.db
      .update(secureLinkTokens)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(secureLinkTokens.tenantId, tenantId),
          eq(secureLinkTokens.subjectType, subjectType),
          eq(secureLinkTokens.subjectId, subjectId),
          isNull(secureLinkTokens.revokedAt),
        ),
      );
  }
}
