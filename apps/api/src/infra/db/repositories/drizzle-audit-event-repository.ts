import type {
  AuditEventRepository,
  AuditEvent,
} from '../../../application/ports/audit-event-repository.js';
import type { Database } from '../client.js';
import { auditEvents } from '../schema.js';

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
}
