import { randomUUID } from 'node:crypto';
import type { MessageOutboxRepository } from '../ports/message-outbox-repository.js';
import type { SmsSender } from '../ports/sms-sender.js';
import type { EmailSender } from '../ports/email-sender.js';
import type { SmsRecipientPrefsRepository } from '../ports/sms-recipient-prefs-repository.js';
import type { BusinessSettingsRepository } from '../ports/business-settings-repository.js';
import type { ClientRepository } from '../ports/client-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { AppConfig } from '../../shared/config.js';
import type { MessageJobPayload } from '../dto/message-job-payload.js';
import type { MessageOutbox } from '../../domain/entities/message-outbox.js';
import { logger } from '../../shared/logging.js';

const MAX_ATTEMPTS = 3;

export interface MessageJobWorkerDeps {
  outboxRepo: MessageOutboxRepository;
  smsSender: SmsSender;
  emailSender: EmailSender;
  smsPrefsRepo: SmsRecipientPrefsRepository;
  settingsRepo: BusinessSettingsRepository;
  clientRepo: ClientRepository;
  auditRepo: AuditEventRepository;
  config: AppConfig;
}

export class MessageJobWorker {
  private deps: MessageJobWorkerDeps;

  constructor(deps: MessageJobWorkerDeps) {
    this.deps = deps;
  }

  async processJob(payload: MessageJobPayload): Promise<void> {
    const { outboxRepo } = this.deps;

    // 1. Load outbox record
    const outbox = await outboxRepo.getById(payload.outboxId);
    if (!outbox) {
      logger.warn({ outboxId: payload.outboxId }, 'Outbox record not found, skipping');
      return;
    }

    // 2. Tenant mismatch guard
    if (outbox.tenantId !== payload.tenantId) {
      throw new Error(`Tenant mismatch: payload=${payload.tenantId} outbox=${outbox.tenantId}`);
    }

    // 3. Idempotency: already sent
    if (outbox.status === 'sent') {
      logger.info({ outboxId: outbox.id }, 'Outbox already sent, skipping');
      return;
    }

    // 4. Crash recovery: providerMessageId present but status not sent
    if (outbox.providerMessageId) {
      await outboxRepo.updateStatus(outbox.id, 'sent', {
        providerMessageId: outbox.providerMessageId,
        sentAt: new Date(),
      });
      await this.recordAudit(outbox, 'message.sent');
      return;
    }

    // 5. Terminal: max attempts exceeded
    if (outbox.attemptCount >= MAX_ATTEMPTS) {
      await outboxRepo.updateStatus(outbox.id, 'failed', {
        lastErrorCode: 'MAX_ATTEMPTS_EXCEEDED',
        lastErrorMessage: `Exceeded max attempts (${MAX_ATTEMPTS})`,
      });
      return;
    }

    // 6. Route by channel
    if (outbox.channel === 'sms') {
      await this.processSms(outbox);
    } else if (outbox.channel === 'email') {
      await this.processEmail(outbox);
    } else {
      logger.warn({ channel: outbox.channel, outboxId: outbox.id }, 'Unknown channel, skipping');
    }
  }

  private async processSms(outbox: MessageOutbox): Promise<void> {
    const { outboxRepo, smsSender, smsPrefsRepo, config } = this.deps;

    // Resolve destination
    const destination = outbox.destination ?? await this.resolveDestination(outbox);
    if (!destination) {
      await outboxRepo.updateStatus(outbox.id, 'failed', {
        lastErrorCode: 'NO_DESTINATION',
        lastErrorMessage: 'Could not resolve SMS destination',
      });
      return;
    }

    // Opt-out check
    const prefs = await smsPrefsRepo.getByPhone(outbox.tenantId, destination);
    if (prefs?.optedOut) {
      await outboxRepo.updateStatus(outbox.id, 'failed', {
        lastErrorCode: 'RECIPIENT_OPTED_OUT',
        lastErrorMessage: 'Recipient has opted out of SMS',
      });
      return;
    }

    // Send
    try {
      const result = await smsSender.send(destination, outbox.body, config.SMS_ORIGINATION_IDENTITY);
      await outboxRepo.updateStatus(outbox.id, 'sent', {
        provider: config.SMS_PROVIDER,
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      });
      await this.recordAudit(outbox, 'message.sent');
    } catch (err) {
      await outboxRepo.updateStatus(outbox.id, 'queued', {
        lastErrorCode: 'SEND_FAILED',
        lastErrorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async processEmail(outbox: MessageOutbox): Promise<void> {
    const { outboxRepo, emailSender, config } = this.deps;

    const destination = outbox.destination ?? await this.resolveDestination(outbox);
    if (!destination) {
      await outboxRepo.updateStatus(outbox.id, 'failed', {
        lastErrorCode: 'NO_DESTINATION',
        lastErrorMessage: 'Could not resolve email destination',
      });
      return;
    }

    try {
      const result = await emailSender.send({
        from: config.SMTP_FROM,
        to: destination,
        subject: outbox.subject ?? '',
        html: outbox.body,
      });
      await outboxRepo.updateStatus(outbox.id, 'sent', {
        provider: 'smtp',
        providerMessageId: result.messageId,
        sentAt: new Date(),
      });
      await this.recordAudit(outbox, 'message.sent');
    } catch (err) {
      await outboxRepo.updateStatus(outbox.id, 'queued', {
        lastErrorCode: 'SEND_FAILED',
        lastErrorMessage: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private async resolveDestination(outbox: MessageOutbox): Promise<string | null> {
    const { settingsRepo, clientRepo } = this.deps;

    if (outbox.recipientType === 'user') {
      const settings = await settingsRepo.getByTenantId(outbox.tenantId);
      if (outbox.channel === 'sms') return settings?.phone ?? null;
      return null;
    }

    if (outbox.recipientType === 'client' && outbox.recipientId) {
      const client = await clientRepo.getById(outbox.tenantId, outbox.recipientId);
      if (outbox.channel === 'sms') return client?.phone ?? null;
      if (outbox.channel === 'email') return client?.email ?? null;
    }

    return null;
  }

  private async recordAudit(outbox: MessageOutbox, eventName: string): Promise<void> {
    try {
      await this.deps.auditRepo.record({
        id: randomUUID(),
        tenantId: outbox.tenantId,
        principalType: 'system',
        principalId: 'worker',
        eventName,
        subjectType: 'message_outbox',
        subjectId: outbox.id,
        correlationId: outbox.correlationId,
        metadata: {
          channel: outbox.channel,
          type: outbox.type,
        },
      });
    } catch {
      // Best-effort audit — never fail the job for audit
    }
  }
}
