import { eq, and } from 'drizzle-orm';
import type { VisitRepository } from '../../../application/ports/visit-repository.js';
import type { Visit } from '../../../domain/entities/visit.js';
import type { VisitStatus } from '../../../domain/types/visit-status.js';
import type { Database } from '../client.js';
import { visits } from '../schema.js';

function toEntity(row: typeof visits.$inferSelect): Visit {
  return {
    id: row.id,
    tenantId: row.tenantId,
    jobId: row.jobId,
    assignedUserId: row.assignedUserId,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    estimatedDurationMinutes: row.estimatedDurationMinutes,
    status: row.status as VisitStatus,
    notes: row.notes,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleVisitRepository implements VisitRepository {
  constructor(private db: Database) {}

  async create(visit: Omit<Visit, 'createdAt' | 'updatedAt'>): Promise<Visit> {
    const [row] = await this.db
      .insert(visits)
      .values({
        id: visit.id,
        tenantId: visit.tenantId,
        jobId: visit.jobId,
        assignedUserId: visit.assignedUserId,
        scheduledStart: visit.scheduledStart,
        scheduledEnd: visit.scheduledEnd,
        estimatedDurationMinutes: visit.estimatedDurationMinutes,
        status: visit.status,
        notes: visit.notes,
        completedAt: visit.completedAt,
      })
      .returning();
    return toEntity(row);
  }

  async getById(tenantId: string, id: string): Promise<Visit | null> {
    const rows = await this.db
      .select()
      .from(visits)
      .where(and(eq(visits.tenantId, tenantId), eq(visits.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async listByJobId(tenantId: string, jobId: string): Promise<Visit[]> {
    const rows = await this.db
      .select()
      .from(visits)
      .where(and(eq(visits.tenantId, tenantId), eq(visits.jobId, jobId)));
    return rows.map(toEntity);
  }
}
