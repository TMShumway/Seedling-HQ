export interface MessageJobPayload {
  jobType: 'sms.send';
  outboxId: string;
  tenantId: string;
  correlationId: string;
}
