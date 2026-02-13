import { randomUUID } from 'node:crypto';
import type { VisitRepository } from '../ports/visit-repository.js';
import type { VisitPhotoRepository } from '../ports/visit-photo-repository.js';
import type { FileStorage, PresignedPost } from '../ports/file-storage.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { VisitPhoto } from '../../domain/entities/visit-photo.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors.js';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/webp'];
const MAX_READY_PHOTOS = 20;
const MAX_PENDING_PHOTOS = 5;
const MAX_FILE_SIZE = 10_485_760; // 10MB
const STALE_PENDING_MINUTES = 15;
const EDITABLE_STATUSES = ['en_route', 'started', 'completed'];

const CONTENT_TYPE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/webp': 'webp',
};

export interface CreateVisitPhotoInput {
  tenantId: string;
  callerUserId: string;
  callerRole: string;
  visitId: string;
  fileName: string;
  contentType: string;
}

export interface CreateVisitPhotoOutput {
  photo: VisitPhoto;
  uploadPost: PresignedPost;
}

export class CreateVisitPhotoUseCase {
  constructor(
    private visitRepo: VisitRepository,
    private visitPhotoRepo: VisitPhotoRepository,
    private fileStorage: FileStorage,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(input: CreateVisitPhotoInput, correlationId: string): Promise<CreateVisitPhotoOutput> {
    if (!input.fileName.trim()) {
      throw new ValidationError('File name is required');
    }

    if (!ALLOWED_CONTENT_TYPES.includes(input.contentType)) {
      throw new ValidationError(`Invalid content type "${input.contentType}". Allowed: ${ALLOWED_CONTENT_TYPES.join(', ')}`);
    }

    const visit = await this.visitRepo.getById(input.tenantId, input.visitId);
    if (!visit) {
      throw new NotFoundError('Visit not found');
    }

    if (!EDITABLE_STATUSES.includes(visit.status)) {
      throw new ValidationError(`Cannot add photos to a visit with status "${visit.status}"`);
    }

    if (input.callerRole === 'member' && visit.assignedUserId !== input.callerUserId) {
      throw new ForbiddenError('Members can only add photos to their own assigned visits');
    }

    // Clean up stale pending records (self-healing)
    const staleRecords = await this.visitPhotoRepo.deleteStalePending(input.tenantId, input.visitId, STALE_PENDING_MINUTES);
    for (const stale of staleRecords) {
      try { await this.fileStorage.deleteObject(stale.storageKey); } catch { /* best-effort */ }
    }

    // Check ready count
    const readyCount = await this.visitPhotoRepo.countByVisitId(input.tenantId, input.visitId);
    if (readyCount >= MAX_READY_PHOTOS) {
      throw new ValidationError(`Maximum of ${MAX_READY_PHOTOS} photos per visit`);
    }

    // Soft pending cap
    const pendingCount = await this.visitPhotoRepo.countPendingByVisitId(input.tenantId, input.visitId);
    if (pendingCount >= MAX_PENDING_PHOTOS) {
      throw new ValidationError('Too many pending uploads. Please wait for current uploads to complete.');
    }

    const photoId = randomUUID();
    const ext = CONTENT_TYPE_EXT[input.contentType];
    const storageKey = `tenants/${input.tenantId}/visits/${input.visitId}/photos/${photoId}.${ext}`;

    // Generate presigned POST first — if this fails, no orphaned DB row is created
    const uploadPost = await this.fileStorage.generateUploadPost(storageKey, input.contentType, MAX_FILE_SIZE);

    const photo = await this.visitPhotoRepo.create({
      id: photoId,
      tenantId: input.tenantId,
      visitId: input.visitId,
      storageKey,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: null,
      status: 'pending',
    });

    // Best-effort audit
    try {
      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.callerUserId,
        eventName: 'visit.photo_upload_started',
        subjectType: 'visit',
        subjectId: input.visitId,
        correlationId,
        metadata: { fileName: input.fileName, photoId },
      });
    } catch { /* best-effort */ }

    return { photo, uploadPost };
  }
}
