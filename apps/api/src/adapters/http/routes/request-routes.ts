import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Request } from '../../../domain/entities/request.js';
import type { RequestRepository } from '../../../application/ports/request-repository.js';
import type { TenantRepository } from '../../../application/ports/tenant-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import type { UserRepository } from '../../../application/ports/user-repository.js';
import type { MessageOutboxRepository } from '../../../application/ports/message-outbox-repository.js';
import type { ClientRepository } from '../../../application/ports/client-repository.js';
import type { EmailSender } from '../../../application/ports/email-sender.js';
import type { UnitOfWork } from '../../../application/ports/unit-of-work.js';
import type { Client } from '../../../domain/entities/client.js';
import type { Property } from '../../../domain/entities/property.js';
import type { Quote, QuoteLineItem } from '../../../domain/entities/quote.js';
import { CreatePublicRequestUseCase } from '../../../application/usecases/create-public-request.js';
import { SendRequestNotificationUseCase } from '../../../application/usecases/send-request-notification.js';
import { ConvertRequestUseCase } from '../../../application/usecases/convert-request.js';
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

function serializeClient(c: Client) {
  return {
    id: c.id,
    tenantId: c.tenantId,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    company: c.company,
    notes: c.notes,
    tags: c.tags,
    active: c.active,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

function serializeProperty(p: Property) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    clientId: p.clientId,
    addressLine1: p.addressLine1,
    addressLine2: p.addressLine2,
    city: p.city,
    state: p.state,
    zip: p.zip,
    notes: p.notes,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeQuote(q: Quote) {
  return {
    id: q.id,
    tenantId: q.tenantId,
    requestId: q.requestId,
    clientId: q.clientId,
    propertyId: q.propertyId,
    title: q.title,
    lineItems: q.lineItems as QuoteLineItem[],
    subtotal: q.subtotal,
    tax: q.tax,
    total: q.total,
    status: q.status,
    sentAt: q.sentAt?.toISOString() ?? null,
    approvedAt: q.approvedAt?.toISOString() ?? null,
    declinedAt: q.declinedAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

const convertRequestBodySchema = z.object({
  existingClientId: z.string().uuid().optional(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().max(255).optional().default(''),
  email: z.string().email().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  company: z.string().max(255).nullable().optional(),
  addressLine1: z.string().min(1).max(255),
  addressLine2: z.string().max(255).nullable().optional(),
  city: z.string().max(255).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  quoteTitle: z.string().min(1).max(500),
});

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

const quoteResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  requestId: z.string().nullable(),
  clientId: z.string(),
  propertyId: z.string().nullable(),
  title: z.string(),
  lineItems: z.array(z.any()),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  status: z.string(),
  sentAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  declinedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const convertResponseSchema = z.object({
  request: requestResponseSchema,
  client: clientResponseSchema,
  property: propertyResponseSchema,
  quote: quoteResponseSchema,
  clientCreated: z.boolean(),
});

export function buildRequestRoutes(deps: {
  requestRepo: RequestRepository;
  tenantRepo: TenantRepository;
  auditRepo: AuditEventRepository;
  userRepo: UserRepository;
  outboxRepo: MessageOutboxRepository;
  emailSender: EmailSender;
  clientRepo: ClientRepository;
  uow: UnitOfWork;
  config: AppConfig;
}) {
  const createUseCase = new CreatePublicRequestUseCase(deps.tenantRepo, deps.requestRepo, deps.auditRepo);
  const notificationUseCase = new SendRequestNotificationUseCase(deps.userRepo, deps.outboxRepo, deps.emailSender, deps.config);
  const convertUseCase = new ConvertRequestUseCase(deps.requestRepo, deps.clientRepo, deps.uow);
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

    // POST /v1/requests/:id/convert
    typedApp.post(
      '/v1/requests/:id/convert',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: convertRequestBodySchema,
          response: { 200: convertResponseSchema },
        },
      },
      async (request, reply) => {
        const result = await convertUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            requestId: request.params.id,
            existingClientId: request.body.existingClientId,
            firstName: request.body.firstName,
            lastName: request.body.lastName,
            email: request.body.email ?? null,
            phone: request.body.phone ?? null,
            company: request.body.company ?? null,
            addressLine1: request.body.addressLine1,
            addressLine2: request.body.addressLine2 ?? null,
            city: request.body.city ?? null,
            state: request.body.state ?? null,
            zip: request.body.zip ?? null,
            quoteTitle: request.body.quoteTitle,
          },
          request.correlationId,
        );

        return reply.status(200).send({
          request: serializeRequest(result.request),
          client: serializeClient(result.client),
          property: serializeProperty(result.property),
          quote: serializeQuote(result.quote),
          clientCreated: result.clientCreated,
        });
      },
    );
  };
}
