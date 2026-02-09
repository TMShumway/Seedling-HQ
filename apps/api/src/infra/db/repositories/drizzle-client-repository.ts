import { eq, and, or, ilike, sql, lt, desc } from 'drizzle-orm';
import type { ClientRepository, PaginatedResult, ListClientsFilters } from '../../../application/ports/client-repository.js';
import type { Client } from '../../../domain/entities/client.js';
import type { Database } from '../client.js';
import { clients } from '../schema.js';

const DEFAULT_LIMIT = 20;

function toEntity(row: typeof clients.$inferSelect): Client {
  return {
    id: row.id,
    tenantId: row.tenantId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    company: row.company,
    notes: row.notes,
    tags: row.tags as string[],
    active: row.active,
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

export class DrizzleClientRepository implements ClientRepository {
  constructor(private db: Database) {}

  async list(tenantId: string, filters?: ListClientsFilters): Promise<PaginatedResult<Client>> {
    const limit = filters?.limit ?? DEFAULT_LIMIT;
    const conditions = [eq(clients.tenantId, tenantId)];

    if (!filters?.includeInactive) {
      conditions.push(eq(clients.active, true));
    }

    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(clients.firstName, term),
          ilike(clients.lastName, term),
          ilike(clients.email, term),
          ilike(clients.phone, term),
          ilike(clients.company, term),
        )!,
      );
    }

    if (filters?.cursor) {
      const { id, createdAt } = decodeCursor(filters.cursor);
      conditions.push(
        or(
          lt(clients.createdAt, createdAt),
          and(eq(clients.createdAt, createdAt), lt(clients.id, id)),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(clients)
      .where(and(...conditions))
      .orderBy(desc(clients.createdAt), desc(clients.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(toEntity);
    const lastItem = data[data.length - 1];
    const cursor = lastItem && hasMore ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

    return { data, cursor, hasMore };
  }

  async getById(tenantId: string, id: string): Promise<Client | null> {
    const rows = await this.db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async create(client: Omit<Client, 'createdAt' | 'updatedAt'>): Promise<Client> {
    const [row] = await this.db
      .insert(clients)
      .values({
        id: client.id,
        tenantId: client.tenantId,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        company: client.company,
        notes: client.notes,
        tags: client.tags,
        active: client.active,
      })
      .returning();
    return toEntity(row);
  }

  async update(
    tenantId: string,
    id: string,
    patch: Partial<Pick<Client, 'firstName' | 'lastName' | 'email' | 'phone' | 'company' | 'notes' | 'tags'>>,
  ): Promise<Client | null> {
    const rows = await this.db
      .update(clients)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
      .returning();
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async deactivate(tenantId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .update(clients)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(clients.tenantId, tenantId), eq(clients.id, id)))
      .returning();
    return rows.length > 0;
  }

  async count(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.active, true)));
    return result[0].count;
  }
}
