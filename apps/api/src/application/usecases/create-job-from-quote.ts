import { randomUUID } from 'node:crypto';
import type { QuoteRepository } from '../ports/quote-repository.js';
import type { JobRepository } from '../ports/job-repository.js';
import type { VisitRepository } from '../ports/visit-repository.js';
import type { ServiceItemRepository } from '../ports/service-item-repository.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import type { CreateJobFromQuoteInput, CreateJobFromQuoteOutput } from '../dto/create-job-dto.js';
import { NotFoundError, ValidationError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

const DEFAULT_DURATION = 60;

export class CreateJobFromQuoteUseCase {
  constructor(
    private quoteRepo: QuoteRepository,
    private jobRepo: JobRepository,
    private visitRepo: VisitRepository,
    private serviceItemRepo: ServiceItemRepository,
    private uow: UnitOfWork,
  ) {}

  async execute(input: CreateJobFromQuoteInput, correlationId: string): Promise<CreateJobFromQuoteOutput> {
    // Fetch quote outside transaction
    const quote = await this.quoteRepo.getById(input.tenantId, input.quoteId);
    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    // Idempotency: if already scheduled, return existing job
    if (quote.status === 'scheduled') {
      const existingJob = await this.jobRepo.getByQuoteId(input.tenantId, input.quoteId);
      if (existingJob) {
        const visits = await this.visitRepo.listByJobId(input.tenantId, existingJob.id);
        return {
          job: existingJob,
          visit: visits[0],
          quote,
          suggestedDurationMinutes: visits[0]?.estimatedDurationMinutes ?? DEFAULT_DURATION,
          alreadyExisted: true,
        };
      }
      throw new ValidationError('Quote is in scheduled state but no job was found');
    }

    // Only approved quotes can become jobs
    if (quote.status !== 'approved') {
      throw new ValidationError(`Cannot create job from quote with status "${quote.status}"`);
    }

    // Calculate estimated duration from line items' service items
    const suggestedDurationMinutes = await this.calculateDuration(input.tenantId, quote.lineItems);

    // Pre-generate UUIDs
    const jobId = randomUUID();
    const visitId = randomUUID();
    const scheduledAt = new Date();

    try {
      const result = await this.uow.run(async ({ quoteRepo, jobRepo, visitRepo, auditRepo }) => {
        // Race-guarded status transition: approved → scheduled
        const updatedQuote = await quoteRepo.updateStatus(
          input.tenantId, input.quoteId, 'scheduled', { scheduledAt }, ['approved'],
        );
        if (!updatedQuote) {
          throw new ConflictError('Quote has already been transitioned');
        }

        // Create job
        const job = await jobRepo.create({
          id: jobId,
          tenantId: input.tenantId,
          quoteId: input.quoteId,
          clientId: quote.clientId,
          propertyId: quote.propertyId,
          title: quote.title,
          status: 'scheduled',
        });

        // Create first visit
        const visit = await visitRepo.create({
          id: visitId,
          tenantId: input.tenantId,
          jobId,
          assignedUserId: null,
          scheduledStart: null,
          scheduledEnd: null,
          estimatedDurationMinutes: suggestedDurationMinutes,
          status: 'scheduled',
          notes: null,
          completedAt: null,
        });

        // Audit events
        await auditRepo.record({
          id: randomUUID(),
          tenantId: input.tenantId,
          principalType: 'internal',
          principalId: input.userId,
          eventName: 'job.created',
          subjectType: 'job',
          subjectId: jobId,
          correlationId,
        });

        await auditRepo.record({
          id: randomUUID(),
          tenantId: input.tenantId,
          principalType: 'internal',
          principalId: input.userId,
          eventName: 'visit.scheduled',
          subjectType: 'visit',
          subjectId: visitId,
          correlationId,
        });

        await auditRepo.record({
          id: randomUUID(),
          tenantId: input.tenantId,
          principalType: 'internal',
          principalId: input.userId,
          eventName: 'quote.scheduled',
          subjectType: 'quote',
          subjectId: input.quoteId,
          correlationId,
        });

        return { job, visit, quote: updatedQuote };
      });

      return {
        job: result.job,
        visit: result.visit,
        quote: result.quote,
        suggestedDurationMinutes,
        alreadyExisted: false,
      };
    } catch (err: unknown) {
      // Scoped idempotency: unique violation on jobs_tenant_quote_unique
      if (isUniqueViolation(err)) {
        const existingJob = await this.jobRepo.getByQuoteId(input.tenantId, input.quoteId);
        if (existingJob) {
          const currentQuote = await this.quoteRepo.getById(input.tenantId, input.quoteId);
          if (currentQuote) {
            const visits = await this.visitRepo.listByJobId(input.tenantId, existingJob.id);
            return {
              job: existingJob,
              visit: visits[0],
              quote: currentQuote,
              suggestedDurationMinutes: visits[0]?.estimatedDurationMinutes ?? DEFAULT_DURATION,
              alreadyExisted: true,
            };
          }
        }
      }
      throw err;
    }
  }

  private async calculateDuration(
    tenantId: string,
    lineItems: Array<{ serviceItemId: string | null }>,
  ): Promise<number> {
    let total = 0;
    for (const li of lineItems) {
      if (!li.serviceItemId) continue;
      const svc = await this.serviceItemRepo.getById(tenantId, li.serviceItemId);
      if (svc?.estimatedDurationMinutes) {
        total += svc.estimatedDurationMinutes;
      }
    }
    return total > 0 ? total : DEFAULT_DURATION;
  }
}
