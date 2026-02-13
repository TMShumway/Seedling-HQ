export interface UpdateVisitNotesInput {
  tenantId: string;
  callerUserId: string;
  callerRole: string;
  visitId: string;
  notes: string | null;
}

export interface UpdateVisitNotesOutput {
  visit: import('../../domain/entities/visit.js').Visit;
}
