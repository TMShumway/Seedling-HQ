import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { BusinessSettingsRepository } from '../../../application/ports/business-settings-repository.js';
import type { AuditEventRepository } from '../../../application/ports/audit-event-repository.js';
import { UpsertBusinessSettingsUseCase } from '../../../application/usecases/upsert-business-settings.js';
import { GetBusinessSettingsUseCase } from '../../../application/usecases/get-business-settings.js';
import { buildAuthMiddleware } from '../middleware/auth-middleware.js';
import type { AppConfig } from '../../../shared/config.js';

const dayScheduleSchema = z.object({
  open: z.string().nullable(),
  close: z.string().nullable(),
  closed: z.boolean(),
});

const businessHoursSchema = z.object({
  monday: dayScheduleSchema,
  tuesday: dayScheduleSchema,
  wednesday: dayScheduleSchema,
  thursday: dayScheduleSchema,
  friday: dayScheduleSchema,
  saturday: dayScheduleSchema,
  sunday: dayScheduleSchema,
});

const upsertBodySchema = z.object({
  phone: z.string().max(50).nullable(),
  addressLine1: z.string().max(255).nullable(),
  addressLine2: z.string().max(255).nullable(),
  city: z.string().max(255).nullable(),
  state: z.string().max(50).nullable(),
  zip: z.string().max(20).nullable(),
  timezone: z.string().max(100).nullable(),
  businessHours: businessHoursSchema.nullable(),
  serviceArea: z.string().max(1000).nullable(),
  defaultDurationMinutes: z.number().int().min(15).max(480).nullable(),
  description: z.string().max(2000).nullable(),
});

const settingsResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  phone: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  timezone: z.string().nullable(),
  businessHours: businessHoursSchema.nullable(),
  serviceArea: z.string().nullable(),
  defaultDurationMinutes: z.number().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export function buildBusinessSettingsRoutes(deps: {
  settingsRepo: BusinessSettingsRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
}) {
  const upsertUseCase = new UpsertBusinessSettingsUseCase(deps.settingsRepo, deps.auditRepo);
  const getUseCase = new GetBusinessSettingsUseCase(deps.settingsRepo);
  const authMiddleware = buildAuthMiddleware(deps.config);

  return async function businessSettingsRoutes(app: FastifyInstance) {
    const typedApp = app.withTypeProvider<ZodTypeProvider>();

    // GET /v1/tenants/me/settings — returns settings or null
    typedApp.get(
      '/v1/tenants/me/settings',
      {
        preHandler: authMiddleware,
        schema: {
          response: {
            200: settingsResponseSchema.nullable(),
          },
        },
      },
      async (request) => {
        const settings = await getUseCase.execute(request.authContext.tenant_id);
        if (!settings) {
          return null;
        }
        return {
          ...settings,
          createdAt: settings.createdAt.toISOString(),
          updatedAt: settings.updatedAt.toISOString(),
        };
      },
    );

    // PUT /v1/tenants/me/settings — upsert settings
    typedApp.put(
      '/v1/tenants/me/settings',
      {
        preHandler: authMiddleware,
        schema: {
          body: upsertBodySchema,
          response: {
            200: settingsResponseSchema,
          },
        },
      },
      async (request) => {
        const result = await upsertUseCase.execute(
          {
            tenantId: request.authContext.tenant_id,
            userId: request.authContext.user_id,
            ...request.body,
          },
          request.correlationId,
        );
        return {
          ...result.settings,
          createdAt: result.settings.createdAt.toISOString(),
          updatedAt: result.settings.updatedAt.toISOString(),
        };
      },
    );
  };
}
