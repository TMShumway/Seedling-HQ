import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Property } from '../../../domain/entities/property.js';
import type { PropertyRepository } from '../../../application/ports/property-repository.js';
import type { ClientRepository } from '../../../application/ports/client-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import { CreatePropertyUseCase } from '../../../application/usecases/create-property.js';
import { UpdatePropertyUseCase } from '../../../application/usecases/update-property.js';
import { DeactivatePropertyUseCase } from '../../../application/usecases/deactivate-property.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';

const propertyResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  clientId: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  notes: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const createPropertyBodySchema = z.object({
  addressLine1: z.string().min(1, 'Address line 1 is required').max(255),
  addressLine2: z.string().max(255).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  notes: z.string().nullable().optional(),
});

const updatePropertyBodySchema = z.object({
  addressLine1: z.string().min(1).max(255).optional(),
  addressLine2: z.string().max(255).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  notes: z.string().nullable().optional(),
});

function serializeProperty(property: Property) {
  return {
    id: property.id,
    tenantId: property.tenantId,
    clientId: property.clientId,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    state: property.state,
    zip: property.zip,
    notes: property.notes,
    active: property.active,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

export function buildPropertyRoutes(deps: {
  propertyRepo: PropertyRepository;
  clientRepo: ClientRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
  jwtVerifier?: JwtVerifier;
}) {
  const createUseCase = new CreatePropertyUseCase(deps.propertyRepo, deps.clientRepo, deps.auditRepo);
  const updateUseCase = new UpdatePropertyUseCase(deps.propertyRepo, deps.auditRepo);
  const deactivateUseCase = new DeactivatePropertyUseCase(deps.propertyRepo, deps.auditRepo);
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  return async function propertyRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/clients/:clientId/properties
    typedApp.get(
      '/v1/clients/:clientId/properties',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ clientId: z.string().uuid() }),
          querystring: z.object({
            includeInactive: z.enum(['true', 'false']).optional(),
          }),
          response: { 200: z.array(propertyResponseSchema) },
        },
      },
      async (request) => {
        const includeInactive = request.query.includeInactive === 'true';
        const props = await deps.propertyRepo.listByClientId(
          request.authContext.tenant_id,
          request.params.clientId,
          includeInactive,
        );
        return props.map(serializeProperty);
      },
    );

    // POST /v1/clients/:clientId/properties
    typedApp.post(
      '/v1/clients/:clientId/properties',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ clientId: z.string().uuid() }),
          body: createPropertyBodySchema,
          response: { 201: propertyResponseSchema },
        },
      },
      async (request, reply) => {
        const result = await createUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            clientId: request.params.clientId,
            addressLine1: request.body.addressLine1,
            addressLine2: request.body.addressLine2 ?? null,
            city: request.body.city ?? null,
            state: request.body.state ?? null,
            zip: request.body.zip ?? null,
            notes: request.body.notes ?? null,
          },
          request.correlationId,
        );
        return reply.status(201).send(serializeProperty(result.property));
      },
    );

    // GET /v1/properties/:id
    typedApp.get(
      '/v1/properties/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: propertyResponseSchema },
        },
      },
      async (request) => {
        const property = await deps.propertyRepo.getById(
          request.authContext.tenant_id,
          request.params.id,
        );
        if (!property) {
          throw new NotFoundError('Property not found');
        }
        return serializeProperty(property);
      },
    );

    // PUT /v1/properties/:id
    typedApp.put(
      '/v1/properties/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: updatePropertyBodySchema,
          response: { 200: propertyResponseSchema },
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
        return serializeProperty(result.property);
      },
    );

    // DELETE /v1/properties/:id (soft delete)
    typedApp.delete(
      '/v1/properties/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
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
