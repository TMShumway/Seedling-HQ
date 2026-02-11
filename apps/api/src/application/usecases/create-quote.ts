import { randomUUID } from 'node:crypto';
import type { QuoteRepository } from '../ports/quote-repository.js';
import type { ClientRepository } from '../ports/client-repository.js';
import type { PropertyRepository } from '../ports/property-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { CreateStandaloneQuoteInput, QuoteOutput } from '../dto/quote-dto.js';
import { ValidationError, NotFoundError } from '../../shared/errors.js';

export class CreateStandaloneQuoteUseCase {
  constructor(
    private quoteRepo: QuoteRepository,
    private clientRepo: ClientRepository,
    private propertyRepo: PropertyRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: CreateStandaloneQuoteInput,
    correlationId: string,
  ): Promise<QuoteOutput> {
    // Validate title
    const title = input.title.trim();
    if (!title) {
      throw new ValidationError('Title is required');
    }

    // Validate client exists and is active
    const client = await this.clientRepo.getById(input.tenantId, input.clientId);
    if (!client) {
      throw new NotFoundError('Client not found');
    }
    if (!client.active) {
      throw new ValidationError('Cannot create quote for inactive client');
    }

    // Validate property if provided
    if (input.propertyId) {
      const property = await this.propertyRepo.getById(input.tenantId, input.propertyId);
      if (!property) {
        throw new NotFoundError('Property not found');
      }
      if (!property.active) {
        throw new ValidationError('Cannot create quote for inactive property');
      }
      if (property.clientId !== input.clientId) {
        throw new ValidationError('Property does not belong to the specified client');
      }
    }

    // Create quote
    const quote = await this.quoteRepo.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      requestId: null,
      clientId: input.clientId,
      propertyId: input.propertyId ?? null,
      title,
      lineItems: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      status: 'draft',
      sentAt: null,
      approvedAt: null,
      declinedAt: null,
    });

    // Best-effort audit
    try {
      await this.auditRepo.record({
        id: randomUUID(),
        tenantId: input.tenantId,
        principalType: 'internal',
        principalId: input.userId,
        eventName: 'quote.created',
        subjectType: 'quote',
        subjectId: quote.id,
        correlationId,
      });
    } catch {
      // best-effort — don't fail quote creation if audit write fails
    }

    return { quote };
  }
}
