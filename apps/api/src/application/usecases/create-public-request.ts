import { randomUUID } from 'node:crypto';
import type { TenantRepository } from '../ports/tenant-repository.js';
import type { RequestRepository } from '../ports/request-repository.js';
import type { AuditEventRepository } from '../ports/audit-event-repository.js';
import type { CreatePublicRequestInput, RequestOutput } from '../dto/request-dto.js';
import { ValidationError, NotFoundError } from '../../shared/errors.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CreatePublicRequestUseCase {
  constructor(
    private tenantRepo: TenantRepository,
    private requestRepo: RequestRepository,
    private auditRepo: AuditEventRepository,
  ) {}

  async execute(
    input: CreatePublicRequestInput,
    correlationId: string,
  ): Promise<RequestOutput> {
    // Honeypot — silent rejection with fake success
    if (input.honeypot) {
      return {
        request: {
          id: randomUUID(),
          tenantId: '',
          source: 'public_form',
          clientName: '',
          clientEmail: '',
          clientPhone: null,
          description: '',
          status: 'new',
          assignedUserId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };
    }

    // Validate + trim
    const clientName = input.clientName.trim();
    const clientEmail = input.clientEmail.trim();
    const clientPhone = input.clientPhone?.trim() || null;
    const description = input.description.trim();

    if (!clientName) {
      throw new ValidationError('Name is required');
    }
    if (!clientEmail) {
      throw new ValidationError('Email is required');
    }
    if (!EMAIL_RE.test(clientEmail)) {
      throw new ValidationError('Invalid email format');
    }
    if (!description) {
      throw new ValidationError('Description is required');
    }

    // Resolve tenant by slug
    const tenant = await this.tenantRepo.getBySlug(input.tenantSlug);
    if (!tenant) {
      throw new NotFoundError('Business not found');
    }

    const id = randomUUID();

    const request = await this.requestRepo.create({
      id,
      tenantId: tenant.id,
      source: 'public_form',
      clientName,
      clientEmail,
      clientPhone,
      description,
      status: 'new',
      assignedUserId: null,
    });

    await this.auditRepo.record({
      id: randomUUID(),
      tenantId: tenant.id,
      principalType: 'system',
      principalId: 'public_form',
      eventName: 'request.created',
      subjectType: 'request',
      subjectId: id,
      correlationId,
    });

    return { request };
  }
}
