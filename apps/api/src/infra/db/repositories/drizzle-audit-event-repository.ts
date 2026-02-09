import { eq, and, or, lt, desc, inArray, notInArray } from 'drizzle-orm';
import type {
  AuditEventRepository,
  AuditEvent,
  ListBySubjectsFilters,
} from '../../../application/ports/audit-event-repository.js';
import type { PaginatedResult } from '../../../application/ports/client-repository.js';
import type { Database } from '../client.js';
import { auditEvents } from '../schema.js';

const DEFAULT_LIMIT = 20;

function toEntity(row: typeof auditEvents.$inferSelect): AuditEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    principalType: row.principalType,
    principalId: row.principalId,
    eventName: row.eventName,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    correlationId: row.correlationId,
    createdAt: row.createdAt,
  };
}

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; createdAt: Date } {
  const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
  return { id: parsed.id, createdAt: new Date(parsed.createdAt) };
}

export class DrizzleAuditEventRepository implements AuditEventRepository {
  constructor(private db: Database) {}

  async record(event: Omit<AuditEvent, 'createdAt'>): Promise<AuditEvent> {
    const [row] = await this.db
      .insert(auditEvents)
      .values({
        id: event.id,
        tenantId: event.tenantId,
        principalType: event.principalType,
        principalId: event.principalId,
        eventName: event.eventName,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        correlationId: event.correlationId,
      })
      .returning();
    return toEntity(row);
  }

  async listBySubjects(
    tenantId: string,
    subjectIds: string[],
    filters?: ListBySubjectsFilters,
  ): Promise<PaginatedResult<AuditEvent>> {
    if (subjectIds.length === 0) {
      return { data: [], cursor: null, hasMore: false };
    }

    const limit = filters?.limit ?? DEFAULT_LIMIT;
    const conditions = [
      eq(auditEvents.tenantId, tenantId),
      inArray(auditEvents.subjectId, subjectIds),
    ];

    if (filters?.excludeEventNames && filters.excludeEventNames.length > 0) {
      conditions.push(notInArray(auditEvents.eventName, filters.excludeEventNames));
    }

    if (filters?.cursor) {
      const { id, createdAt } = decodeCursor(filters.cursor);
      conditions.push(
        or(
          lt(auditEvents.createdAt, createdAt),
          and(eq(auditEvents.createdAt, createdAt), lt(auditEvents.id, id)),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(toEntity);
    const lastItem = data[data.length - 1];
    const cursor = lastItem && hasMore ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

    return { data, cursor, hasMore };
  }
}
