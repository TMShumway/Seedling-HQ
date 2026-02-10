import { eq, and, or, ilike, sql, lt, desc } from 'drizzle-orm';
import type { QuoteRepository, ListQuotesFilters, QuoteUpdatePatch } from '../../../application/ports/quote-repository.js';
import type { PaginatedResult } from '../../../application/ports/client-repository.js';
import type { Quote, QuoteStatus, QuoteLineItem } from '../../../domain/entities/quote.js';
import type { Database } from '../client.js';
import { quotes } from '../schema.js';
import { ValidationError } from '../../../shared/errors.js';

const DEFAULT_LIMIT = 20;

function encodeCursor(id: string, createdAt: Date): string {
  return Buffer.from(JSON.stringify({ id, createdAt: createdAt.toISOString() })).toString('base64url');
}

function decodeCursor(cursor: string): { id: string; createdAt: Date } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf-8'));
    return { id: parsed.id, createdAt: new Date(parsed.createdAt) };
  } catch {
    throw new ValidationError('Invalid cursor');
  }
}

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

  async list(tenantId: string, filters?: ListQuotesFilters): Promise<PaginatedResult<Quote>> {
    const limit = filters?.limit ?? DEFAULT_LIMIT;
    const conditions = [eq(quotes.tenantId, tenantId)];

    if (filters?.status) {
      conditions.push(eq(quotes.status, filters.status));
    }

    if (filters?.search) {
      const term = `%${filters.search}%`;
      conditions.push(ilike(quotes.title, term));
    }

    if (filters?.cursor) {
      const { id, createdAt } = decodeCursor(filters.cursor);
      conditions.push(
        or(
          lt(quotes.createdAt, createdAt),
          and(eq(quotes.createdAt, createdAt), lt(quotes.id, id)),
        )!,
      );
    }

    const rows = await this.db
      .select()
      .from(quotes)
      .where(and(...conditions))
      .orderBy(desc(quotes.createdAt), desc(quotes.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(toEntity);
    const lastItem = data[data.length - 1];
    const cursor = lastItem && hasMore ? encodeCursor(lastItem.id, lastItem.createdAt) : null;

    return { data, cursor, hasMore };
  }

  async update(tenantId: string, id: string, patch: QuoteUpdatePatch): Promise<Quote | null> {
    const setPatch: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.title !== undefined) setPatch.title = patch.title;
    if (patch.lineItems !== undefined) setPatch.lineItems = patch.lineItems as unknown[];
    if (patch.subtotal !== undefined) setPatch.subtotal = patch.subtotal;
    if (patch.tax !== undefined) setPatch.tax = patch.tax;
    if (patch.total !== undefined) setPatch.total = patch.total;

    const rows = await this.db
      .update(quotes)
      .set(setPatch)
      .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
      .returning();

    return rows[0] ? toEntity(rows[0]) : null;
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
