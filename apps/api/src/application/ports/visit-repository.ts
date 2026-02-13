import type { Visit } from '../../domain/entities/visit.js';
import type { VisitStatus } from '../../domain/types/visit-status.js';

export interface VisitWithContext extends Visit {
  jobTitle: string;
  clientFirstName: string;
  clientLastName: string;
  propertyAddressLine1: string | null;
  assignedUserName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
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
  updateStatus(tenantId: string, id: string, status: VisitStatus, expectedStatuses: VisitStatus[]): Promise<Visit | null>;
  updateNotes(tenantId: string, id: string, notes: string | null): Promise<Visit | null>;
  listByDateRange(tenantId: string, from: Date, to: Date, filters?: ListVisitsFilters): Promise<VisitWithContext[]>;
  listUnscheduled(tenantId: string, filters?: ListVisitsFilters): Promise<VisitWithContext[]>;
}
