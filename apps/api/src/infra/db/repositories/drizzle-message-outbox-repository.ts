import { eq, sql } from 'drizzle-orm';
import type { MessageOutboxRepository } from '../../../application/ports/message-outbox-repository.js';
import type { MessageOutbox, MessageOutboxStatus, MessageChannel } from '../../../domain/entities/message-outbox.js';
import type { Database } from '../client.js';
import { messageOutbox } from '../schema.js';

function toEntity(row: typeof messageOutbox.$inferSelect): MessageOutbox {
  return {
    id: row.id,
    tenantId: row.tenantId,
    type: row.type,
    recipientId: row.recipientId,
    recipientType: row.recipientType,
    channel: row.channel as MessageChannel,
    subject: row.subject,
    body: row.body,
    status: row.status as MessageOutboxStatus,
    provider: row.provider,
    providerMessageId: row.providerMessageId,
    attemptCount: row.attemptCount,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    correlationId: row.correlationId,
    scheduledFor: row.scheduledFor,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
  };
}

export class DrizzleMessageOutboxRepository implements MessageOutboxRepository {
  constructor(private db: Database) {}

  async create(
    outbox: Omit<MessageOutbox, 'createdAt' | 'sentAt' | 'attemptCount'>,
  ): Promise<MessageOutbox> {
    const [row] = await this.db
      .insert(messageOutbox)
      .values({
        id: outbox.id,
        tenantId: outbox.tenantId,
        type: outbox.type,
        recipientId: outbox.recipientId,
        recipientType: outbox.recipientType,
        channel: outbox.channel,
        subject: outbox.subject,
        body: outbox.body,
        status: outbox.status,
        provider: outbox.provider,
        providerMessageId: outbox.providerMessageId,
        lastErrorCode: outbox.lastErrorCode,
        lastErrorMessage: outbox.lastErrorMessage,
        correlationId: outbox.correlationId,
        scheduledFor: outbox.scheduledFor,
      })
      .returning();
    return toEntity(row);
  }

  async updateStatus(
    id: string,
    status: MessageOutboxStatus,
    details?: {
      provider?: string;
      providerMessageId?: string;
      lastErrorCode?: string;
      lastErrorMessage?: string;
      sentAt?: Date;
    },
  ): Promise<void> {
    await this.db
      .update(messageOutbox)
      .set({
        status,
        attemptCount: sql`${messageOutbox.attemptCount} + 1`,
        ...(details?.provider !== undefined && { provider: details.provider }),
        ...(details?.providerMessageId !== undefined && { providerMessageId: details.providerMessageId }),
        ...(details?.lastErrorCode !== undefined && { lastErrorCode: details.lastErrorCode }),
        ...(details?.lastErrorMessage !== undefined && { lastErrorMessage: details.lastErrorMessage }),
        ...(details?.sentAt !== undefined && { sentAt: details.sentAt }),
      })
      .where(eq(messageOutbox.id, id));
  }
}
