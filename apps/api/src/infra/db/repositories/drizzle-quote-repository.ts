import { eq, and, sql } from 'drizzle-orm';
import type { QuoteRepository } from '../../../application/ports/quote-repository.js';
import type { Quote, QuoteStatus, QuoteLineItem } from '../../../domain/entities/quote.js';
import type { Database } from '../client.js';
import { quotes } from '../schema.js';

function toEntity(row: typeof quotes.$inferSelect): Quote {
  return {
    id: row.id,
    tenantId: row.tenantId,
    requestId: row.requestId,
    clientId: row.clientId,
    propertyId: row.propertyId,
    title: row.title,
    lineItems: (row.lineItems ?? []) as QuoteLineItem[],
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    status: row.status as QuoteStatus,
    sentAt: row.sentAt,
    approvedAt: row.approvedAt,
    declinedAt: row.declinedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleQuoteRepository implements QuoteRepository {
  constructor(private db: Database) {}

  async create(quote: Omit<Quote, 'createdAt' | 'updatedAt'>): Promise<Quote> {
    const [row] = await this.db
      .insert(quotes)
      .values({
        id: quote.id,
        tenantId: quote.tenantId,
        requestId: quote.requestId,
        clientId: quote.clientId,
        propertyId: quote.propertyId,
        title: quote.title,
        lineItems: quote.lineItems as unknown[],
        subtotal: quote.subtotal,
        tax: quote.tax,
        total: quote.total,
        status: quote.status,
        sentAt: quote.sentAt,
        approvedAt: quote.approvedAt,
        declinedAt: quote.declinedAt,
      })
      .returning();
    return toEntity(row);
  }

  async getById(tenantId: string, id: string): Promise<Quote | null> {
    const rows = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)));
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async count(tenantId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotes)
      .where(eq(quotes.tenantId, tenantId));
    return result[0].count;
  }

  async countByStatus(tenantId: string, status: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotes)
      .where(and(eq(quotes.tenantId, tenantId), eq(quotes.status, status)));
    return result[0].count;
  }
}
