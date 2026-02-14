import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { ServiceItem } from '../../../domain/entities/service-item.js';
import type { ServiceItemRepository } from '../../../application/ports/service-item-repository.js';
import type { ServiceCategoryRepository } from '../../../application/ports/service-category-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import { CreateServiceItemUseCase } from '../../../application/usecases/create-service-item.js';
import { UpdateServiceItemUseCase } from '../../../application/usecases/update-service-item.js';
import { DeactivateServiceItemUseCase } from '../../../application/usecases/deactivate-service-item.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';

const unitTypeSchema = z.enum(['flat', 'hourly', 'per_sqft', 'per_unit', 'per_visit']);

const serviceItemResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  unitPrice: z.number(),
  unitType: z.string(),
  estimatedDurationMinutes: z.number().nullable(),
  active: z.boolean(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createServiceItemBodySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).nullable().optional(),
  unitPrice: z.number().int().min(0, 'Unit price must be non-negative'),
  unitType: unitTypeSchema,
  estimatedDurationMinutes: z.number().int().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateServiceItemBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  unitPrice: z.number().int().min(0).optional(),
  unitType: unitTypeSchema.optional(),
  estimatedDurationMinutes: z.number().int().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

function serializeItem(item: ServiceItem) {
  return {
    id: item.id,
    tenantId: item.tenantId,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    unitPrice: item.unitPrice,
    unitType: item.unitType,
    estimatedDurationMinutes: item.estimatedDurationMinutes,
    active: item.active,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function buildServiceItemRoutes(deps: {
  serviceItemRepo: ServiceItemRepository;
  categoryRepo: ServiceCategoryRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
  jwtVerifier?: JwtVerifier;
}) {
  const createUseCase = new CreateServiceItemUseCase(deps.serviceItemRepo, deps.categoryRepo, deps.auditRepo);
  const updateUseCase = new UpdateServiceItemUseCase(deps.serviceItemRepo, deps.auditRepo);
  const deactivateUseCase = new DeactivateServiceItemUseCase(deps.serviceItemRepo, deps.auditRepo);
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  return async function serviceItemRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/services
    typedApp.get(
      '/v1/services',
      {
        preHandler: authMiddleware,
        schema: {
          querystring: z.object({
            categoryId: z.string().uuid().optional(),
            includeInactive: z.enum(['true', 'false']).optional(),
          }),
          response: { 200: z.array(serviceItemResponseSchema) },
        },
      },
      async (request) => {
        const items = await deps.serviceItemRepo.list(request.authContext.tenant_id, {
          categoryId: request.query.categoryId,
          includeInactive: request.query.includeInactive === 'true',
        });
        return items.map(serializeItem);
      },
    );

    // POST /v1/services
    typedApp.post(
      '/v1/services',
      {
        preHandler: authMiddleware,
        schema: {
          body: createServiceItemBodySchema,
          response: { 201: serviceItemResponseSchema },
        },
      },
      async (request, reply) => {
        const result = await createUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            categoryId: request.body.categoryId,
            name: request.body.name,
            description: request.body.description ?? null,
            unitPrice: request.body.unitPrice,
            unitType: request.body.unitType,
            estimatedDurationMinutes: request.body.estimatedDurationMinutes ?? null,
            sortOrder: request.body.sortOrder,
          },
          request.correlationId,
        );
        return reply.status(201).send(serializeItem(result.item));
      },
    );

    // GET /v1/services/:id
    typedApp.get(
      '/v1/services/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: serviceItemResponseSchema },
        },
      },
      async (request) => {
        const item = await deps.serviceItemRepo.getById(
          request.authContext.tenant_id,
          request.params.id,
        );
        if (!item) {
          throw new NotFoundError('Service item not found');
        }
        return serializeItem(item);
      },
    );

    // PUT /v1/services/:id
    typedApp.put(
      '/v1/services/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: updateServiceItemBodySchema,
          response: { 200: serviceItemResponseSchema },
        },
      },
      async (request) => {
        const result = await updateUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            id: request.params.id,
            ...request.body,
          },
          request.correlationId,
        );
        return serializeItem(result.item);
      },
    );

    // DELETE /v1/services/:id (soft delete)
    typedApp.delete(
      '/v1/services/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 204: z.undefined() },
        },
      },
      async (request, reply) => {
        await deactivateUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            id: request.params.id,
          },
          request.correlationId,
        );
        return reply.status(204).send();
      },
    );
  };
}
