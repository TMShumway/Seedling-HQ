import type { Quote, QuoteLineItem } from '../../domain/entities/quote.js';

export interface UpdateQuoteInput {
  tenantId: string;
  userId: string;
  id: string;
  title?: string;
  lineItems?: QuoteLineItem[];
  tax?: number;
}

export interface QuoteOutput {
  quote: Quote;
}
