import type { PaginatedResult } from './client-repository.js';

export interface AuditEvent {
  id: string;
  tenantId: string;
  principalType: string;
  principalId: string;
  eventName: string;
  subjectType: string;
  subjectId: string;
  correlationId: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ListBySubjectsFilters {
  limit?: number;
  cursor?: string;
  excludeEventNames?: string[];
  subjectTypes?: string[];
}

export interface AuditEventRepository {
  record(event: Omit<AuditEvent, 'createdAt'>): Promise<AuditEvent>;
  listBySubjects(
    tenantId: string,
    subjectIds: string[],
    filters?: ListBySubjectsFilters,
  ): Promise<PaginatedResult<AuditEvent>>;
}
