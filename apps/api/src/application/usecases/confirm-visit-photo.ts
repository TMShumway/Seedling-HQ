import { randomUUID } from 'node:crypto';
import type { VisitRepository } from '../ports/visit-repository.js';
import type { VisitPhotoRepository } from '../ports/visit-photo-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { VisitPhoto } from '../../domain/entities/visit-photo.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors.js';

const MAX_READY_PHOTOS = 20;
const EDITABLE_STATUSES = ['en_route', 'started', 'completed'];

export interface ConfirmVisitPhotoInput {
  tenantId: string;
  callerUserId: string;
  callerRole: string;
  visitId: string;
  photoId: string;
}

export interface ConfirmVisitPhotoOutput {
  photo: VisitPhoto;
}

export class ConfirmVisitPhotoUseCase {
  constructor(
    private visitRepo: VisitRepository,
    private visitPhotoRepo: VisitPhotoRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(input: ConfirmVisitPhotoInput, correlationId: string): Promise<ConfirmVisitPhotoOutput> {
    const visit = await this.visitRepo.getById(input.tenantId, input.visitId);
    if (!visit) {
      throw new NotFoundError('Visit not found');
    }

    if (!EDITABLE_STATUSES.includes(visit.status)) {
      throw new ValidationError(`Cannot confirm photos on a visit with status "${visit.status}"`);
    }

    if (input.callerRole === 'member' && visit.assignedUserId !== input.callerUserId) {
      throw new ForbiddenError('Members can only manage photos on their own assigned visits');
    }

    // Validate photo belongs to this visit
    const photo = await this.visitPhotoRepo.getById(input.tenantId, input.photoId);
    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    if (photo.visitId !== input.visitId) {
      throw new NotFoundError('Photo not found');
    }

    // Serialized quota-checked confirm
    const confirmed = await this.visitPhotoRepo.confirmUpload(input.tenantId, input.photoId, MAX_READY_PHOTOS);

    if (!confirmed) {
      // Re-fetch to determine reason
      const refetched = await this.visitPhotoRepo.getById(input.tenantId, input.photoId);
      if (!refetched) {
        throw new NotFoundError('Photo not found');
      }
      if (refetched.status === 'ready') {
        // Already confirmed — idempotent success
        return { photo: refetched };
      }
      // Still pending but quota exceeded
      throw new ValidationError('Photo quota exceeded');
    }

    // Best-effort audit
    try {
      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.callerUserId,
        eventName: 'visit.photo_added',
        subjectType: 'visit',
        subjectId: input.visitId,
        correlationId,
        metadata: { fileName: confirmed.fileName, photoId: confirmed.id },
      });
    } catch { /* best-effort */ }

    return { photo: confirmed };
  }
}
