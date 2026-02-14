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
import type { JwtVerifier } from './application/ports/jwt-verifier.js';
import { CognitoJwtVerifier } from './infra/auth/cognito-jwt-verifier.js';
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
import { buildQuoteRoutes } from './adapters/http/routes/quote-routes.js';
import { buildExternalQuoteRoutes } from './adapters/http/routes/external-quote-routes.js';
import { buildAuthRoutes } from './adapters/http/routes/auth-routes.js';
import { buildJobRoutes } from './adapters/http/routes/job-routes.js';
import { buildVisitRoutes } from './adapters/http/routes/visit-routes.js';
import { buildVisitPhotoRoutes } from './adapters/http/routes/visit-photo-routes.js';
import { DrizzleSecureLinkTokenRepository } from './infra/db/repositories/drizzle-secure-link-token-repository.js';
import type { ExternalAuthContext } from './adapters/http/middleware/external-token-middleware.js';
import { DrizzleTenantRepository } from './infra/db/repositories/drizzle-tenant-repository.js';
import { DrizzleUserRepository } from './infra/db/repositories/drizzle-user-repository.js';
import { DrizzleAuditEventRepository } from './infra/db/repositories/drizzle-audit-event-repository.js';
import { DrizzleBusinessSettingsRepository } from './infra/db/repositories/drizzle-business-settings-repository.js';
import { DrizzleServiceCategoryRepository } from './infra/db/repositories/drizzle-service-category-repository.js';
import { DrizzleServiceItemRepository } from './infra/db/repositories/drizzle-service-item-repository.js';
import { DrizzleClientRepository } from './infra/db/repositories/drizzle-client-repository.js';
import { DrizzlePropertyRepository } from './infra/db/repositories/drizzle-property-repository.js';
import { DrizzleRequestRepository } from './infra/db/repositories/drizzle-request-repository.js';
import { DrizzleQuoteRepository } from './infra/db/repositories/drizzle-quote-repository.js';
import { DrizzleMessageOutboxRepository } from './infra/db/repositories/drizzle-message-outbox-repository.js';
import { DrizzleJobRepository } from './infra/db/repositories/drizzle-job-repository.js';
import { DrizzleVisitRepository } from './infra/db/repositories/drizzle-visit-repository.js';
import { DrizzleUnitOfWork } from './infra/db/drizzle-unit-of-work.js';
import { NodemailerEmailSender } from './infra/email/nodemailer-email-sender.js';
import { AwsCognitoProvisioner } from './infra/auth/aws-cognito-provisioner.js';
import type { CognitoProvisioner } from './application/ports/cognito-provisioner.js';
import type { FileStorage } from './application/ports/file-storage.js';
import type { MessageQueuePublisher } from './application/ports/message-queue-publisher.js';
import { S3FileStorage } from './infra/storage/s3-file-storage.js';
import { DrizzleVisitPhotoRepository } from './infra/db/repositories/drizzle-visit-photo-repository.js';
import { DrizzleSmsRecipientPrefsRepository } from './infra/db/repositories/drizzle-sms-recipient-prefs-repository.js';
import { StubSmsSender } from './infra/sms/stub-sms-sender.js';
import { AwsSmsSender } from './infra/sms/aws-sms-sender.js';
import { SqsMessageQueuePublisher } from './infra/queue/sqs-message-queue-publisher.js';
import { NoopMessageQueuePublisher } from './infra/queue/noop-message-queue-publisher.js';

export interface CreateAppOptions {
  config: AppConfig;
  db: Database;
  jwtVerifier?: JwtVerifier;
  fileStorage?: FileStorage;
}

export async function createApp({ config, db, jwtVerifier: jwtVerifierOverride, fileStorage: fileStorageOverride }: CreateAppOptions) {
  // Fail fast: create Cognito JWT verifier at startup when AUTH_MODE=cognito
  let jwtVerifier: JwtVerifier | undefined = jwtVerifierOverride;
  if (config.AUTH_MODE === 'cognito' && !jwtVerifier) {
    jwtVerifier = new CognitoJwtVerifier(config);
  }

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
  const quoteRepo = new DrizzleQuoteRepository(db);
  const outboxRepo = new DrizzleMessageOutboxRepository(db);
  const secureLinkTokenRepo = new DrizzleSecureLinkTokenRepository(db);
  const jobRepo = new DrizzleJobRepository(db);
  const visitRepo = new DrizzleVisitRepository(db);
  const uow = new DrizzleUnitOfWork(db);
  const smsRecipientPrefsRepo = new DrizzleSmsRecipientPrefsRepository(db);
  const emailSender = new NodemailerEmailSender(config.SMTP_HOST, config.SMTP_PORT);
  const smsSender = config.SMS_PROVIDER === 'aws'
    ? new AwsSmsSender(config.SMS_REGION)
    : new StubSmsSender();
  const messageQueuePublisher: MessageQueuePublisher = config.SQS_MESSAGE_QUEUE_URL
    ? new SqsMessageQueuePublisher(config.SQS_MESSAGE_QUEUE_URL, config.SQS_REGION, config.SQS_ENDPOINT || undefined)
    : new NoopMessageQueuePublisher();

  // File storage (S3 / LocalStack)
  const fileStorage = fileStorageOverride ?? new S3FileStorage({
    bucket: config.S3_BUCKET,
    region: config.S3_REGION,
    ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
  });
  const visitPhotoRepo = new DrizzleVisitPhotoRepository(db);

  // Cognito provisioner (only created when AUTH_MODE=cognito)
  let cognitoProvisioner: CognitoProvisioner | undefined;
  if (config.AUTH_MODE === 'cognito') {
    cognitoProvisioner = new AwsCognitoProvisioner(config);
  }

  // Decorator for external auth context (secure link tokens)
  app.decorateRequest('externalAuthContext', null);

  // Routes
  await app.register(healthRoutes);
  await app.register(buildTenantRoutes({ tenantRepo, uow, config, jwtVerifier }));
  await app.register(buildUserRoutes({ userRepo, auditRepo, uow, config, jwtVerifier, cognitoProvisioner }));
  await app.register(buildBusinessSettingsRoutes({ settingsRepo, auditRepo, config, jwtVerifier }));
  await app.register(buildServiceCategoryRoutes({ categoryRepo, serviceItemRepo, auditRepo, config, jwtVerifier }));
  await app.register(buildServiceItemRoutes({ serviceItemRepo, categoryRepo, auditRepo, config, jwtVerifier }));
  await app.register(buildClientRoutes({ clientRepo, propertyRepo, auditRepo, config, jwtVerifier }));
  await app.register(buildPropertyRoutes({ propertyRepo, clientRepo, auditRepo, config, jwtVerifier }));
  await app.register(buildRequestRoutes({ requestRepo, tenantRepo, auditRepo, userRepo, outboxRepo, emailSender, clientRepo, uow, config, jwtVerifier, settingsRepo, messageQueuePublisher }));
  await app.register(buildQuoteRoutes({ quoteRepo, auditRepo, uow, emailSender, outboxRepo, clientRepo, propertyRepo, config, jwtVerifier }));
  await app.register(buildExternalQuoteRoutes({ secureLinkTokenRepo, quoteRepo, clientRepo, tenantRepo, propertyRepo, auditRepo, userRepo, outboxRepo, emailSender, config }));
  await app.register(buildJobRoutes({ jobRepo, visitRepo, quoteRepo, serviceItemRepo, auditRepo, uow, config, jwtVerifier }));
  await app.register(buildVisitRoutes({ visitRepo, jobRepo, userRepo, auditRepo, config, jwtVerifier }));
  await app.register(buildVisitPhotoRoutes({ visitPhotoRepo, visitRepo, fileStorage, auditRepo, config, jwtVerifier }));
  await app.register(buildAuthRoutes({ userRepo, config }));

  return app;
}
