import type { Visit } from '../../domain/entities/visit.js';
import type { Role } from '../../domain/types/roles.js';

export interface AssignVisitInput {
  tenantId: string;
  callerUserId: string;
  callerRole: Role;
  visitId: string;
  assignedUserId: string | null;
}

export interface AssignVisitOutput {
  visit: Visit;
}
