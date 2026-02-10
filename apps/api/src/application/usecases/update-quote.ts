import { randomUUID } from 'node:crypto';
import type { QuoteRepository, QuoteUpdatePatch } from '../ports/quote-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { UpdateQuoteInput, QuoteOutput } from '../dto/quote-dto.js';
import { ValidationError, NotFoundError } from '../../shared/errors.js';

export class UpdateQuoteUseCase {
  constructor(
    private quoteRepo: QuoteRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: UpdateQuoteInput,
    correlationId: string,
  ): Promise<QuoteOutput> {
    const existing = await this.quoteRepo.getById(input.tenantId, input.id);
    if (!existing) {
      throw new NotFoundError('Quote not found');
    }

    if (existing.status !== 'draft') {
      throw new ValidationError('Only draft quotes can be edited');
    }

    const patch: QuoteUpdatePatch = {};

    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (!trimmed) throw new ValidationError('Title is required');
      patch.title = trimmed;
    }

    if (input.lineItems !== undefined) {
      for (const item of input.lineItems) {
        if (!item.description || !item.description.trim()) {
          throw new ValidationError('Line item description is required');
        }
        if (item.quantity <= 0) {
          throw new ValidationError('Line item quantity must be positive');
        }
        if (item.unitPrice < 0) {
          throw new ValidationError('Line item unit price cannot be negative');
        }
        item.description = item.description.trim();
        item.total = item.quantity * item.unitPrice;
      }
      patch.lineItems = input.lineItems;
      patch.subtotal = input.lineItems.reduce((sum, item) => sum + item.total, 0);
    }

    if (input.tax !== undefined) {
      if (input.tax < 0) {
        throw new ValidationError('Tax cannot be negative');
      }
      patch.tax = input.tax;
    }

    // Recompute total if subtotal or tax changed
    const newSubtotal = patch.subtotal ?? existing.subtotal;
    const newTax = patch.tax ?? existing.tax;
    if (patch.subtotal !== undefined || patch.tax !== undefined) {
      patch.total = newSubtotal + newTax;
    }

    const quote = await this.quoteRepo.update(input.tenantId, input.id, patch);
    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId: input.tenantId,
      principalType: 'internal',
      principalId: input.userId,
      eventName: 'quote.updated',
      subjectType: 'quote',
      subjectId: input.id,
      correlationId,
    });

    return { quote };
  }
}
