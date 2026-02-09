import type { Quote } from '../../domain/entities/quote.js';

export interface QuoteRepository {
  create(quote: Omit<Quote, 'createdAt' | 'updatedAt'>): Promise<Quote>;
  getById(tenantId: string, id: string): Promise<Quote | null>;
  count(tenantId: string): Promise<number>;
  countByStatus(tenantId: string, status: string): Promise<number>;
}
