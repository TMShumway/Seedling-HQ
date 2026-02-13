import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getDb, getPool, truncateAll, buildTestApp } from './setup.js';
import { resetRateLimitStore } from '../../src/adapters/http/middleware/rate-limit.js';
import { randomUUID } from 'node:crypto';
import { tenants, users, clients, quotes, jobs, visits, visitPhotos } from '../../src/infra/db/schema.js';
import { hashPassword } from '../../src/shared/password.js';
import type { FileStorage, PresignedPost } from '../../src/application/ports/file-storage.js';

const TENANT_ID = randomUUID();
const OWNER_ID = randomUUID();
const MEMBER_ID = randomUUID();
const CLIENT_ID = randomUUID();
const QUOTE_ID = randomUUID();
const JOB_ID = randomUUID();
const VISIT_ID = randomUUID();

function makeMockFileStorage(): FileStorage {
  return {
    generateUploadPost: vi.fn(async (key: string): Promise<PresignedPost> => ({
      url: `http://localhost:4566/test-bucket`,
      fields: { key, 'Content-Type': 'image/jpeg', Policy: 'base64policy', 'X-Amz-Signature': 'sig123' },
    })),
    generateDownloadUrl: vi.fn(async (key: string) => `http://localhost:4566/test-bucket/${key}?signed=true`),
    deleteObject: vi.fn(async () => {}),
  };
}

async function seedTestData() {
  const db = getDb();
  const passwordHash = await hashPassword('password');

  await db.insert(tenants).values({ id: TENANT_ID, slug: `photos-test-${TENANT_ID.slice(0, 8)}`, name: 'Photos Test Co' });
  await db.insert(users).values([
    { id: OWNER_ID, tenantId: TENANT_ID, email: 'owner@photos.test', fullName: 'Owner User', role: 'owner', passwordHash, status: 'active' },
    { id: MEMBER_ID, tenantId: TENANT_ID, email: 'member@photos.test', fullName: 'Member User', role: 'member', passwordHash, status: 'active' },
  ]);
  await db.insert(clients).values({ id: CLIENT_ID, tenantId: TENANT_ID, firstName: 'Photo', lastName: 'Client', email: 'client@photos.test' });
  await db.insert(quotes).values({ id: QUOTE_ID, tenantId: TENANT_ID, clientId: CLIENT_ID, title: 'Photo Test Quote', status: 'scheduled', lineItems: [], subtotal: 0, tax: 0, total: 0 });
  await db.insert(jobs).values({ id: JOB_ID, tenantId: TENANT_ID, quoteId: QUOTE_ID, clientId: CLIENT_ID, title: 'Photo Test Job', status: 'scheduled' });
  await db.insert(visits).values({
    id: VISIT_ID,
    tenantId: TENANT_ID,
    jobId: JOB_ID,
    assignedUserId: MEMBER_ID,
    estimatedDurationMinutes: 60,
    status: 'started',
  });
}

describe('Visit Photo Routes', () => {
  let mockFileStorage: FileStorage;

  beforeEach(async () => {
    await truncateAll();
    resetRateLimitStore();
    await seedTestData();
    mockFileStorage = makeMockFileStorage();
  });

  afterAll(async () => {
    await getPool().end();
  });

  describe('POST /v1/visits/:visitId/photos', () => {
    it('creates a pending photo record and returns presigned post', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      const res = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos`,
        payload: { fileName: 'lawn-before.jpg', contentType: 'image/jpeg' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.photo.status).toBe('pending');
      expect(body.photo.fileName).toBe('lawn-before.jpg');
      expect(body.photo.visitId).toBe(VISIT_ID);
      expect(body.uploadPost.url).toBeDefined();
      expect(body.uploadPost.fields).toBeDefined();
    });

    it('rejects invalid content type', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      const res = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos`,
        payload: { fileName: 'doc.pdf', contentType: 'application/pdf' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects scheduled visit', async () => {
      const db = getDb();
      const scheduledVisitId = randomUUID();
      await db.insert(visits).values({
        id: scheduledVisitId, tenantId: TENANT_ID, jobId: JOB_ID,
        assignedUserId: MEMBER_ID, estimatedDurationMinutes: 60, status: 'scheduled',
      });

      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      const res = await app.inject({
        method: 'POST',
        url: `/v1/visits/${scheduledVisitId}/photos`,
        payload: { fileName: 'photo.jpg', contentType: 'image/jpeg' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /v1/visits/:visitId/photos/:photoId/confirm', () => {
    it('transitions pending photo to ready', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      // Create photo
      const createRes = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos`,
        payload: { fileName: 'photo.jpg', contentType: 'image/jpeg' },
      });
      const photoId = createRes.json().photo.id;

      // Confirm
      const confirmRes = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos/${photoId}/confirm`,
      });

      expect(confirmRes.statusCode).toBe(200);
      expect(confirmRes.json().photo.status).toBe('ready');
    });

    it('returns idempotent success for already-confirmed photo', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      // Create + confirm
      const createRes = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos`,
        payload: { fileName: 'photo.jpg', contentType: 'image/jpeg' },
      });
      const photoId = createRes.json().photo.id;
      await app.inject({ method: 'POST', url: `/v1/visits/${VISIT_ID}/photos/${photoId}/confirm` });

      // Confirm again
      const secondConfirm = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos/${photoId}/confirm`,
      });
      expect(secondConfirm.statusCode).toBe(200);
      expect(secondConfirm.json().photo.status).toBe('ready');
    });
  });

  describe('GET /v1/visits/:visitId/photos', () => {
    it('lists only ready photos with download URLs', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      // Create and confirm one photo
      const createRes = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos`,
        payload: { fileName: 'ready.jpg', contentType: 'image/jpeg' },
      });
      const photoId = createRes.json().photo.id;
      await app.inject({ method: 'POST', url: `/v1/visits/${VISIT_ID}/photos/${photoId}/confirm` });

      // Create another pending (not confirmed)
      await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos`,
        payload: { fileName: 'pending.jpg', contentType: 'image/jpeg' },
      });

      // List
      const listRes = await app.inject({
        method: 'GET',
        url: `/v1/visits/${VISIT_ID}/photos`,
      });

      expect(listRes.statusCode).toBe(200);
      const photos = listRes.json().data;
      expect(photos).toHaveLength(1);
      expect(photos[0].fileName).toBe('ready.jpg');
      expect(photos[0].downloadUrl).toBeDefined();
    });

    it('returns empty array for visit with no photos', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      const res = await app.inject({ method: 'GET', url: `/v1/visits/${VISIT_ID}/photos` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(0);
    });
  });

  describe('DELETE /v1/visits/:visitId/photos/:photoId', () => {
    it('deletes a photo and calls fileStorage.deleteObject', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      // Create and confirm
      const createRes = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos`,
        payload: { fileName: 'delete-me.jpg', contentType: 'image/jpeg' },
      });
      const photoId = createRes.json().photo.id;
      await app.inject({ method: 'POST', url: `/v1/visits/${VISIT_ID}/photos/${photoId}/confirm` });

      // Delete
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/v1/visits/${VISIT_ID}/photos/${photoId}`,
      });
      expect(deleteRes.statusCode).toBe(204);

      // Verify gone
      const listRes = await app.inject({ method: 'GET', url: `/v1/visits/${VISIT_ID}/photos` });
      expect(listRes.json().data).toHaveLength(0);

      expect(mockFileStorage.deleteObject).toHaveBeenCalled();
    });

    it('returns 404 for nonexistent photo', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/visits/${VISIT_ID}/photos/00000000-0000-0000-0000-000000000999`,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Concurrent confirm serialization', () => {
    it('allows exactly maxReady photos when confirmed concurrently', async () => {
      const db = getDb();
      const MAX_READY = 20;

      // Seed 19 ready photos directly in DB
      for (let i = 0; i < 19; i++) {
        await db.insert(visitPhotos).values({
          id: randomUUID(),
          tenantId: TENANT_ID,
          visitId: VISIT_ID,
          storageKey: `tenants/${TENANT_ID}/visits/${VISIT_ID}/photos/ready-${i}.jpg`,
          fileName: `ready-${i}.jpg`,
          contentType: 'image/jpeg',
          status: 'ready',
        });
      }

      // Create 2 pending photos
      const pendingIds = [randomUUID(), randomUUID()];
      for (const id of pendingIds) {
        await db.insert(visitPhotos).values({
          id,
          tenantId: TENANT_ID,
          visitId: VISIT_ID,
          storageKey: `tenants/${TENANT_ID}/visits/${VISIT_ID}/photos/${id}.jpg`,
          fileName: `pending-${id}.jpg`,
          contentType: 'image/jpeg',
          status: 'pending',
        });
      }

      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: OWNER_ID, DEV_AUTH_ROLE: 'owner' },
        { fileStorage: mockFileStorage },
      );

      // Confirm both concurrently
      const [res1, res2] = await Promise.all(
        pendingIds.map((photoId) =>
          app.inject({ method: 'POST', url: `/v1/visits/${VISIT_ID}/photos/${photoId}/confirm` }),
        ),
      );

      const statuses = [res1.statusCode, res2.statusCode].sort();
      // One should succeed (200), one should fail (400 quota exceeded)
      expect(statuses).toEqual([200, 400]);

      // Verify exactly 20 ready photos
      const listRes = await app.inject({ method: 'GET', url: `/v1/visits/${VISIT_ID}/photos` });
      expect(listRes.json().data).toHaveLength(MAX_READY);
    });
  });

  describe('RBAC', () => {
    it('member can manage photos on their own assigned visit', async () => {
      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: MEMBER_ID, DEV_AUTH_ROLE: 'member' },
        { fileStorage: mockFileStorage },
      );

      // Create
      const createRes = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos`,
        payload: { fileName: 'member-photo.jpg', contentType: 'image/jpeg' },
      });
      expect(createRes.statusCode).toBe(201);

      // Confirm
      const photoId = createRes.json().photo.id;
      const confirmRes = await app.inject({
        method: 'POST',
        url: `/v1/visits/${VISIT_ID}/photos/${photoId}/confirm`,
      });
      expect(confirmRes.statusCode).toBe(200);

      // List
      const listRes = await app.inject({ method: 'GET', url: `/v1/visits/${VISIT_ID}/photos` });
      expect(listRes.statusCode).toBe(200);

      // Delete
      const deleteRes = await app.inject({ method: 'DELETE', url: `/v1/visits/${VISIT_ID}/photos/${photoId}` });
      expect(deleteRes.statusCode).toBe(204);
    });

    it('member cannot manage photos on another user\'s visit', async () => {
      const db = getDb();
      const otherVisitId = randomUUID();
      await db.insert(visits).values({
        id: otherVisitId, tenantId: TENANT_ID, jobId: JOB_ID,
        assignedUserId: OWNER_ID, estimatedDurationMinutes: 60, status: 'started',
      });

      const app = await buildTestApp(
        { DEV_AUTH_TENANT_ID: TENANT_ID, DEV_AUTH_USER_ID: MEMBER_ID, DEV_AUTH_ROLE: 'member' },
        { fileStorage: mockFileStorage },
      );

      const res = await app.inject({
        method: 'POST',
        url: `/v1/visits/${otherVisitId}/photos`,
        payload: { fileName: 'photo.jpg', contentType: 'image/jpeg' },
      });
      expect(res.statusCode).toBe(403);
    });
  });
});
