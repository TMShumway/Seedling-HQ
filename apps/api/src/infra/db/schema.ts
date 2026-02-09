import { pgTable, uuid, varchar, text, timestamp, index, unique, jsonb, integer, boolean, smallint } from 'drizzle-orm/pg-core';

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
  (table) => [
    index('audit_events_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('audit_events_subject_idx').on(table.tenantId, table.subjectType, table.subjectId, table.createdAt),
  ],
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

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('service_categories_tenant_name_unique').on(table.tenantId, table.name),
    index('service_categories_tenant_id_idx').on(table.tenantId),
  ],
);

export const serviceItems = pgTable(
  'service_items',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => serviceCategories.id),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    unitPrice: integer('unit_price').notNull(),
    unitType: varchar('unit_type', { length: 50 }).notNull(),
    estimatedDurationMinutes: integer('estimated_duration_minutes'),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('service_items_tenant_category_name_unique').on(table.tenantId, table.categoryId, table.name),
    index('service_items_tenant_id_idx').on(table.tenantId),
    index('service_items_category_id_idx').on(table.categoryId),
  ],
);

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    company: varchar('company', { length: 255 }),
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('clients_tenant_email_unique').on(table.tenantId, table.email),
    index('clients_tenant_id_idx').on(table.tenantId),
    index('clients_tenant_created_at_idx').on(table.tenantId, table.createdAt),
  ],
);

export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    source: varchar('source', { length: 50 }).notNull(),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    clientEmail: varchar('client_email', { length: 255 }).notNull(),
    clientPhone: varchar('client_phone', { length: 50 }),
    description: text('description').notNull(),
    status: varchar('status', { length: 50 }).notNull().default('new'),
    assignedUserId: uuid('assigned_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('requests_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('requests_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const messageOutbox = pgTable(
  'message_outbox',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    type: varchar('type', { length: 100 }).notNull(),
    recipientId: uuid('recipient_id'),
    recipientType: varchar('recipient_type', { length: 50 }),
    channel: varchar('channel', { length: 20 }).notNull(),
    subject: varchar('subject', { length: 500 }),
    body: text('body').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('queued'),
    provider: varchar('provider', { length: 50 }),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    attemptCount: smallint('attempt_count').notNull().default(0),
    lastErrorCode: varchar('last_error_code', { length: 50 }),
    lastErrorMessage: text('last_error_message'),
    correlationId: varchar('correlation_id', { length: 255 }).notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [
    index('message_outbox_tenant_created_idx').on(table.tenantId, table.createdAt),
    index('message_outbox_status_created_idx').on(table.status, table.createdAt),
  ],
);

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    addressLine1: varchar('address_line1', { length: 255 }).notNull(),
    addressLine2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 255 }),
    state: varchar('state', { length: 50 }),
    zip: varchar('zip', { length: 20 }),
    notes: text('notes'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('properties_tenant_client_address_unique').on(table.tenantId, table.clientId, table.addressLine1),
    index('properties_tenant_id_idx').on(table.tenantId),
    index('properties_client_id_idx').on(table.clientId),
  ],
);

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    requestId: uuid('request_id').references(() => requests.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id),
    propertyId: uuid('property_id').references(() => properties.id),
    title: varchar('title', { length: 500 }).notNull(),
    lineItems: jsonb('line_items').$type<unknown[]>().notNull().default([]),
    subtotal: integer('subtotal').notNull().default(0),
    tax: integer('tax').notNull().default(0),
    total: integer('total').notNull().default(0),
    status: varchar('status', { length: 50 }).notNull().default('draft'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('quotes_tenant_id_idx').on(table.tenantId),
    index('quotes_client_id_idx').on(table.clientId),
    index('quotes_request_id_idx').on(table.requestId),
    index('quotes_tenant_status_idx').on(table.tenantId, table.status),
  ],
);
