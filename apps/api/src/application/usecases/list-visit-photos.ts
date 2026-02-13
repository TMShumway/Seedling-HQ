import type { VisitRepository } from '../ports/visit-repository.js';
import type { VisitPhotoRepository } from '../ports/visit-photo-repository.js';
import type { FileStorage } from '../ports/file-storage.js';
import type { VisitPhoto } from '../../domain/entities/visit-photo.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors.js';

export interface ListVisitPhotosInput {
  tenantId: string;
  callerUserId: string;
  callerRole: string;
  visitId: string;
}

export interface VisitPhotoWithUrl extends VisitPhoto {
  downloadUrl: string;
}

export interface ListVisitPhotosOutput {
  photos: VisitPhotoWithUrl[];
}

export class ListVisitPhotosUseCase {
  constructor(
    private visitRepo: VisitRepository,
    private visitPhotoRepo: VisitPhotoRepository,
    private fileStorage: FileStorage,
  ) {}

  async execute(input: ListVisitPhotosInput): Promise<ListVisitPhotosOutput> {
    const visit = await this.visitRepo.getById(input.tenantId, input.visitId);
    if (!visit) {
      throw new NotFoundError('Visit not found');
    }

    if (input.callerRole === 'member' && visit.assignedUserId !== input.callerUserId) {
      throw new ForbiddenError('Members can only view photos on their own assigned visits');
    }

    const photos = await this.visitPhotoRepo.listByVisitId(input.tenantId, input.visitId);

    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        downloadUrl: await this.fileStorage.generateDownloadUrl(photo.storageKey),
      })),
    );

    return { photos: photosWithUrls };
  }
}
