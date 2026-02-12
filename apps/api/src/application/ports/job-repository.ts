import type { Job } from '../../domain/entities/job.js';
import type { PaginatedResult } from './client-repository.js';

export interface ListJobsFilters {
  limit?: number;
  cursor?: string;
  search?: string;
  status?: string;
}

export interface JobRepository {
  create(job: Omit<Job, 'createdAt' | 'updatedAt'>): Promise<Job>;
  getById(tenantId: string, id: string): Promise<Job | null>;
  getByQuoteId(tenantId: string, quoteId: string): Promise<Job | null>;
  list(tenantId: string, filters?: ListJobsFilters): Promise<PaginatedResult<Job>>;
  count(tenantId: string): Promise<number>;
  countByStatus(tenantId: string, status: string): Promise<number>;
}
