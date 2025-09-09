import { Customer } from '@seedling-hq/core';
import { CustomerRepository } from '@seedling-hq/ports';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, count, desc } from 'drizzle-orm';
import { customers, CustomerRow } from '../schemas/customers.js';

/**
 * Drizzle ORM implementation of CustomerRepository
 * Handles the persistence of Customer entities using PostgreSQL
 */
export class DrizzleCustomerRepository implements CustomerRepository {
  constructor(private readonly db: PostgresJsDatabase<any>) {}

  async findById(id: string): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToCustomer(rows[0]);
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const rows = await this.db
      .select()
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapRowToCustomer(rows[0]);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const result = await this.db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    return result[0]?.count > 0;
  }

  async save(customer: Customer): Promise<void> {
    const customerData = {
      id: customer.id,
      email: customer.email,
      name: customer.name,
      phoneNumber: customer.phoneNumber,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: new Date(), // Always update the timestamp
    };

    // Use upsert pattern - insert or update if exists
    await this.db
      .insert(customers)
      .values(customerData)
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          email: customerData.email,
          name: customerData.name,
          phoneNumber: customerData.phoneNumber,
          isActive: customerData.isActive,
          updatedAt: customerData.updatedAt,
        },
      });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(customers)
      .where(eq(customers.id, id));
  }

  async findMany(options: {
    limit: number;
    offset: number;
    isActive?: boolean;
  }): Promise<Customer[]> {
    const baseQuery = this.db
      .select()
      .from(customers)
      .orderBy(desc(customers.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    // Apply isActive filter if provided
    const rows = options.isActive !== undefined
      ? await baseQuery.where(eq(customers.isActive, options.isActive))
      : await baseQuery;

    return rows.map(row => this.mapRowToCustomer(row));
  }

  async count(options?: { isActive?: boolean }): Promise<number> {
    const baseQuery = this.db
      .select({ count: count() })
      .from(customers);

    // Apply isActive filter if provided
    const result = options?.isActive !== undefined
      ? await baseQuery.where(eq(customers.isActive, options.isActive))
      : await baseQuery;

    return result[0]?.count || 0;
  }

  /**
   * Maps a database row to a Customer domain entity
   */
  private mapRowToCustomer(row: CustomerRow): Customer {
    return Customer.fromPersistence({
      id: row.id,
      email: row.email,
      name: row.name,
      phoneNumber: row.phoneNumber,
      createdAt: row.createdAt,
      isActive: row.isActive,
    });
  }
}
