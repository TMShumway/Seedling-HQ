import type { Visit } from '../../domain/entities/visit.js';

export interface VisitWithContext extends Visit {
  jobTitle: string;
  clientFirstName: string;
  clientLastName: string;
  propertyAddressLine1: string | null;
}

export interface ListVisitsFilters {
  status?: string;
}

export interface VisitRepository {
  create(visit: Omit<Visit, 'createdAt' | 'updatedAt'>): Promise<Visit>;
  getById(tenantId: string, id: string): Promise<Visit | null>;
  listByJobId(tenantId: string, jobId: string): Promise<Visit[]>;
  updateSchedule(tenantId: string, id: string, scheduledStart: Date, scheduledEnd: Date): Promise<Visit | null>;
  listByDateRange(tenantId: string, from: Date, to: Date, filters?: ListVisitsFilters): Promise<VisitWithContext[]>;
  listUnscheduled(tenantId: string): Promise<VisitWithContext[]>;
}
