import { eq } from 'drizzle-orm';
import type { TenantRepository } from '../../../application/ports/tenant-repository.js';
import type { Tenant } from '../../../domain/entities/tenant.js';
import type { TenantStatus } from '../../../domain/types/status.js';
import type { Database } from '../client.js';
import { tenants } from '../schema.js';

function toEntity(row: typeof tenants.$inferSelect): Tenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as TenantStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleTenantRepository implements TenantRepository {
  constructor(private db: Database) {}

  async create(tenant: Omit<Tenant, 'createdAt' | 'updatedAt'>): Promise<Tenant> {
    const [row] = await this.db
      .insert(tenants)
      .values({
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
      })
      .returning();
    return toEntity(row);
  }

  async getById(id: string): Promise<Tenant | null> {
    const rows = await this.db.select().from(tenants).where(eq(tenants.id, id));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async getBySlug(slug: string): Promise<Tenant | null> {
    const rows = await this.db.select().from(tenants).where(eq(tenants.slug, slug));
    return rows[0] ? toEntity(rows[0]) : null;
  }
}
