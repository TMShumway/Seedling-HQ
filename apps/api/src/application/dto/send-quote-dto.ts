import type { Quote } from '../../domain/entities/quote.js';

export interface SendQuoteInput {
  tenantId: string;
  userId: string;
  quoteId: string;
  expiresInDays?: number;
}

export interface SendQuoteOutput {
  quote: Quote;
  token: string; // raw token (returned once, never stored)
  link: string;
}
