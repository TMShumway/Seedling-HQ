export type MessageOutboxStatus = 'queued' | 'scheduled' | 'sent' | 'failed';
export type MessageChannel = 'email' | 'sms';

export interface MessageOutbox {
  id: string;
  tenantId: string;
  type: string;
  recipientId: string | null;
  recipientType: string | null;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  status: MessageOutboxStatus;
  provider: string | null;
  providerMessageId: string | null;
  attemptCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  correlationId: string;
  scheduledFor: Date | null;
  createdAt: Date;
  sentAt: Date | null;
}
