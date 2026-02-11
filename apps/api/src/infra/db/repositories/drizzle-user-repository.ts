import { eq, and, ilike } from 'drizzle-orm';
import type { UserRepository, UserWithTenant } from '../../../application/ports/user-repository.js';
import type { User } from '../../../domain/entities/user.js';
import type { Role } from '../../../domain/types/roles.js';
import type { UserStatus } from '../../../domain/types/status.js';
import type { Database } from '../client.js';
import { users, tenants } from '../schema.js';

function toEntity(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    fullName: row.fullName,
    role: row.role as Role,
    status: row.status as UserStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private db: Database) {}

  async create(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        id: user.id,
        tenantId: user.tenantId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      })
      .returning();
    return toEntity(row);
  }

  async getById(tenantId: string, id: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async getByEmail(tenantId: string, email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async getOwnerByTenantId(tenantId: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')))
      .limit(1);
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async listActiveByEmail(email: string): Promise<UserWithTenant[]> {
    const rows = await this.db
      .select({
        user: users,
        tenantName: tenants.name,
      })
      .from(users)
      .innerJoin(tenants, eq(users.tenantId, tenants.id))
      .where(
        and(
          ilike(users.email, email),
          eq(users.status, 'active'),
          eq(tenants.status, 'active'),
        ),
      );
    return rows.map((row) => ({
      user: toEntity(row.user),
      tenantName: row.tenantName,
    }));
  }
}
