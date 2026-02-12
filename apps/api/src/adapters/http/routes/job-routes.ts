import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Job } from '../../../domain/entities/job.js';
import type { Visit } from '../../../domain/entities/visit.js';
import type { JobRepository } from '../../../application/ports/job-repository.js';
import type { VisitRepository } from '../../../application/ports/visit-repository.js';
import type { QuoteRepository } from '../../../application/ports/quote-repository.js';
import type { ServiceItemRepository } from '../../../application/ports/service-item-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import type { UnitOfWork } from '../../../application/ports/unit-of-work.js';
import { CreateJobFromQuoteUseCase } from '../../../application/usecases/create-job-from-quote.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';

const visitResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  jobId: z.string(),
  assignedUserId: z.string().nullable(),
  scheduledStart: z.string().nullable(),
  scheduledEnd: z.string().nullable(),
  estimatedDurationMinutes: z.number(),
  status: z.string(),
  notes: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const jobResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  quoteId: z.string(),
  clientId: z.string(),
  propertyId: z.string().nullable(),
  title: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const jobWithVisitsResponseSchema = jobResponseSchema.extend({
  visits: z.array(visitResponseSchema),
});

const paginatedJobsResponseSchema = z.object({
  data: z.array(jobResponseSchema),
  cursor: z.string().nullable(),
  hasMore: z.boolean(),
});

function serializeJob(j: Job) {
  return {
    id: j.id,
    tenantId: j.tenantId,
    quoteId: j.quoteId,
    clientId: j.clientId,
    propertyId: j.propertyId,
    title: j.title,
    status: j.status,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

function serializeVisit(v: Visit) {
  return {
    id: v.id,
    tenantId: v.tenantId,
    jobId: v.jobId,
    assignedUserId: v.assignedUserId,
    scheduledStart: v.scheduledStart?.toISOString() ?? null,
    scheduledEnd: v.scheduledEnd?.toISOString() ?? null,
    estimatedDurationMinutes: v.estimatedDurationMinutes,
    status: v.status,
    notes: v.notes,
    completedAt: v.completedAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

export function buildJobRoutes(deps: {
  jobRepo: JobRepository;
  visitRepo: VisitRepository;
  quoteRepo: QuoteRepository;
  serviceItemRepo: ServiceItemRepository;
  auditRepo: AuditEventRepository;
  uow: UnitOfWork;
  config: AppConfig;
  jwtVerifier?: JwtVerifier;
}) {
  const createUseCase = new CreateJobFromQuoteUseCase(
    deps.quoteRepo, deps.jobRepo, deps.visitRepo, deps.serviceItemRepo, deps.uow,
  );
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  return async function jobRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/jobs
    typedApp.get(
      '/v1/jobs',
      {
        preHandler: authMiddleware,
        schema: {
          querystring: z.object({
            limit: z.coerce.number().int().min(1).max(100).optional(),
            cursor: z.string().optional(),
            search: z.string().optional(),
            status: z.string().optional(),
          }),
          response: { 200: paginatedJobsResponseSchema },
        },
      },
      async (request) => {
        const result = await deps.jobRepo.list(request.authContext.tenant_id, {
          limit: request.query.limit,
          cursor: request.query.cursor,
          search: request.query.search,
          status: request.query.status,
        });
        return {
          data: result.data.map(serializeJob),
          cursor: result.cursor,
          hasMore: result.hasMore,
        };
      },
    );

    // GET /v1/jobs/count — must register BEFORE by-quote and :id
    typedApp.get(
      '/v1/jobs/count',
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
          ? await deps.jobRepo.countByStatus(request.authContext.tenant_id, request.query.status)
          : await deps.jobRepo.count(request.authContext.tenant_id);
        return { count };
      },
    );

    // GET /v1/jobs/by-quote/:quoteId — must register BEFORE :id
    typedApp.get(
      '/v1/jobs/by-quote/:quoteId',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ quoteId: z.string().uuid() }),
          response: { 200: jobWithVisitsResponseSchema },
        },
      },
      async (request) => {
        const job = await deps.jobRepo.getByQuoteId(
          request.authContext.tenant_id,
          request.params.quoteId,
        );
        if (!job) {
          throw new NotFoundError('Job not found for this quote');
        }
        const visits = await deps.visitRepo.listByJobId(request.authContext.tenant_id, job.id);
        return {
          ...serializeJob(job),
          visits: visits.map(serializeVisit),
        };
      },
    );

    // POST /v1/jobs
    typedApp.post(
      '/v1/jobs',
      {
        preHandler: authMiddleware,
        schema: {
          body: z.object({
            quoteId: z.string().uuid(),
          }),
          response: {
            200: z.object({
              job: jobResponseSchema,
              visit: visitResponseSchema,
              suggestedDurationMinutes: z.number(),
              alreadyExisted: z.boolean(),
            }),
          },
        },
      },
      async (request) => {
        const result = await createUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            quoteId: request.body.quoteId,
          },
          request.correlationId,
        );
        return {
          job: serializeJob(result.job),
          visit: serializeVisit(result.visit),
          suggestedDurationMinutes: result.suggestedDurationMinutes,
          alreadyExisted: result.alreadyExisted,
        };
      },
    );

    // GET /v1/jobs/:id
    typedApp.get(
      '/v1/jobs/:id',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: jobWithVisitsResponseSchema },
        },
      },
      async (request) => {
        const job = await deps.jobRepo.getById(
          request.authContext.tenant_id,
          request.params.id,
        );
        if (!job) {
          throw new NotFoundError('Job not found');
        }
        const visits = await deps.visitRepo.listByJobId(request.authContext.tenant_id, job.id);
        return {
          ...serializeJob(job),
          visits: visits.map(serializeVisit),
        };
      },
    );
  };
}
