import type { Visit } from '../../domain/entities/visit.js';
import type { VisitStatus } from '../../domain/types/visit-status.js';
import type { Role } from '../../domain/types/roles.js';

export interface TransitionVisitStatusInput {
  tenantId: string;
  callerUserId: string;
  callerRole: Role;
  visitId: string;
  newStatus: VisitStatus;
}

export interface TransitionVisitStatusOutput {
  visit: Visit;
}
