import { eq, and, isNull, gte, lt, asc, sql } from 'drizzle-orm';
import type { VisitRepository, VisitWithContext, ListVisitsFilters } from '../../../application/ports/visit-repository.js';
import type { Visit } from '../../../domain/entities/visit.js';
import type { VisitStatus } from '../../../domain/types/visit-status.js';
import type { Database } from '../client.js';
import { visits, jobs, clients, properties } from '../schema.js';

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

  async updateSchedule(
    tenantId: string,
    id: string,
    scheduledStart: Date,
    scheduledEnd: Date,
  ): Promise<Visit | null> {
    const rows = await this.db
      .update(visits)
      .set({
        scheduledStart,
        scheduledEnd,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(visits.tenantId, tenantId),
          eq(visits.id, id),
          eq(visits.status, 'scheduled'),
        ),
      )
      .returning();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async listByDateRange(
    tenantId: string,
    from: Date,
    to: Date,
    filters?: ListVisitsFilters,
  ): Promise<VisitWithContext[]> {
    const conditions = [
      eq(visits.tenantId, tenantId),
      gte(visits.scheduledStart, from),
      lt(visits.scheduledStart, to),
    ];

    if (filters?.status) {
      conditions.push(eq(visits.status, filters.status));
    }

    const rows = await this.db
      .select({
        visit: visits,
        jobTitle: jobs.title,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        propertyAddressLine1: properties.addressLine1,
      })
      .from(visits)
      .innerJoin(jobs, eq(visits.jobId, jobs.id))
      .innerJoin(clients, eq(jobs.clientId, clients.id))
      .leftJoin(properties, eq(jobs.propertyId, properties.id))
      .where(and(...conditions))
      .orderBy(asc(visits.scheduledStart));

    return rows.map((r) => ({
      ...toEntity(r.visit),
      jobTitle: r.jobTitle,
      clientFirstName: r.clientFirstName,
      clientLastName: r.clientLastName,
      propertyAddressLine1: r.propertyAddressLine1,
    }));
  }

  async listUnscheduled(tenantId: string): Promise<VisitWithContext[]> {
    const rows = await this.db
      .select({
        visit: visits,
        jobTitle: jobs.title,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        propertyAddressLine1: properties.addressLine1,
      })
      .from(visits)
      .innerJoin(jobs, eq(visits.jobId, jobs.id))
      .innerJoin(clients, eq(jobs.clientId, clients.id))
      .leftJoin(properties, eq(jobs.propertyId, properties.id))
      .where(
        and(
          eq(visits.tenantId, tenantId),
          isNull(visits.scheduledStart),
          eq(visits.status, 'scheduled'),
        ),
      )
      .orderBy(asc(visits.createdAt));

    return rows.map((r) => ({
      ...toEntity(r.visit),
      jobTitle: r.jobTitle,
      clientFirstName: r.clientFirstName,
      clientLastName: r.clientLastName,
      propertyAddressLine1: r.propertyAddressLine1,
    }));
  }
}
