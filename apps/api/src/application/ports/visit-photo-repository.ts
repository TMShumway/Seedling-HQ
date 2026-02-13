import type { VisitPhoto } from '../../domain/entities/visit-photo.js';

export interface VisitPhotoRepository {
  create(photo: Omit<VisitPhoto, 'createdAt'>): Promise<VisitPhoto>;
  getById(tenantId: string, id: string): Promise<VisitPhoto | null>;
  confirmUpload(tenantId: string, id: string, maxReady: number): Promise<VisitPhoto | null>;
  listByVisitId(tenantId: string, visitId: string): Promise<VisitPhoto[]>;
  delete(tenantId: string, id: string): Promise<boolean>;
  countByVisitId(tenantId: string, visitId: string): Promise<number>;
  countPendingByVisitId(tenantId: string, visitId: string): Promise<number>;
  deleteStalePending(tenantId: string, visitId: string, olderThanMinutes: number): Promise<VisitPhoto[]>;
}
