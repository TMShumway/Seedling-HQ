import type { Request } from '../../domain/entities/request.js';

export interface CreatePublicRequestInput {
  tenantSlug: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  description: string;
  honeypot: string | null;
}

export interface RequestOutput {
  request: Request;
}
