import type { Visit } from '../../domain/entities/visit.js';

export interface ScheduleVisitInput {
  tenantId: string;
  userId: string;
  visitId: string;
  scheduledStart: Date;
  scheduledEnd?: Date;
}

export interface ScheduleVisitOutput {
  visit: Visit;
}
