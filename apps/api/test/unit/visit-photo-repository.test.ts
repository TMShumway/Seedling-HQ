import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VisitPhotoRepository } from '../../src/application/ports/visit-photo-repository.js';
import type { VisitPhoto } from '../../src/domain/entities/visit-photo.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const VISIT_ID = '00000000-0000-0000-0000-000000000100';
const PHOTO_ID = '00000000-0000-0000-0000-000000000200';

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

function makeRepo(overrides: Partial<VisitPhotoRepository> = {}): VisitPhotoRepository {
  return {
    create: vi.fn(async (input) => ({ ...input, createdAt: new Date() })),
    getById: vi.fn(async () => null),
    confirmUpload: vi.fn(async () => null),
    listByVisitId: vi.fn(async () => []),
    delete: vi.fn(async () => false),
    countByVisitId: vi.fn(async () => 0),
    countPendingByVisitId: vi.fn(async () => 0),
    deleteStalePending: vi.fn(async () => []),
    ...overrides,
  };
}

describe('VisitPhotoRepository port contract', () => {
  describe('create', () => {
    it('creates a photo record with pending status', async () => {
      const repo = makeRepo();
      const input = {
        id: PHOTO_ID,
        tenantId: TENANT_ID,
        visitId: VISIT_ID,
        storageKey: `tenants/${TENANT_ID}/visits/${VISIT_ID}/photos/${PHOTO_ID}.jpg`,
        fileName: 'photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: null,
        status: 'pending' as const,
      };

      const result = await repo.create(input);
      expect(repo.create).toHaveBeenCalledWith(input);
      expect(result).toBeDefined();
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getById', () => {
    it('returns null when photo not found', async () => {
      const repo = makeRepo();
      const result = await repo.getById(TENANT_ID, 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns photo when found', async () => {
      const photo = makePhoto();
      const repo = makeRepo({
        getById: vi.fn(async () => photo),
      });
      const result = await repo.getById(TENANT_ID, PHOTO_ID);
      expect(result).toEqual(photo);
    });
  });

  describe('confirmUpload', () => {
    it('transitions pending to ready when within quota', async () => {
      const readyPhoto = makePhoto({ status: 'ready' });
      const repo = makeRepo({
        confirmUpload: vi.fn(async () => readyPhoto),
      });
      const result = await repo.confirmUpload(TENANT_ID, PHOTO_ID, 20);
      expect(result).toEqual(readyPhoto);
      expect(result?.status).toBe('ready');
    });

    it('returns null when ready count >= maxReady', async () => {
      const repo = makeRepo({
        confirmUpload: vi.fn(async () => null),
      });
      const result = await repo.confirmUpload(TENANT_ID, PHOTO_ID, 20);
      expect(result).toBeNull();
    });
  });

  describe('listByVisitId', () => {
    it('returns only ready photos', async () => {
      const photos = [
        makePhoto({ id: 'p1', status: 'ready' }),
        makePhoto({ id: 'p2', status: 'ready' }),
      ];
      const repo = makeRepo({
        listByVisitId: vi.fn(async () => photos),
      });
      const result = await repo.listByVisitId(TENANT_ID, VISIT_ID);
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.status === 'ready')).toBe(true);
    });
  });

  describe('delete', () => {
    it('returns true when photo is deleted', async () => {
      const repo = makeRepo({ delete: vi.fn(async () => true) });
      const result = await repo.delete(TENANT_ID, PHOTO_ID);
      expect(result).toBe(true);
    });

    it('returns false when photo not found', async () => {
      const repo = makeRepo();
      const result = await repo.delete(TENANT_ID, 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('countByVisitId', () => {
    it('counts only ready photos', async () => {
      const repo = makeRepo({ countByVisitId: vi.fn(async () => 5) });
      const result = await repo.countByVisitId(TENANT_ID, VISIT_ID);
      expect(result).toBe(5);
    });
  });

  describe('countPendingByVisitId', () => {
    it('counts only pending photos', async () => {
      const repo = makeRepo({ countPendingByVisitId: vi.fn(async () => 3) });
      const result = await repo.countPendingByVisitId(TENANT_ID, VISIT_ID);
      expect(result).toBe(3);
    });
  });

  describe('deleteStalePending', () => {
    it('returns deleted stale pending photos', async () => {
      const stalePhotos = [makePhoto({ id: 'stale1' }), makePhoto({ id: 'stale2' })];
      const repo = makeRepo({
        deleteStalePending: vi.fn(async () => stalePhotos),
      });
      const result = await repo.deleteStalePending(TENANT_ID, VISIT_ID, 15);
      expect(result).toHaveLength(2);
      expect(repo.deleteStalePending).toHaveBeenCalledWith(TENANT_ID, VISIT_ID, 15);
    });
  });
});
