import type { VisitStatus } from '../types/visit-status.js';

export interface Visit {
  id: string;
  tenantId: string;
  jobId: string;
  assignedUserId: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  estimatedDurationMinutes: number;
  status: VisitStatus;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
