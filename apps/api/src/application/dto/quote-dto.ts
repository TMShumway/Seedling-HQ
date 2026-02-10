import type { Quote, QuoteLineItem } from '../../domain/entities/quote.js';

export interface CreateStandaloneQuoteInput {
  tenantId: string;
  userId: string;
  clientId: string;
  propertyId?: string;
  title: string;
}

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
