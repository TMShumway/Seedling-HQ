export interface VisitPhoto {
  id: string;
  tenantId: string;
  visitId: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  status: 'pending' | 'ready';
  createdAt: Date;
}
