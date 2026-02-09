import type { Client } from '../../domain/entities/client.js';

export interface PaginatedResult<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface ListClientsFilters {
  limit?: number;
  cursor?: string;
  search?: string;
  includeInactive?: boolean;
}

export interface ClientRepository {
  list(tenantId: string, filters?: ListClientsFilters): Promise<PaginatedResult<Client>>;
  getById(tenantId: string, id: string): Promise<Client | null>;
  create(client: Omit<Client, 'createdAt' | 'updatedAt'>): Promise<Client>;
  update(
    tenantId: string,
    id: string,
    patch: Partial<Pick<Client, 'firstName' | 'lastName' | 'email' | 'phone' | 'company' | 'notes' | 'tags'>>,
  ): Promise<Client | null>;
  deactivate(tenantId: string, id: string): Promise<boolean>;
  count(tenantId: string): Promise<number>;
}
