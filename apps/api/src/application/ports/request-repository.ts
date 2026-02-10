import type { Request } from '../../domain/entities/request.js';
import type { PaginatedResult } from './client-repository.js';

export interface ListRequestsFilters {
  limit?: number;
  cursor?: string;
  search?: string;
  status?: string;
}

export interface RequestRepository {
  list(tenantId: string, filters?: ListRequestsFilters): Promise<PaginatedResult<Request>>;
  getById(tenantId: string, id: string): Promise<Request | null>;
  create(request: Omit<Request, 'createdAt' | 'updatedAt'>): Promise<Request>;
  updateStatus(tenantId: string, id: string, status: string, expectedStatuses?: string[]): Promise<Request | null>;
  count(tenantId: string): Promise<number>;
  countByStatus(tenantId: string, status: string): Promise<number>;
}
