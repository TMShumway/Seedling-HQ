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
import { DrizzleTenantRepository } from './infra/db/repositories/drizzle-tenant-repository.js';
import { DrizzleUserRepository } from './infra/db/repositories/drizzle-user-repository.js';
import { DrizzleAuditEventRepository } from './infra/db/repositories/drizzle-audit-event-repository.js';

export interface CreateAppOptions {
  config: AppConfig;
  db: Database;
}

export async function createApp({ config, db }: CreateAppOptions) {
  const app = Fastify({ logger: loggerConfig });

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

  // Repositories
  const tenantRepo = new DrizzleTenantRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const auditRepo = new DrizzleAuditEventRepository(db);

  // Routes
  await app.register(healthRoutes);
  await app.register(buildTenantRoutes({ tenantRepo, userRepo, auditRepo, config }));
  await app.register(buildUserRoutes({ userRepo, config }));

  return app;
}
