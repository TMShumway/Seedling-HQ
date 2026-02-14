import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { ServiceCategory } from '../../../domain/entities/service-category.js';
import type { ServiceCategoryRepository } from '../../../application/ports/service-category-repository.js';
import type { ServiceItemRepository } from '../../../application/ports/service-item-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import { CreateServiceCategoryUseCase } from '../../../application/usecases/create-service-category.js';
import { UpdateServiceCategoryUseCase } from '../../../application/usecases/update-service-category.js';
import { DeactivateServiceCategoryUseCase } from '../../../application/usecases/deactivate-service-category.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';

const categoryResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createCategoryBodySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateCategoryBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

function serializeCategory(cat: ServiceCategory) {
  return {
    id: cat.id,
    tenantId: cat.tenantId,
    name: cat.name,
    description: cat.description,
    sortOrder: cat.sortOrder,
    active: cat.active,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  };
}

export function buildServiceCategoryRoutes(deps: {
  categoryRepo: ServiceCategoryRepository;
  serviceItemRepo: ServiceItemRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
  jwtVerifier?: JwtVerifier;
}) {
  const createUseCase = new CreateServiceCategoryUseCase(deps.categoryRepo, deps.auditRepo);
  const updateUseCase = new UpdateServiceCategoryUseCase(deps.categoryRepo, deps.auditRepo);
  const deactivateUseCase = new DeactivateServiceCategoryUseCase(deps.categoryRepo, deps.serviceItemRepo, deps.auditRepo);
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  return async function serviceCategoryRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/services/categories
    typedApp.get(
      '/v1/services/categories',
      {
        preHandler: authMiddleware,
        schema: {
          querystring: z.object({
            includeInactive: z.enum(['true', 'false']).optional(),
          }),
          response: { 200: z.array(categoryResponseSchema) },
        },
      },
      async (request) => {
        const includeInactive = request.query.includeInactive === 'true';
        const categories = await deps.categoryRepo.list(
          request.authContext.tenant_id,
          includeInactive,
        );
        return categories.map(serializeCategory);
      },
    );

    // POST /v1/services/categories
    typedApp.post(
      '/v1/services/categories',
      {
        preHandler: authMiddleware,
        schema: {
          body: createCategoryBodySchema,
          response: { 201: categoryResponseSchema },
        },
      },
      async (request, reply) => {
        const result = await createUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            name: request.body.name,
            description: request.body.description ?? null,
            sortOrder: request.body.sortOrder,
          },
          request.correlationId,
        );
        return reply.status(201).send(serializeCategory(result.category));
      },
    );

    // GET /v1/services/categories/:id
    typedApp.get(
      '/v1/services/categories/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: categoryResponseSchema },
        },
      },
      async (request) => {
        const category = await deps.categoryRepo.getById(
          request.authContext.tenant_id,
          request.params.id,
        );
        if (!category) {
          throw new NotFoundError('Service category not found');
        }
        return serializeCategory(category);
      },
    );

    // PUT /v1/services/categories/:id
    typedApp.put(
      '/v1/services/categories/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: updateCategoryBodySchema,
          response: { 200: categoryResponseSchema },
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
        return serializeCategory(result.category);
      },
    );

    // DELETE /v1/services/categories/:id (soft delete)
    typedApp.delete(
      '/v1/services/categories/:id',
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
