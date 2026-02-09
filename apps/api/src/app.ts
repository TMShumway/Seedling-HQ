import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { AppConfig } from './shared/config.js';
import type { Database } from './infra/db/client.js';
import { loggerConfig } from './shared/logging.js';
import { registerRequestContext } from './adapters/http/middleware/request-context.js';
import { registerAuthDecorator } from './adapters/http/middleware/auth-middleware.js';
import { errorHandler } from './adapters/http/middleware/error-handler.js';
import { healthRoutes } from './adapters/http/routes/health-routes.js';
import { buildTenantRoutes } from './adapters/http/routes/tenant-routes.js';
import { buildUserRoutes } from './adapters/http/routes/user-routes.js';
import { buildBusinessSettingsRoutes } from './adapters/http/routes/business-settings-routes.js';
import { buildServiceCategoryRoutes } from './adapters/http/routes/service-category-routes.js';
import { buildServiceItemRoutes } from './adapters/http/routes/service-item-routes.js';
import { buildClientRoutes } from './adapters/http/routes/client-routes.js';
import { buildPropertyRoutes } from './adapters/http/routes/property-routes.js';
import { buildRequestRoutes } from './adapters/http/routes/request-routes.js';
import { DrizzleTenantRepository } from './infra/db/repositories/drizzle-tenant-repository.js';
import { DrizzleUserRepository } from './infra/db/repositories/drizzle-user-repository.js';
import { DrizzleAuditEventRepository } from './infra/db/repositories/drizzle-audit-event-repository.js';
import { DrizzleBusinessSettingsRepository } from './infra/db/repositories/drizzle-business-settings-repository.js';
import { DrizzleServiceCategoryRepository } from './infra/db/repositories/drizzle-service-category-repository.js';
import { DrizzleServiceItemRepository } from './infra/db/repositories/drizzle-service-item-repository.js';
import { DrizzleClientRepository } from './infra/db/repositories/drizzle-client-repository.js';
import { DrizzlePropertyRepository } from './infra/db/repositories/drizzle-property-repository.js';
import { DrizzleRequestRepository } from './infra/db/repositories/drizzle-request-repository.js';
import { DrizzleUnitOfWork } from './infra/db/drizzle-unit-of-work.js';

export interface CreateAppOptions {
  config: AppConfig;
  db: Database;
}

export async function createApp({ config, db }: CreateAppOptions) {
  const app = Fastify({ logger: loggerConfig, trustProxy: true });

  // Zod type provider
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Seedling API',
        version: '0.1.0',
        description: 'Seedling-HQ MVP API',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  // Middleware
  registerRequestContext(app);
  registerAuthDecorator(app);
  app.setErrorHandler(errorHandler);

  // Repositories + Unit of Work
  const tenantRepo = new DrizzleTenantRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const auditRepo = new DrizzleAuditEventRepository(db);
  const settingsRepo = new DrizzleBusinessSettingsRepository(db);
  const categoryRepo = new DrizzleServiceCategoryRepository(db);
  const serviceItemRepo = new DrizzleServiceItemRepository(db);
  const clientRepo = new DrizzleClientRepository(db);
  const propertyRepo = new DrizzlePropertyRepository(db);
  const requestRepo = new DrizzleRequestRepository(db);
  const uow = new DrizzleUnitOfWork(db);

  // Routes
  await app.register(healthRoutes);
  await app.register(buildTenantRoutes({ tenantRepo, uow, config }));
  await app.register(buildUserRoutes({ userRepo, config }));
  await app.register(buildBusinessSettingsRoutes({ settingsRepo, auditRepo, config }));
  await app.register(buildServiceCategoryRoutes({ categoryRepo, serviceItemRepo, auditRepo, config }));
  await app.register(buildServiceItemRoutes({ serviceItemRepo, categoryRepo, auditRepo, config }));
  await app.register(buildClientRoutes({ clientRepo, propertyRepo, auditRepo, config }));
  await app.register(buildPropertyRoutes({ propertyRepo, clientRepo, auditRepo, config }));
  await app.register(buildRequestRoutes({ requestRepo, tenantRepo, auditRepo, config }));

  return app;
}
