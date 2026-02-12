import type { Visit } from '../../domain/entities/visit.js';

export interface VisitRepository {
  create(visit: Omit<Visit, 'createdAt' | 'updatedAt'>): Promise<Visit>;
  getById(tenantId: string, id: string): Promise<Visit | null>;
  listByJobId(tenantId: string, jobId: string): Promise<Visit[]>;
}
