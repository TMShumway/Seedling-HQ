import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Quote, QuoteLineItem } from '../../../domain/entities/quote.js';
import type { QuoteRepository } from '../../../application/ports/quote-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import type { UnitOfWork } from '../../../application/ports/unit-of-work.js';
import type { EmailSender } from '../../../application/ports/email-sender.js';
import type { MessageOutboxRepository } from '../../../application/ports/message-outbox-repository.js';
import type { ClientRepository } from '../../../application/ports/client-repository.js';
import type { PropertyRepository } from '../../../application/ports/property-repository.js';
import { CreateStandaloneQuoteUseCase } from '../../../application/usecases/create-quote.js';
import { UpdateQuoteUseCase } from '../../../application/usecases/update-quote.js';
import { SendQuoteUseCase } from '../../../application/usecases/send-quote.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';

const quoteLineItemSchema = z.object({
  serviceItemId: z.string().uuid().nullable().optional(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number().int(),
  total: z.number().int(),
});

const quoteResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  requestId: z.string().nullable(),
  clientId: z.string(),
  propertyId: z.string().nullable(),
  title: z.string(),
  lineItems: z.array(quoteLineItemSchema),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  status: z.string(),
  sentAt: z.string().nullable(),
  approvedAt: z.string().nullable(),
  declinedAt: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const paginatedQuotesResponseSchema = z.object({
  data: z.array(quoteResponseSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

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
    scheduledAt: q.scheduledAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

const updateQuoteBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  lineItems: z.array(z.object({
    serviceItemId: z.string().uuid().nullable().optional(),
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().int().min(0),
  })).optional(),
  tax: z.number().int().min(0).optional(),
});

export function buildQuoteRoutes(deps: {
  quoteRepo: QuoteRepository;
  auditRepo: AuditEventRepository;
  uow: UnitOfWork;
  emailSender: EmailSender;
  outboxRepo: MessageOutboxRepository;
  clientRepo: ClientRepository;
  propertyRepo: PropertyRepository;
  config: AppConfig;
  jwtVerifier?: JwtVerifier;
}) {
  const createUseCase = new CreateStandaloneQuoteUseCase(deps.quoteRepo, deps.clientRepo, deps.propertyRepo, deps.auditRepo);
  const updateUseCase = new UpdateQuoteUseCase(deps.quoteRepo, deps.auditRepo);
  const sendUseCase = new SendQuoteUseCase(
    deps.quoteRepo, deps.uow, deps.emailSender, deps.outboxRepo, deps.clientRepo, deps.config,
  );
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  return async function quoteRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/quotes
    typedApp.get(
      '/v1/quotes',
      {
        preHandler: authMiddleware,
        schema: {
          querystring: z.object({
            limit: z.coerce.number().int().min(1).max(100).optional(),
            cursor: z.string().optional(),
            search: z.string().optional(),
            status: z.string().optional(),
          }),
          response: { 200: paginatedQuotesResponseSchema },
        },
      },
      async (request) => {
        const result = await deps.quoteRepo.list(request.authContext.tenant_id, {
          limit: request.query.limit,
          cursor: request.query.cursor,
          search: request.query.search,
          status: request.query.status,
        });
        return {
          data: result.data.map(serializeQuote),
          cursor: result.cursor,
          hasMore: result.hasMore,
        };
      },
    );

    // GET /v1/quotes/count — must register BEFORE /:id
    typedApp.get(
      '/v1/quotes/count',
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
          ? await deps.quoteRepo.countByStatus(request.authContext.tenant_id, request.query.status)
          : await deps.quoteRepo.count(request.authContext.tenant_id);
        return { count };
      },
    );

    // POST /v1/quotes — create standalone quote
    typedApp.post(
      '/v1/quotes',
      {
        preHandler: authMiddleware,
        schema: {
          body: z.object({
            clientId: z.string().uuid(),
            propertyId: z.string().uuid().nullish(),
            title: z.string().min(1).max(500),
          }),
          response: { 201: quoteResponseSchema },
        },
      },
      async (request, reply) => {
        const result = await createUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            clientId: request.body.clientId,
            propertyId: request.body.propertyId ?? undefined,
            title: request.body.title,
          },
          request.correlationId,
        );
        return reply.status(201).send(serializeQuote(result.quote));
      },
    );

    // POST /v1/quotes/:id/send — must register BEFORE /:id
    typedApp.post(
      '/v1/quotes/:id/send',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: z.object({
            expiresInDays: z.number().int().min(1).max(90).optional(),
          }).nullish(),
        },
      },
      async (request) => {
        const result = await sendUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            quoteId: request.params.id,
            expiresInDays: request.body?.expiresInDays,
          },
          request.correlationId,
        );
        return {
          quote: serializeQuote(result.quote),
          token: result.token,
          link: result.link,
        };
      },
    );

    // GET /v1/quotes/:id
    typedApp.get(
      '/v1/quotes/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: quoteResponseSchema },
        },
      },
      async (request) => {
        const quote = await deps.quoteRepo.getById(
          request.authContext.tenant_id,
          request.params.id,
        );
        if (!quote) {
          throw new NotFoundError('Quote not found');
        }
        return serializeQuote(quote);
      },
    );

    // PUT /v1/quotes/:id
    typedApp.put(
      '/v1/quotes/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: updateQuoteBodySchema,
          response: { 200: quoteResponseSchema },
        },
      },
      async (request) => {
        const result = await updateUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            id: request.params.id,
            title: request.body.title,
            lineItems: request.body.lineItems?.map((item) => ({
              serviceItemId: item.serviceItemId ?? null,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: 0, // computed by use case
            })),
            tax: request.body.tax,
          },
          request.correlationId,
        );
        return serializeQuote(result.quote);
      },
    );
  };
}
