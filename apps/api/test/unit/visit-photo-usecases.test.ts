import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateVisitPhotoUseCase } from '../../src/application/usecases/create-visit-photo.js';
import { ConfirmVisitPhotoUseCase } from '../../src/application/usecases/confirm-visit-photo.js';
import { ListVisitPhotosUseCase } from '../../src/application/usecases/list-visit-photos.js';
import { DeleteVisitPhotoUseCase } from '../../src/application/usecases/delete-visit-photo.js';
import type { VisitRepository } from '../../src/application/ports/visit-repository.js';
import type { VisitPhotoRepository } from '../../src/application/ports/visit-photo-repository.js';
import type { FileStorage } from '../../src/application/ports/file-storage.js';
import type { AuditEventRepository } from '../../src/application/ports/audit-event-repository.js';
import type { Visit } from '../../src/domain/entities/visit.js';
import type { VisitPhoto } from '../../src/domain/entities/visit-photo.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CALLER_ID = '00000000-0000-0000-0000-000000000010';
const VISIT_ID = '00000000-0000-0000-0000-000000000950';
const PHOTO_ID = '00000000-0000-0000-0000-000000000200';
const JOB_ID = '00000000-0000-0000-0000-000000000900';

function makeVisit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: VISIT_ID,
    tenantId: TENANT_ID,
    jobId: JOB_ID,
    assignedUserId: CALLER_ID,
    scheduledStart: new Date('2026-02-12T09:00:00'),
    scheduledEnd: new Date('2026-02-12T11:00:00'),
    estimatedDurationMinutes: 120,
    status: 'started',
    notes: null,
    completedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makePhoto(overrides: Partial<VisitPhoto> = {}): VisitPhoto {
  return {
    id: PHOTO_ID,
    tenantId: TENANT_ID,
    visitId: VISIT_ID,
    storageKey: `tenants/${TENANT_ID}/visits/${VISIT_ID}/photos/${PHOTO_ID}.jpg`,
    fileName: 'photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: null,
    status: 'pending',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

function makeVisitRepo(): VisitRepository {
  return {
    create: vi.fn(),
    getById: vi.fn(),
    listByJobId: vi.fn(),
    updateSchedule: vi.fn(),
    updateAssignedUser: vi.fn(),
    updateStatus: vi.fn(),
    updateNotes: vi.fn(),
    listByDateRange: vi.fn(),
    listUnscheduled: vi.fn(),
  };
}

function makePhotoRepo(): VisitPhotoRepository {
  return {
    create: vi.fn(async (input) => ({ ...input, createdAt: new Date() })),
    getById: vi.fn(async () => null),
    confirmUpload: vi.fn(async () => null),
    listByVisitId: vi.fn(async () => []),
    delete: vi.fn(async () => false),
    countByVisitId: vi.fn(async () => 0),
    countPendingByVisitId: vi.fn(async () => 0),
    deleteStalePending: vi.fn(async () => []),
  };
}

function makeFileStorage(): FileStorage {
  return {
    generateUploadPost: vi.fn(async () => ({
      url: 'https://s3.amazonaws.com/test-bucket',
      fields: { key: 'test-key' },
    })),
    generateDownloadUrl: vi.fn(async (key: string) => `https://s3.amazonaws.com/${key}?signed`),
    deleteObject: vi.fn(async () => {}),
  };
}

function makeAuditRepo(): AuditEventRepository {
  return { record: vi.fn(), listBySubjects: vi.fn() };
}

describe('CreateVisitPhotoUseCase', () => {
  let visitRepo: VisitRepository;
  let photoRepo: VisitPhotoRepository;
  let fileStorage: FileStorage;
  let auditRepo: AuditEventRepository;
  let useCase: CreateVisitPhotoUseCase;

  beforeEach(() => {
    visitRepo = makeVisitRepo();
    photoRepo = makePhotoRepo();
    fileStorage = makeFileStorage();
    auditRepo = makeAuditRepo();
    useCase = new CreateVisitPhotoUseCase(visitRepo, photoRepo, fileStorage, auditRepo);
  });

  it('creates a pending photo and returns presigned post', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, fileName: 'photo.jpg', contentType: 'image/jpeg' },
      'corr-1',
    );

    expect(result.photo.status).toBe('pending');
    expect(result.uploadPost.url).toBeDefined();
    expect(photoRepo.create).toHaveBeenCalled();
    expect(fileStorage.generateUploadPost).toHaveBeenCalled();
  });

  it('rejects invalid content type', async () => {
    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, fileName: 'file.pdf', contentType: 'application/pdf' },
        'corr-2',
      ),
    ).rejects.toThrow('Invalid content type');
  });

  it('rejects empty file name', async () => {
    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, fileName: '', contentType: 'image/jpeg' },
        'corr-3',
      ),
    ).rejects.toThrow('File name is required');
  });

  it('rejects when visit not found', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, fileName: 'photo.jpg', contentType: 'image/jpeg' },
        'corr-4',
      ),
    ).rejects.toThrow('Visit not found');
  });

  it('rejects scheduled visit status', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ status: 'scheduled' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, fileName: 'photo.jpg', contentType: 'image/jpeg' },
        'corr-5',
      ),
    ).rejects.toThrow('Cannot add photos');
  });

  it('rejects when ready count >= 20', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.countByVisitId as ReturnType<typeof vi.fn>).mockResolvedValue(20);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, fileName: 'photo.jpg', contentType: 'image/jpeg' },
        'corr-6',
      ),
    ).rejects.toThrow('Maximum of 20 photos');
  });

  it('rejects member on another user\'s visit', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ assignedUserId: 'other-user' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'member', visitId: VISIT_ID, fileName: 'photo.jpg', contentType: 'image/jpeg' },
        'corr-7',
      ),
    ).rejects.toThrow('Members can only add photos');
  });

  it('cleans up stale pending records before cap check', async () => {
    const stalePhoto = makePhoto({ id: 'stale-1', storageKey: 'stale-key' });
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.deleteStalePending as ReturnType<typeof vi.fn>).mockResolvedValue([stalePhoto]);

    await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, fileName: 'photo.jpg', contentType: 'image/jpeg' },
      'corr-8',
    );

    expect(photoRepo.deleteStalePending).toHaveBeenCalledWith(TENANT_ID, VISIT_ID, 15);
    expect(fileStorage.deleteObject).toHaveBeenCalledWith('stale-key');
  });

  it('rejects when too many pending uploads', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.countPendingByVisitId as ReturnType<typeof vi.fn>).mockResolvedValue(5);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, fileName: 'photo.jpg', contentType: 'image/jpeg' },
        'corr-9',
      ),
    ).rejects.toThrow('Too many pending uploads');
  });
});

describe('ConfirmVisitPhotoUseCase', () => {
  let visitRepo: VisitRepository;
  let photoRepo: VisitPhotoRepository;
  let auditRepo: AuditEventRepository;
  let useCase: ConfirmVisitPhotoUseCase;

  beforeEach(() => {
    visitRepo = makeVisitRepo();
    photoRepo = makePhotoRepo();
    auditRepo = makeAuditRepo();
    useCase = new ConfirmVisitPhotoUseCase(visitRepo, photoRepo, auditRepo);
  });

  it('confirms a pending photo', async () => {
    const pendingPhoto = makePhoto({ status: 'pending' });
    const readyPhoto = makePhoto({ status: 'ready' });
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(pendingPhoto);
    (photoRepo.confirmUpload as ReturnType<typeof vi.fn>).mockResolvedValue(readyPhoto);

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
      'corr-1',
    );

    expect(result.photo.status).toBe('ready');
    expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'visit.photo_added' }));
  });

  it('returns idempotent success for already-confirmed photo', async () => {
    const readyPhoto = makePhoto({ status: 'ready' });
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makePhoto({ status: 'pending' }));
    (photoRepo.confirmUpload as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // Re-fetch returns ready (another request confirmed it)
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makePhoto({ status: 'pending' })).mockResolvedValueOnce(readyPhoto);

    const result = await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
      'corr-2',
    );

    expect(result.photo.status).toBe('ready');
  });

  it('throws when photo not found', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-3',
      ),
    ).rejects.toThrow('Photo not found');
  });

  it('throws when photo belongs to different visit', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makePhoto({ visitId: 'other-visit' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-4',
      ),
    ).rejects.toThrow('Photo not found');
  });

  it('throws when quota exceeded at confirm time', async () => {
    const pendingPhoto = makePhoto({ status: 'pending' });
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(pendingPhoto);
    (photoRepo.confirmUpload as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    // Re-fetch still pending (quota hit)
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(pendingPhoto).mockResolvedValueOnce(pendingPhoto);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-5',
      ),
    ).rejects.toThrow('Photo quota exceeded');
  });

  it('rejects member on another user\'s visit', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ assignedUserId: 'other-user' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'member', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-6',
      ),
    ).rejects.toThrow('Members can only manage photos');
  });

  it('rejects cancelled visit status', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ status: 'cancelled' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-7',
      ),
    ).rejects.toThrow('Cannot confirm photos on a visit with status "cancelled"');
  });
});

describe('ListVisitPhotosUseCase', () => {
  let visitRepo: VisitRepository;
  let photoRepo: VisitPhotoRepository;
  let fileStorage: FileStorage;
  let useCase: ListVisitPhotosUseCase;

  beforeEach(() => {
    visitRepo = makeVisitRepo();
    photoRepo = makePhotoRepo();
    fileStorage = makeFileStorage();
    useCase = new ListVisitPhotosUseCase(visitRepo, photoRepo, fileStorage);
  });

  it('returns photos with download URLs', async () => {
    const photos = [
      makePhoto({ id: 'p1', status: 'ready', storageKey: 'key1' }),
      makePhoto({ id: 'p2', status: 'ready', storageKey: 'key2' }),
    ];
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.listByVisitId as ReturnType<typeof vi.fn>).mockResolvedValue(photos);

    const result = await useCase.execute({
      tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID,
    });

    expect(result.photos).toHaveLength(2);
    expect(result.photos[0].downloadUrl).toContain('key1');
    expect(result.photos[1].downloadUrl).toContain('key2');
  });

  it('returns empty array when no photos', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());

    const result = await useCase.execute({
      tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID,
    });

    expect(result.photos).toHaveLength(0);
  });

  it('throws when visit not found', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID }),
    ).rejects.toThrow('Visit not found');
  });

  it('rejects member on another user\'s visit', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ assignedUserId: 'other-user' }));

    await expect(
      useCase.execute({ tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'member', visitId: VISIT_ID }),
    ).rejects.toThrow('Members can only view photos');
  });
});

describe('DeleteVisitPhotoUseCase', () => {
  let visitRepo: VisitRepository;
  let photoRepo: VisitPhotoRepository;
  let fileStorage: FileStorage;
  let auditRepo: AuditEventRepository;
  let useCase: DeleteVisitPhotoUseCase;

  beforeEach(() => {
    visitRepo = makeVisitRepo();
    photoRepo = makePhotoRepo();
    fileStorage = makeFileStorage();
    auditRepo = makeAuditRepo();
    useCase = new DeleteVisitPhotoUseCase(visitRepo, photoRepo, fileStorage, auditRepo);
  });

  it('deletes a photo and cleans up S3', async () => {
    const photo = makePhoto({ status: 'ready' });
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(photo);
    (photoRepo.delete as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
      'corr-1',
    );

    expect(photoRepo.delete).toHaveBeenCalledWith(TENANT_ID, PHOTO_ID);
    expect(fileStorage.deleteObject).toHaveBeenCalledWith(photo.storageKey);
    expect(auditRepo.record).toHaveBeenCalledWith(expect.objectContaining({ eventName: 'visit.photo_removed' }));
  });

  it('throws when visit not found', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-2',
      ),
    ).rejects.toThrow('Visit not found');
  });

  it('throws when photo not found', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-3',
      ),
    ).rejects.toThrow('Photo not found');
  });

  it('rejects scheduled visit status', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ status: 'scheduled' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-4',
      ),
    ).rejects.toThrow('Cannot delete photos');
  });

  it('rejects member on another user\'s visit', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit({ assignedUserId: 'other-user' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'member', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-5',
      ),
    ).rejects.toThrow('Members can only delete photos');
  });

  it('suppresses S3 delete errors', async () => {
    const photo = makePhoto({ status: 'ready' });
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(photo);
    (photoRepo.delete as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (fileStorage.deleteObject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('S3 error'));

    // Should not throw
    await useCase.execute(
      { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
      'corr-6',
    );
  });

  it('rejects cross-visit photo deletion', async () => {
    (visitRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeVisit());
    (photoRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makePhoto({ visitId: 'other-visit-id' }));

    await expect(
      useCase.execute(
        { tenantId: TENANT_ID, callerUserId: CALLER_ID, callerRole: 'owner', visitId: VISIT_ID, photoId: PHOTO_ID },
        'corr-7',
      ),
    ).rejects.toThrow('Photo not found');
  });
});
