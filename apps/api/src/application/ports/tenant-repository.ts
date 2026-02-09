import type { Tenant } from '../../domain/entities/tenant.js';

export interface TenantRepository {
  create(tenant: Omit<Tenant, 'createdAt' | 'updatedAt'>): Promise<Tenant>;
  getById(id: string): Promise<Tenant | null>;
  getBySlug(slug: string): Promise<Tenant | null>;
}
