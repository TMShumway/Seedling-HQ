import type { Quote, QuoteLineItem } from '../../domain/entities/quote.js';
import type { PaginatedResult } from './client-repository.js';

export interface ListQuotesFilters {
  limit?: number;
  cursor?: string;
  search?: string;
  status?: string;
}

export interface QuoteUpdatePatch {
  title?: string;
  lineItems?: QuoteLineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
}

export interface QuoteStatusFields {
  sentAt?: Date;
  approvedAt?: Date;
  declinedAt?: Date;
  scheduledAt?: Date;
}

export interface QuoteRepository {
  create(quote: Omit<Quote, 'createdAt' | 'updatedAt'>): Promise<Quote>;
  getById(tenantId: string, id: string): Promise<Quote | null>;
  list(tenantId: string, filters?: ListQuotesFilters): Promise<PaginatedResult<Quote>>;
  update(tenantId: string, id: string, patch: QuoteUpdatePatch): Promise<Quote | null>;
  updateStatus(tenantId: string, id: string, status: string, statusFields?: QuoteStatusFields, expectedStatuses?: string[]): Promise<Quote | null>;
  count(tenantId: string): Promise<number>;
  countByStatus(tenantId: string, status: string): Promise<number>;
}
