import { randomUUID } from 'node:crypto';
import type { VisitRepository } from '../ports/visit-repository.js';
import type { VisitPhotoRepository } from '../ports/visit-photo-repository.js';
import type { FileStorage } from '../ports/file-storage.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors.js';

const EDITABLE_STATUSES = ['en_route', 'started', 'completed'];

export interface DeleteVisitPhotoInput {
  tenantId: string;
  callerUserId: string;
  callerRole: string;
  visitId: string;
  photoId: string;
}

export class DeleteVisitPhotoUseCase {
  constructor(
    private visitRepo: VisitRepository,
    private visitPhotoRepo: VisitPhotoRepository,
    private fileStorage: FileStorage,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(input: DeleteVisitPhotoInput, correlationId: string): Promise<void> {
    const visit = await this.visitRepo.getById(input.tenantId, input.visitId);
    if (!visit) {
      throw new NotFoundError('Visit not found');
    }

    if (!EDITABLE_STATUSES.includes(visit.status)) {
      throw new ValidationError(`Cannot delete photos from a visit with status "${visit.status}"`);
    }

    if (input.callerRole === 'member' && visit.assignedUserId !== input.callerUserId) {
      throw new ForbiddenError('Members can only delete photos on their own assigned visits');
    }

    // Cross-visit binding check
    const photo = await this.visitPhotoRepo.getById(input.tenantId, input.photoId);
    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    if (photo.visitId !== input.visitId) {
      throw new NotFoundError('Photo not found');
    }

    const deleted = await this.visitPhotoRepo.delete(input.tenantId, input.photoId);
    if (!deleted) {
      throw new NotFoundError('Photo not found');
    }

    // Best-effort S3 cleanup
    try { await this.fileStorage.deleteObject(photo.storageKey); } catch { /* best-effort */ }

    // Best-effort audit
    try {
      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.callerUserId,
        eventName: 'visit.photo_removed',
        subjectType: 'visit',
        subjectId: input.visitId,
        correlationId,
        metadata: { fileName: photo.fileName, photoId: photo.id },
      });
    } catch { /* best-effort */ }
  }
}
