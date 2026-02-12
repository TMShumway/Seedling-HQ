import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { VisitRepository, VisitWithContext } from '../../../application/ports/visit-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import { ScheduleVisitUseCase } from '../../../application/usecases/schedule-visit.js';
import { ValidationError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';
import type { JwtVerifier } from '../../../application/ports/jwt-verifier.js';
import type { Visit } from '../../../domain/entities/visit.js';

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

const visitWithContextResponseSchema = visitResponseSchema.extend({
  jobTitle: z.string(),
  clientName: z.string(),
  propertyAddress: z.string().nullable(),
});

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

function serializeVisitWithContext(v: VisitWithContext) {
  return {
    ...serializeVisit(v),
    jobTitle: v.jobTitle,
    clientName: `${v.clientFirstName} ${v.clientLastName}`,
    propertyAddress: v.propertyAddressLine1,
  };
}

const MAX_RANGE_MS = 8 * 24 * 60 * 60 * 1000; // 8 days

export function buildVisitRoutes(deps: {
  visitRepo: VisitRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
  jwtVerifier?: JwtVerifier;
}) {
  const scheduleUseCase = new ScheduleVisitUseCase(deps.visitRepo, deps.auditRepo);
  const authMiddleware = buildAuthMiddleware({ config: deps.config, jwtVerifier: deps.jwtVerifier });

  return async function visitRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/visits/unscheduled — must register BEFORE :id routes
    typedApp.get(
      '/v1/visits/unscheduled',
      {
        preHandler: authMiddleware,
        schema: {
          response: {
            200: z.object({ data: z.array(visitWithContextResponseSchema) }),
          },
        },
      },
      async (request) => {
        const data = await deps.visitRepo.listUnscheduled(request.authContext.tenant_id);
        return { data: data.map(serializeVisitWithContext) };
      },
    );

    // GET /v1/visits — date range query
    typedApp.get(
      '/v1/visits',
      {
        preHandler: authMiddleware,
        schema: {
          querystring: z.object({
            from: z.string().datetime({ offset: true }),
            to: z.string().datetime({ offset: true }),
            status: z.string().optional(),
          }),
          response: {
            200: z.object({ data: z.array(visitWithContextResponseSchema) }),
          },
        },
      },
      async (request) => {
        const from = new Date(request.query.from);
        const to = new Date(request.query.to);

        if (from >= to) {
          throw new ValidationError('"from" must be before "to"');
        }

        if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
          throw new ValidationError('Date range must not exceed 8 days');
        }

        const data = await deps.visitRepo.listByDateRange(
          request.authContext.tenant_id,
          from,
          to,
          request.query.status ? { status: request.query.status } : undefined,
        );
        return { data: data.map(serializeVisitWithContext) };
      },
    );

    // PATCH /v1/visits/:id/schedule
    typedApp.patch(
      '/v1/visits/:id/schedule',
      {
        preHandler: authMiddleware,
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: z.object({
            scheduledStart: z.string().datetime({ offset: true }),
            scheduledEnd: z.string().datetime({ offset: true }).optional(),
          }),
          response: {
            200: z.object({ visit: visitResponseSchema }),
          },
        },
      },
      async (request) => {
        const result = await scheduleUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            visitId: request.params.id,
            scheduledStart: new Date(request.body.scheduledStart),
            scheduledEnd: request.body.scheduledEnd ? new Date(request.body.scheduledEnd) : undefined,
          },
          request.correlationId,
        );
        return { visit: serializeVisit(result.visit) };
      },
    );
  };
}
