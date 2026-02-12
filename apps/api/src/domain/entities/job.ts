import type { JobStatus } from '../types/job-status.js';

export interface Job {
  id: string;
  tenantId: string;
  quoteId: string;
  clientId: string;
  propertyId: string | null;
  title: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
}
