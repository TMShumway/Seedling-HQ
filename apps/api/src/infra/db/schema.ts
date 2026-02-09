import { pgTable, uuid, varchar, timestamp, index, unique, jsonb, integer } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    email: varchar('email', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('users_tenant_email_unique').on(table.tenantId, table.email),
    index('users_tenant_id_idx').on(table.tenantId),
  ],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    principalType: varchar('principal_type', { length: 50 }).notNull(),
    principalId: varchar('principal_id', { length: 255 }).notNull(),
    eventName: varchar('event_name', { length: 255 }).notNull(),
    subjectType: varchar('subject_type', { length: 255 }).notNull(),
    subjectId: varchar('subject_id', { length: 255 }).notNull(),
    correlationId: varchar('correlation_id', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_events_tenant_created_idx').on(table.tenantId, table.createdAt)],
);

export const businessSettings = pgTable(
  'business_settings',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id)
      .unique(),
    phone: varchar('phone', { length: 50 }),
    addressLine1: varchar('address_line1', { length: 255 }),
    addressLine2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 255 }),
    state: varchar('state', { length: 50 }),
    zip: varchar('zip', { length: 20 }),
    timezone: varchar('timezone', { length: 100 }),
    businessHours: jsonb('business_hours'),
    serviceArea: varchar('service_area', { length: 1000 }),
    defaultDurationMinutes: integer('default_duration_minutes'),
    description: varchar('description', { length: 2000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('business_settings_tenant_id_idx').on(table.tenantId)],
);
