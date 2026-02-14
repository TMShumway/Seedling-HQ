import { loadConfig } from './shared/config.js';
import { createDb } from './infra/db/client.js';
import { createApp } from './app.js';
import { logger } from './shared/logging.js';
import { MessageJobWorker } from './application/usecases/message-job-worker.js';
import { InlineSqsPoller } from './infra/queue/inline-sqs-poller.js';
import { DrizzleMessageOutboxRepository } from './infra/db/repositories/drizzle-message-outbox-repository.js';
import { DrizzleAuditEventRepository } from './infra/db/repositories/drizzle-audit-event-repository.js';
import { DrizzleBusinessSettingsRepository } from './infra/db/repositories/drizzle-business-settings-repository.js';
import { DrizzleClientRepository } from './infra/db/repositories/drizzle-client-repository.js';
import { DrizzleSmsRecipientPrefsRepository } from './infra/db/repositories/drizzle-sms-recipient-prefs-repository.js';
import { NodemailerEmailSender } from './infra/email/nodemailer-email-sender.js';
import { StubSmsSender } from './infra/sms/stub-sms-sender.js';
import { AwsSmsSender } from './infra/sms/aws-sms-sender.js';

async function main() {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);
  const app = await createApp({ config, db });

  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
  logger.info(`API listening on http://localhost:${config.API_PORT}`);

  // Start worker if WORKER_MODE=inline
  let poller: InlineSqsPoller | undefined;
  if (config.WORKER_MODE === 'inline' && config.SQS_MESSAGE_QUEUE_URL) {
    const worker = new MessageJobWorker({
      outboxRepo: new DrizzleMessageOutboxRepository(db),
      smsSender: config.SMS_PROVIDER === 'aws'
        ? new AwsSmsSender(config.S3_REGION)
        : new StubSmsSender(),
      emailSender: new NodemailerEmailSender(config.SMTP_HOST, config.SMTP_PORT),
      smsPrefsRepo: new DrizzleSmsRecipientPrefsRepository(db),
      settingsRepo: new DrizzleBusinessSettingsRepository(db),
      clientRepo: new DrizzleClientRepository(db),
      auditRepo: new DrizzleAuditEventRepository(db),
      config,
    });

    poller = new InlineSqsPoller(
      config.SQS_MESSAGE_QUEUE_URL,
      worker,
      config.SQS_ENDPOINT || undefined,
    );
    poller.start();
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    if (poller) poller.stop();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start API');
  process.exit(1);
});
