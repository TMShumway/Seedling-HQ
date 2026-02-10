import { eq, and, or, ilike, sql, lt, desc, inArray } from 'drizzle-orm';
import type { RequestRepository, ListRequestsFilters } from '../../../application/ports/request-repository.js';
import type { PaginatedResult } from '../../../application/ports/client-repository.js';
import type { Request } from '../../../domain/entities/request.js';
import type { RequestStatus, RequestSource } from '../../../domain/entities/request.js';
import type { Database } from '../client.js';
import { requests } from '../schema.js';

const DEFAULT_LIMIT = 20;

function toEntity(row: typeof requests.$inferSelect): Request {
  return {
    id: row.id,
    tenantId: row.tenantId,
    source: row.source as RequestSource,
    clientName: row.clientName,
    clientEmail: row.clientEmail,
    clientPhone: row.clientPhone,
    description: row.description,
    status: row.status as RequestStatus,
    assignedUserId: row.assignedUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; createdAt: Date } {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  return { id: parsed.id, createdAt: new Date(parsed.createdAt) };
}

export class DrizzleRequestRepository implements RequestRepository {
  constructor(private db: Database) {}

  async list(tenantId: string, filters?: ListRequestsFilters): Promise<PaginatedResult<Request>> {
    const limit = filters?.limit ?? DEFAULT_LIMIT;
    const conditions = [eq(requests.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(requests.status, filters.status));
    }

    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(requests.clientName, term),
          ilike(requests.clientEmail, term),
          ilike(requests.clientPhone, term),
          ilike(requests.description, term),
        )!,
      );
    }

    if (filters?.cursor) {
      const { id, createdAt } = decodeCursor(filters.cursor);
      conditions.push(
        or(
          lt(requests.createdAt, createdAt),
          and(eq(requests.createdAt, createdAt), lt(requests.id, id)),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(requests)
      .where(and(...conditions))
      .orderBy(desc(requests.createdAt), desc(requests.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(toEntity);
    const lastItem = data[data.length - 1];
    const cursor = lastItem && hasMore ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

    return { data, cursor, hasMore };
  }

  async getById(tenantId: string, id: string): Promise<Request | null> {
    const rows = await this.db
      .select()
      .from(requests)
      .where(and(eq(requests.tenantId, tenantId), eq(requests.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async create(request: Omit<Request, 'createdAt' | 'updatedAt'>): Promise<Request> {
    const [row] = await this.db
      .insert(requests)
      .values({
        id: request.id,
        tenantId: request.tenantId,
        source: request.source,
        clientName: request.clientName,
        clientEmail: request.clientEmail,
        clientPhone: request.clientPhone,
        description: request.description,
        status: request.status,
        assignedUserId: request.assignedUserId,
      })
      .returning();
    return toEntity(row);
  }

  async updateStatus(tenantId: string, id: string, status: string, expectedStatuses?: string[]): Promise<Request | null> {
    const conditions = [eq(requests.tenantId, tenantId), eq(requests.id, id)];
    if (expectedStatuses?.length) {
      conditions.push(inArray(requests.status, expectedStatuses));
    }
    const rows = await this.db
      .update(requests)
      .set({ status, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async count(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(requests)
      .where(eq(requests.tenantId, tenantId));
    return result[0].count;
  }

  async countByStatus(tenantId: string, status: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(requests)
      .where(and(eq(requests.tenantId, tenantId), eq(requests.status, status)));
    return result[0].count;
  }
}
