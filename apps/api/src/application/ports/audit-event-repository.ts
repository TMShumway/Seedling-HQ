export interface AuditEvent {
  id: string;
  tenantId: string;
  principalType: string;
  principalId: string;
  eventName: string;
  subjectType: string;
  subjectId: string;
  correlationId: string;
  createdAt: Date;
}

export interface AuditEventRepository {
  record(event: Omit<AuditEvent, 'createdAt'>): Promise<AuditEvent>;
}
