import type { MessageOutbox, MessageOutboxStatus } from '../../domain/entities/message-outbox.js';

export interface MessageOutboxRepository {
  getById(id: string): Promise<MessageOutbox | null>;

  create(
    outbox: Omit<MessageOutbox, 'createdAt' | 'sentAt' | 'attemptCount'>,
  ): Promise<MessageOutbox>;

  updateStatus(
    id: string,
    status: MessageOutboxStatus,
    details?: {
      provider?: string;
      providerMessageId?: string;
      lastErrorCode?: string;
      lastErrorMessage?: string;
      sentAt?: Date;
    },
  ): Promise<void>;
}
