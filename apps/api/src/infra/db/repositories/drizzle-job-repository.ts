import { eq, and, or, ilike, sql, lt, desc } from 'drizzle-orm';
import type { JobRepository, ListJobsFilters } from '../../../application/ports/job-repository.js';
import type { PaginatedResult } from '../../../application/ports/client-repository.js';
import type { Job } from '../../../domain/entities/job.js';
import type { JobStatus } from '../../../domain/types/job-status.js';
import type { Database } from '../client.js';
import { jobs } from '../schema.js';
import { ValidationError } from '../../../shared/errors.js';

const DEFAULT_LIMIT = 20;

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; createdAt: Date } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    return { id: parsed.id, createdAt: new Date(parsed.createdAt) };
  } catch {
    throw new ValidationError('Invalid cursor');
  }
}

function toEntity(row: typeof jobs.$inferSelect): Job {
  return {
    id: row.id,
    tenantId: row.tenantId,
    quoteId: row.quoteId,
    clientId: row.clientId,
    propertyId: row.propertyId,
    title: row.title,
    status: row.status as JobStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleJobRepository implements JobRepository {
  constructor(private db: Database) {}

  async create(job: Omit<Job, 'createdAt' | 'updatedAt'>): Promise<Job> {
    const [row] = await this.db
      .insert(jobs)
      .values({
        id: job.id,
        tenantId: job.tenantId,
        quoteId: job.quoteId,
        clientId: job.clientId,
        propertyId: job.propertyId,
        title: job.title,
        status: job.status,
      })
      .returning();
    return toEntity(row);
  }

  async getById(tenantId: string, id: string): Promise<Job | null> {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async getByQuoteId(tenantId: string, quoteId: string): Promise<Job | null> {
    const rows = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.quoteId, quoteId)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async list(tenantId: string, filters?: ListJobsFilters): Promise<PaginatedResult<Job>> {
    const limit = filters?.limit ?? DEFAULT_LIMIT;
    const conditions = [eq(jobs.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(jobs.status, filters.status));
    }

    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(ilike(jobs.title, term));
    }

    if (filters?.cursor) {
      const { id, createdAt } = decodeCursor(filters.cursor);
      conditions.push(
        or(
          lt(jobs.createdAt, createdAt),
          and(eq(jobs.createdAt, createdAt), lt(jobs.id, id)),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.createdAt), desc(jobs.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(toEntity);
    const lastItem = data[data.length - 1];
    const cursor = lastItem && hasMore ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

    return { data, cursor, hasMore };
  }

  async count(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.tenantId, tenantId));
    return result[0].count;
  }

  async countByStatus(tenantId: string, status: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.status, status)));
    return result[0].count;
  }

  async updateStatus(tenantId: string, id: string, status: JobStatus): Promise<Job | null> {
    const rows = await this.db
      .update(jobs)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          eq(jobs.id, id),
        ),
      )
      .returning();
    return rows[0] ? toEntity(rows[0]) : null;
  }
}
