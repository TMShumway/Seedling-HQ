import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateTenantUseCase } from '../../../application/usecases/create-tenant.js';
import type { TenantRepository } from '../../../application/ports/tenant-repository.js';
import type { UserRepository } from '../../../application/ports/user-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import { NotFoundError } from '../../../shared/errors.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';

const createTenantBodySchema = z.object({
  businessName: z.string().min(1, 'Business name is required').max(255),
  ownerEmail: z.string().email('Invalid email address').max(255),
  ownerFullName: z.string().min(1, 'Full name is required').max(255),
});

export function buildTenantRoutes(deps: {
  tenantRepo: TenantRepository;
  userRepo: UserRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
}) {
  const useCase = new CreateTenantUseCase(deps.tenantRepo, deps.userRepo, deps.auditRepo);
  const authMiddleware = buildAuthMiddleware(deps.config);

  return async function tenantRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // POST /v1/tenants — unauthenticated signup
    typedApp.post(
      '/v1/tenants',
      {
        schema: {
          body: createTenantBodySchema,
          response: {
            201: z.object({
              tenant: z.object({
                id: z.string(),
                slug: z.string(),
                name: z.string(),
                status: z.string(),
                createdAt: z.string(),
                updatedAt: z.string(),
              }),
              user: z.object({
                id: z.string(),
                tenantId: z.string(),
                email: z.string(),
                fullName: z.string(),
                role: z.string(),
                status: z.string(),
                createdAt: z.string(),
                updatedAt: z.string(),
              }),
            }),
          },
        },
      },
      async (request, reply) => {
        const result = await useCase.execute(request.body, request.correlationId);
        return reply.status(201).send({
          tenant: {
            ...result.tenant,
            createdAt: result.tenant.createdAt.toISOString(),
            updatedAt: result.tenant.updatedAt.toISOString(),
          },
          user: {
            ...result.user,
            createdAt: result.user.createdAt.toISOString(),
            updatedAt: result.user.updatedAt.toISOString(),
          },
        });
      },
    );

    // GET /v1/tenants/me — authenticated
    typedApp.get(
      '/v1/tenants/me',
      { preHandler: authMiddleware },
      async (request) => {
        const tenant = await deps.tenantRepo.getById(request.authContext.tenant_id);
        if (!tenant) {
          throw new NotFoundError('Tenant not found');
        }
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          status: tenant.status,
          createdAt: tenant.createdAt.toISOString(),
          updatedAt: tenant.updatedAt.toISOString(),
        };
      },
    );
  };
}
