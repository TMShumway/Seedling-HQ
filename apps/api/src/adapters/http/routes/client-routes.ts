import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Client } from '../../../domain/entities/client.js';
import type { ClientRepository } from '../../../application/ports/client-repository.js';
import type { PropertyRepository } from '../../../application/ports/property-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import { CreateClientUseCase } from '../../../application/usecases/create-client.js';
import { UpdateClientUseCase } from '../../../application/usecases/update-client.js';
import { DeactivateClientUseCase } from '../../../application/usecases/deactivate-client.js';
import { getEventLabel } from '../../../application/dto/timeline-dto.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';

const clientResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const paginatedClientsResponseSchema = z.object({
  data: z.array(clientResponseSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

const createClientBodySchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(255),
  lastName: z.string().min(1, 'Last name is required').max(255),
  email: z.string().email().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  company: z.string().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const updateClientBodySchema = z.object({
  firstName: z.string().min(1).max(255).optional(),
  lastName: z.string().min(1).max(255).optional(),
  email: z.string().email().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  company: z.string().max(255).nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const timelineEventSchema = z.object({
  id: z.string(),
  eventName: z.string(),
  label: z.string(),
  subjectType: z.string(),
  subjectId: z.string(),
  principalId: z.string(),
  createdAt: z.string(),
});

const paginatedTimelineResponseSchema = z.object({
  data: z.array(timelineEventSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

function serializeClient(client: Client) {
  return {
    id: client.id,
    tenantId: client.tenantId,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    company: client.company,
    notes: client.notes,
    tags: client.tags,
    active: client.active,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

export function buildClientRoutes(deps: {
  clientRepo: ClientRepository;
  propertyRepo: PropertyRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
}) {
  const createUseCase = new CreateClientUseCase(deps.clientRepo, deps.auditRepo);
  const updateUseCase = new UpdateClientUseCase(deps.clientRepo, deps.auditRepo);
  const deactivateUseCase = new DeactivateClientUseCase(deps.clientRepo, deps.propertyRepo, deps.auditRepo);
  const authMiddleware = buildAuthMiddleware(deps.config);

  return async function clientRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/clients
    typedApp.get(
      '/v1/clients',
      {
        preHandler: authMiddleware,
        schema: {
          querystring: z.object({
            limit: z.coerce.number().int().min(1).max(100).optional(),
            cursor: z.string().optional(),
            search: z.string().optional(),
            includeInactive: z.enum(['true', 'false']).optional(),
          }),
          response: { 200: paginatedClientsResponseSchema },
        },
      },
      async (request) => {
        const result = await deps.clientRepo.list(request.authContext.tenant_id, {
          limit: request.query.limit,
          cursor: request.query.cursor,
          search: request.query.search,
          includeInactive: request.query.includeInactive === 'true',
        });
        return {
          data: result.data.map(serializeClient),
          cursor: result.cursor,
          hasMore: result.hasMore,
        };
      },
    );

    // POST /v1/clients
    typedApp.post(
      '/v1/clients',
      {
        preHandler: authMiddleware,
        schema: {
          body: createClientBodySchema,
          response: { 201: clientResponseSchema },
        },
      },
      async (request, reply) => {
        const result = await createUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            firstName: request.body.firstName,
            lastName: request.body.lastName,
            email: request.body.email ?? null,
            phone: request.body.phone ?? null,
            company: request.body.company ?? null,
            notes: request.body.notes ?? null,
            tags: request.body.tags ?? [],
          },
          request.correlationId,
        );
        return reply.status(201).send(serializeClient(result.client));
      },
    );

    // GET /v1/clients/count
    typedApp.get(
      '/v1/clients/count',
      {
        preHandler: authMiddleware,
        schema: {
          response: { 200: z.object({ count: z.number() }) },
        },
      },
      async (request) => {
        const count = await deps.clientRepo.count(request.authContext.tenant_id);
        return { count };
      },
    );

    // GET /v1/clients/:id
    typedApp.get(
      '/v1/clients/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: clientResponseSchema },
        },
      },
      async (request) => {
        const client = await deps.clientRepo.getById(
          request.authContext.tenant_id,
          request.params.id,
        );
        if (!client) {
          throw new NotFoundError('Client not found');
        }
        return serializeClient(client);
      },
    );

    // PUT /v1/clients/:id
    typedApp.put(
      '/v1/clients/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: updateClientBodySchema,
          response: { 200: clientResponseSchema },
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
        return serializeClient(result.client);
      },
    );

    // DELETE /v1/clients/:id (soft delete)
    typedApp.delete(
      '/v1/clients/:id',
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

    // GET /v1/clients/:clientId/timeline
    const DEACTIVATION_EVENTS = ['client.deactivated', 'property.deactivated'];

    typedApp.get(
      '/v1/clients/:clientId/timeline',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ clientId: z.string().uuid() }),
          querystring: z.object({
            limit: z.coerce.number().int().min(1).max(100).optional(),
            cursor: z.string().optional(),
            exclude: z.string().optional(),
          }),
          response: { 200: paginatedTimelineResponseSchema },
        },
      },
      async (request) => {
        const { clientId } = request.params;
        const tenantId = request.authContext.tenant_id;

        // Verify client exists and belongs to tenant
        const client = await deps.clientRepo.getById(tenantId, clientId);
        if (!client) {
          throw new NotFoundError('Client not found');
        }

        // Get property IDs for this client
        const clientProperties = await deps.propertyRepo.listByClientId(tenantId, clientId, true);
        const subjectIds = [clientId, ...clientProperties.map((p) => p.id)];

        // Build filters
        const excludeEventNames =
          request.query.exclude === 'deactivated' ? DEACTIVATION_EVENTS : undefined;

        const result = await deps.auditRepo.listBySubjects(tenantId, subjectIds, {
          limit: request.query.limit,
          cursor: request.query.cursor,
          excludeEventNames,
          subjectTypes: ['client', 'property'],
        });

        return {
          data: result.data.map((event) => ({
            id: event.id,
            eventName: event.eventName,
            label: getEventLabel(event.eventName),
            subjectType: event.subjectType,
            subjectId: event.subjectId,
            principalId: event.principalId,
            createdAt: event.createdAt.toISOString(),
          })),
          cursor: result.cursor,
          hasMore: result.hasMore,
        };
      },
    );
  };
}
