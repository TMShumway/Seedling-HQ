import { randomUUID } from 'node:crypto';
import type { RequestRepository } from '../ports/request-repository.js';
import type { ClientRepository } from '../ports/client-repository.js';
import type { UnitOfWork } from '../ports/unit-of-work.js';
import type { ConvertRequestInput, ConvertRequestOutput } from '../dto/convert-request-dto.js';
import { NotFoundError, ValidationError, ConflictError, isUniqueViolation } from '../../shared/errors.js';

const CONVERTIBLE_STATUSES = ['new', 'reviewed'];

export class ConvertRequestUseCase {
  constructor(
    private requestRepo: RequestRepository,
    private clientRepo: ClientRepository,
    private uow: UnitOfWork,
  ) {}

  async execute(input: ConvertRequestInput, correlationId: string): Promise<ConvertRequestOutput> {
    // Validate required fields
    const firstName = input.firstName.trim();
    if (!firstName) {
      throw new ValidationError('First name is required');
    }
    const lastName = (input.lastName ?? '').trim();
    const addressLine1 = input.addressLine1.trim();
    if (!addressLine1) {
      throw new ValidationError('Address is required');
    }
    const quoteTitle = input.quoteTitle.trim();
    if (!quoteTitle) {
      throw new ValidationError('Quote title is required');
    }

    // Lookup request (outside transaction)
    const request = await this.requestRepo.getById(input.tenantId, input.requestId);
    if (!request) {
      throw new NotFoundError('Request not found');
    }
    if (!CONVERTIBLE_STATUSES.includes(request.status)) {
      throw new ValidationError(`Request with status "${request.status}" cannot be converted`);
    }

    // If using existing client, verify it exists (outside transaction)
    let existingClient = null;
    if (input.existingClientId) {
      existingClient = await this.clientRepo.getById(input.tenantId, input.existingClientId);
      if (!existingClient) {
        throw new NotFoundError('Client not found');
      }
    }

    const clientId = existingClient?.id ?? randomUUID();
    const propertyId = randomUUID();
    const quoteId = randomUUID();
    const clientCreated = !existingClient;

    try {
      return await this.uow.run(async ({ clientRepo, propertyRepo, requestRepo, quoteRepo, auditRepo }) => {
        // Create client if new
        let client;
        if (clientCreated) {
          client = await clientRepo.create({
            id: clientId,
            tenantId: input.tenantId,
            firstName,
            lastName,
            email: input.email ?? null,
            phone: input.phone ?? null,
            company: input.company ?? null,
            notes: null,
            tags: [],
            active: true,
          });

          await auditRepo.record({
            id: randomUUID(),
            tenantId: input.tenantId,
            principalType: 'internal',
            principalId: input.userId,
            eventName: 'client.created',
            subjectType: 'client',
            subjectId: clientId,
            correlationId,
          });
        } else {
          client = existingClient!;
        }

        // Create property
        const property = await propertyRepo.create({
          id: propertyId,
          tenantId: input.tenantId,
          clientId,
          addressLine1,
          addressLine2: input.addressLine2?.trim() ?? null,
          city: input.city?.trim() ?? null,
          state: input.state?.trim() ?? null,
          zip: input.zip?.trim() ?? null,
          notes: null,
          active: true,
        });

        await auditRepo.record({
          id: randomUUID(),
          tenantId: input.tenantId,
          principalType: 'internal',
          principalId: input.userId,
          eventName: 'property.created',
          subjectType: 'property',
          subjectId: propertyId,
          correlationId,
        });

        // Create quote draft
        const quote = await quoteRepo.create({
          id: quoteId,
          tenantId: input.tenantId,
          requestId: input.requestId,
          clientId,
          propertyId,
          title: quoteTitle,
          lineItems: [],
          subtotal: 0,
          tax: 0,
          total: 0,
          status: 'draft',
          sentAt: null,
          approvedAt: null,
          declinedAt: null,
        });

        await auditRepo.record({
          id: randomUUID(),
          tenantId: input.tenantId,
          principalType: 'internal',
          principalId: input.userId,
          eventName: 'quote.created',
          subjectType: 'quote',
          subjectId: quoteId,
          correlationId,
        });

        // Update request status to converted
        const updatedRequest = await requestRepo.updateStatus(
          input.tenantId,
          input.requestId,
          'converted',
        );

        await auditRepo.record({
          id: randomUUID(),
          tenantId: input.tenantId,
          principalType: 'internal',
          principalId: input.userId,
          eventName: 'request.converted',
          subjectType: 'request',
          subjectId: input.requestId,
          correlationId,
        });

        return {
          request: updatedRequest!,
          client,
          property,
          quote,
          clientCreated,
        };
      });
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('A record with a conflicting unique field already exists');
      }
      throw err;
    }
  }
}
