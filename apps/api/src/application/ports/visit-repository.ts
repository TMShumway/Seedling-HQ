import type { Visit } from '../../domain/entities/visit.js';

export interface VisitWithContext extends Visit {
  jobTitle: string;
  clientFirstName: string;
  clientLastName: string;
  propertyAddressLine1: string | null;
  assignedUserName: string | null;
}

export interface ListVisitsFilters {
  status?: string;
  assignedUserId?: string;
}

export interface VisitRepository {
  create(visit: Omit<Visit, 'createdAt' | 'updatedAt'>): Promise<Visit>;
  getById(tenantId: string, id: string): Promise<Visit | null>;
  listByJobId(tenantId: string, jobId: string): Promise<Visit[]>;
  updateSchedule(tenantId: string, id: string, scheduledStart: Date, scheduledEnd: Date): Promise<Visit | null>;
  updateAssignedUser(tenantId: string, id: string, assignedUserId: string | null): Promise<Visit | null>;
  listByDateRange(tenantId: string, from: Date, to: Date, filters?: ListVisitsFilters): Promise<VisitWithContext[]>;
  listUnscheduled(tenantId: string, filters?: ListVisitsFilters): Promise<VisitWithContext[]>;
}
