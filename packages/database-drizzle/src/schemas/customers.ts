import { pgTable, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Customers table schema
 * Maps to the Customer domain entity
 */
export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phoneNumber: text('phone_number'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Indexes for performance
  emailIdx: uniqueIndex('customers_email_idx').on(table.email),
  isActiveIdx: index('customers_is_active_idx').on(table.isActive),
  createdAtIdx: index('customers_created_at_idx').on(table.createdAt),
}));

/**
 * Type inference for select operations
 */
export type CustomerRow = typeof customers.$inferSelect;

/**
 * Type inference for insert operations
 */
export type NewCustomerRow = typeof customers.$inferInsert;
