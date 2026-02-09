import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Request } from '../../../domain/entities/request.js';
import type { RequestRepository } from '../../../application/ports/request-repository.js';
import type { TenantRepository } from '../../../application/ports/tenant-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import type { UserRepository } from '../../../application/ports/user-repository.js';
import type { MessageOutboxRepository } from '../../../application/ports/message-outbox-repository.js';
import type { EmailSender } from '../../../application/ports/email-sender.js';
import { CreatePublicRequestUseCase } from '../../../application/usecases/create-public-request.js';
import { SendRequestNotificationUseCase } from '../../../application/usecases/send-request-notification.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import { buildRateLimiter } from '../middleware/rate-limit.js';
import type { AppConfig } from '../../../shared/config.js';

const publicRequestBodySchema = z.object({
  clientName: z.string().min(1, 'Name is required').max(255),
  clientEmail: z.string().email().max(255),
  clientPhone: z.string().max(50).nullable().optional(),
  description: z.string().min(1, 'Description is required').max(5000),
  website: z.string().optional(), // honeypot
});

const publicRequestResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  createdAt: z.string(),
});

const requestResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  source: z.string(),
  clientName: z.string(),
  clientEmail: z.string(),
  clientPhone: z.string().nullable(),
  description: z.string(),
  status: z.string(),
  assignedUserId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const paginatedRequestsResponseSchema = z.object({
  data: z.array(requestResponseSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

function serializeRequest(req: Request) {
  return {
    id: req.id,
    tenantId: req.tenantId,
    source: req.source,
    clientName: req.clientName,
    clientEmail: req.clientEmail,
    clientPhone: req.clientPhone,
    description: req.description,
    status: req.status,
    assignedUserId: req.assignedUserId,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
  };
}

export function buildRequestRoutes(deps: {
  requestRepo: RequestRepository;
  tenantRepo: TenantRepository;
  auditRepo: AuditEventRepository;
  userRepo: UserRepository;
  outboxRepo: MessageOutboxRepository;
  emailSender: EmailSender;
  config: AppConfig;
}) {
  const createUseCase = new CreatePublicRequestUseCase(deps.tenantRepo, deps.requestRepo, deps.auditRepo);
  const notificationUseCase = new SendRequestNotificationUseCase(deps.userRepo, deps.outboxRepo, deps.emailSender, deps.config);
  const authMiddleware = buildAuthMiddleware(deps.config);
  const rateLimiter = buildRateLimiter({ windowMs: 60_000, maxRequests: 5 });

  return async function requestRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // ─── Public ──────────────────────────────────────────
    // POST /v1/public/requests/:tenantSlug
    typedApp.post(
      '/v1/public/requests/:tenantSlug',
      {
        preHandler: rateLimiter,
        schema: {
          params: z.object({ tenantSlug: z.string().min(1).max(255) }),
          body: publicRequestBodySchema,
          response: { 201: publicRequestResponseSchema },
        },
      },
      async (request, reply) => {
        const isHoneypot = !!(request.body.website);
        const result = await createUseCase.execute(
          {
            tenantSlug: request.params.tenantSlug,
            clientName: request.body.clientName,
            clientEmail: request.body.clientEmail,
            clientPhone: request.body.clientPhone ?? null,
            description: request.body.description,
            honeypot: request.body.website ?? null,
          },
          request.correlationId,
        );

        // Send notification for real requests (not honeypot)
        if (!isHoneypot && result.request.tenantId) {
          const tenant = await deps.tenantRepo.getBySlug(request.params.tenantSlug);
          if (tenant) {
            await notificationUseCase.execute(
              tenant.id,
              tenant.name,
              result.request,
              request.correlationId,
            );
          }
        }

        return reply.status(201).send({
          id: result.request.id,
          status: result.request.status,
          createdAt: result.request.createdAt.toISOString(),
        });
      },
    );

    // ─── Authenticated ───────────────────────────────────
    // GET /v1/requests
    typedApp.get(
      '/v1/requests',
      {
        preHandler: authMiddleware,
        schema: {
          querystring: z.object({
            limit: z.coerce.number().int().min(1).max(100).optional(),
            cursor: z.string().optional(),
            search: z.string().optional(),
            status: z.string().optional(),
          }),
          response: { 200: paginatedRequestsResponseSchema },
        },
      },
      async (request) => {
        const result = await deps.requestRepo.list(request.authContext.tenant_id, {
          limit: request.query.limit,
          cursor: request.query.cursor,
          search: request.query.search,
          status: request.query.status,
        });
        return {
          data: result.data.map(serializeRequest),
          cursor: result.cursor,
          hasMore: result.hasMore,
        };
      },
    );

    // GET /v1/requests/count
    typedApp.get(
      '/v1/requests/count',
      {
        preHandler: authMiddleware,
        schema: {
          querystring: z.object({
            status: z.string().optional(),
          }),
          response: { 200: z.object({ count: z.number() }) },
        },
      },
      async (request) => {
        const count = request.query.status
          ? await deps.requestRepo.countByStatus(request.authContext.tenant_id, request.query.status)
          : await deps.requestRepo.count(request.authContext.tenant_id);
        return { count };
      },
    );

    // GET /v1/requests/:id
    typedApp.get(
      '/v1/requests/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: requestResponseSchema },
        },
      },
      async (request) => {
        const req = await deps.requestRepo.getById(
          request.authContext.tenant_id,
          request.params.id,
        );
        if (!req) {
          throw new NotFoundError('Request not found');
        }
        return serializeRequest(req);
      },
    );
  };
}
