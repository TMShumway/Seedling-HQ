import type { Job } from '../../domain/entities/job.js';
import type { Visit } from '../../domain/entities/visit.js';
import type { Quote } from '../../domain/entities/quote.js';

export interface CreateJobFromQuoteInput {
  tenantId: string;
  userId: string;
  quoteId: string;
}

export interface CreateJobFromQuoteOutput {
  job: Job;
  visit: Visit;
  quote: Quote;
  suggestedDurationMinutes: number;
  alreadyExisted: boolean;
}
