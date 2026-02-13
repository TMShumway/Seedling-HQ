import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { VisitPhotoRepository } from '../../../application/ports/visit-photo-repository.js';
import type { VisitRepository } from '../../../application/ports/visit-repository.js';
import type { FileStorage } from '../../../application/ports/file-storage.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import { CreateVisitPhotoUseCase } from '../../../application/usecases/create-visit-photo.js';
import { ConfirmVisitPhotoUseCase } from '../../../application/usecases/confirm-visit-photo.js';
import { ListVisitPhotosUseCase } from '../../../application/usecases/list-visit-photos.js';
import { DeleteVisitPhotoUseCase } from '../../../application/usecases/delete-visit-photo.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';

const photoResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  visitId: z.string(),
  storageKey: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().nullable(),
  status: z.string(),
  createdAt: z.string(),
});

const photoWithUrlResponseSchema = photoResponseSchema.extend({
  downloadUrl: z.string(),
});

const presignedPostSchema = z.object({
  url: z.string(),
  fields: z.record(z.string()),
});

function serializePhoto(p: { id: string; tenantId: string; visitId: string; storageKey: string; fileName: string; contentType: string; sizeBytes: number | null; status: string; createdAt: Date }) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    visitId: p.visitId,
    storageKey: p.storageKey,
    fileName: p.fileName,
    contentType: p.contentType,
    sizeBytes: p.sizeBytes,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}

export function buildVisitPhotoRoutes(deps: {
  visitPhotoRepo: VisitPhotoRepository;
  visitRepo: VisitRepository;
  fileStorage: FileStorage;
  auditRepo: AuditEventRepository;
  config: AppConfig;
  jwtVerifier?: JwtVerifier;
}) {
  const createUseCase = new CreateVisitPhotoUseCase(deps.visitRepo, deps.visitPhotoRepo, deps.fileStorage, deps.auditRepo);
  const confirmUseCase = new ConfirmVisitPhotoUseCase(deps.visitRepo, deps.visitPhotoRepo, deps.auditRepo);
  const listUseCase = new ListVisitPhotosUseCase(deps.visitRepo, deps.visitPhotoRepo, deps.fileStorage);
  const deleteUseCase = new DeleteVisitPhotoUseCase(deps.visitRepo, deps.visitPhotoRepo, deps.fileStorage, deps.auditRepo);
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  return async function visitPhotoRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // POST /v1/visits/:visitId/photos — create photo + get presigned upload post
    typedApp.post(
      '/v1/visits/:visitId/photos',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ visitId: z.string().uuid() }),
          body: z.object({
            fileName: z.string().min(1).max(500),
            contentType: z.string().min(1).max(100),
          }),
          response: {
            201: z.object({ photo: photoResponseSchema, uploadPost: presignedPostSchema }),
          },
        },
      },
      async (request, reply) => {
        const result = await createUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            callerUserId: request.authContext.user_id,
            callerRole: request.authContext.role,
            visitId: request.params.visitId,
            fileName: request.body.fileName,
            contentType: request.body.contentType,
          },
          request.correlationId,
        );
        return reply.status(201).send({
          photo: serializePhoto(result.photo),
          uploadPost: result.uploadPost,
        });
      },
    );

    // POST /v1/visits/:visitId/photos/:photoId/confirm — confirm successful upload
    typedApp.post(
      '/v1/visits/:visitId/photos/:photoId/confirm',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({
            visitId: z.string().uuid(),
            photoId: z.string().uuid(),
          }),
          response: {
            200: z.object({ photo: photoResponseSchema }),
          },
        },
      },
      async (request) => {
        const result = await confirmUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            callerUserId: request.authContext.user_id,
            callerRole: request.authContext.role,
            visitId: request.params.visitId,
            photoId: request.params.photoId,
          },
          request.correlationId,
        );
        return { photo: serializePhoto(result.photo) };
      },
    );

    // GET /v1/visits/:visitId/photos — list ready photos with download URLs
    typedApp.get(
      '/v1/visits/:visitId/photos',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ visitId: z.string().uuid() }),
          response: {
            200: z.object({ data: z.array(photoWithUrlResponseSchema) }),
          },
        },
      },
      async (request) => {
        const result = await listUseCase.execute({
          tenantId: request.authContext.tenant_id,
          callerUserId: request.authContext.user_id,
          callerRole: request.authContext.role,
          visitId: request.params.visitId,
        });
        return {
          data: result.photos.map((p) => ({
            ...serializePhoto(p),
            downloadUrl: p.downloadUrl,
          })),
        };
      },
    );

    // DELETE /v1/visits/:visitId/photos/:photoId — delete photo
    typedApp.delete(
      '/v1/visits/:visitId/photos/:photoId',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({
            visitId: z.string().uuid(),
            photoId: z.string().uuid(),
          }),
          response: {
            204: z.undefined(),
          },
        },
      },
      async (request, reply) => {
        await deleteUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            callerUserId: request.authContext.user_id,
            callerRole: request.authContext.role,
            visitId: request.params.visitId,
            photoId: request.params.photoId,
          },
          request.correlationId,
        );
        return reply.status(204).send();
      },
    );
  };
}
