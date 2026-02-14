import { randomUUID } from 'node:crypto';
import type { UserRepository } from '../ports/user-repository.js';
import type { MessageOutboxRepository } from '../ports/message-outbox-repository.js';
import type { EmailSender } from '../ports/email-sender.js';
import type { BusinessSettingsRepository } from '../ports/business-settings-repository.js';
import type { MessageQueuePublisher } from '../ports/message-queue-publisher.js';
import type { AppConfig } from '../../shared/config.js';
import type { Request } from '../../domain/entities/request.js';
import { buildRequestNotificationEmail } from '../dto/notification-dto.js';

export class SendRequestNotificationUseCase {
  constructor(
    private userRepo: UserRepository,
    private outboxRepo: MessageOutboxRepository,
    private emailSender: EmailSender,
    private config: AppConfig,
    private settingsRepo?: BusinessSettingsRepository,
    private messageQueuePublisher?: MessageQueuePublisher,
  ) {}

  async execute(
    tenantId: string,
    tenantName: string,
    request: Request,
    correlationId: string,
  ): Promise<void> {
    try {
      if (!this.config.NOTIFICATION_ENABLED) {
        return;
      }

      const owner = await this.userRepo.getOwnerByTenantId(tenantId);
      if (!owner) {
        return;
      }

      const { subject, html } = buildRequestNotificationEmail(request, tenantName);

      // Create email outbox record
      const emailOutboxId = randomUUID();
      await this.outboxRepo.create({
        id: emailOutboxId,
        tenantId,
        type: 'request_notification',
        recipientId: owner.id,
        recipientType: 'user',
        channel: 'email',
        destination: owner.email,
        subject,
        body: html,
        status: 'queued',
        provider: null,
        providerMessageId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        correlationId,
        scheduledFor: null,
      });

      // Try sending email
      try {
        const result = await this.emailSender.send({
          from: this.config.SMTP_FROM,
          to: owner.email,
          subject,
          html,
        });

        await this.outboxRepo.updateStatus(emailOutboxId, 'sent', {
          provider: 'smtp',
          providerMessageId: result.messageId,
          sentAt: new Date(),
        });
      } catch (sendError) {
        await this.outboxRepo.updateStatus(emailOutboxId, 'failed', {
          lastErrorMessage: sendError instanceof Error ? sendError.message : String(sendError),
        });
      }

      // Resolve SMS destination from business settings
      let smsDestination: string | null = null;
      if (this.settingsRepo) {
        const settings = await this.settingsRepo.getByTenantId(tenantId);
        smsDestination = settings?.phone ?? null;
      }

      // Create SMS outbox record and publish to queue for worker processing
      const smsOutboxId = randomUUID();
      await this.outboxRepo.create({
        id: smsOutboxId,
        tenantId,
        type: 'request_notification',
        recipientId: owner.id,
        recipientType: 'user',
        channel: 'sms',
        destination: smsDestination,
        subject: null,
        body: `New request from ${request.clientName}: ${request.description.substring(0, 100)}`,
        status: 'queued',
        provider: null,
        providerMessageId: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        correlationId,
        scheduledFor: null,
      });

      // Publish to queue only if destination is known
      if (smsDestination && this.messageQueuePublisher) {
        await this.messageQueuePublisher.publish({
          jobType: 'sms.send',
          outboxId: smsOutboxId,
          tenantId,
          correlationId,
        });
      }
    } catch {
      // Never throw — notification is best-effort
    }
  }
}
