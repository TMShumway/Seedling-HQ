import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { tenants, users, auditEvents, serviceCategories, serviceItems, clients, properties, requests, quotes } from './schema.js';
import { sql } from 'drizzle-orm';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000010';

const DEMO_CATEGORY_IDS = {
  lawnCare: '00000000-0000-0000-0000-000000000200',
  treeService: '00000000-0000-0000-0000-000000000201',
  landscaping: '00000000-0000-0000-0000-000000000202',
};

async function seed() {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://fsa:fsa@localhost:5432/fsa';
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  console.log('Seeding database...');

  // Upsert demo tenant
  await db
    .insert(tenants)
    .values({
      id: DEMO_TENANT_ID,
      slug: 'demo',
      name: 'Demo Business',
      status: 'active',
    })
    .onConflictDoUpdate({
      target: tenants.id,
      set: { name: 'Demo Business', slug: 'demo', status: 'active' },
    });

  // Upsert demo owner user
  await db
    .insert(users)
    .values({
      id: DEMO_USER_ID,
      tenantId: DEMO_TENANT_ID,
      email: 'owner@demo.local',
      fullName: 'Demo Owner',
      role: 'owner',
      status: 'active',
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { email: 'owner@demo.local', fullName: 'Demo Owner', role: 'owner', status: 'active' },
    });

  // Note: business_settings intentionally NOT seeded — onboarding flow
  // should prompt the user to configure their business profile.

  // Upsert demo service categories
  const categoryValues = [
    { id: DEMO_CATEGORY_IDS.lawnCare, tenantId: DEMO_TENANT_ID, name: 'Lawn Care', description: 'Mowing, edging, and lawn maintenance', sortOrder: 0 },
    { id: DEMO_CATEGORY_IDS.treeService, tenantId: DEMO_TENANT_ID, name: 'Tree Service', description: 'Trimming, removal, and stump grinding', sortOrder: 1 },
    { id: DEMO_CATEGORY_IDS.landscaping, tenantId: DEMO_TENANT_ID, name: 'Landscaping', description: 'Design, planting, and hardscaping', sortOrder: 2 },
  ];
  for (const cat of categoryValues) {
    await db
      .insert(serviceCategories)
      .values(cat)
      .onConflictDoUpdate({
        target: serviceCategories.id,
        set: { name: cat.name, description: cat.description, sortOrder: cat.sortOrder },
      });
  }

  // Upsert demo service items
  const serviceValues = [
    { id: '00000000-0000-0000-0000-000000000300', tenantId: DEMO_TENANT_ID, categoryId: DEMO_CATEGORY_IDS.lawnCare, name: 'Weekly Mowing', unitPrice: 4500, unitType: 'per_visit', estimatedDurationMinutes: 45, sortOrder: 0 },
    { id: '00000000-0000-0000-0000-000000000301', tenantId: DEMO_TENANT_ID, categoryId: DEMO_CATEGORY_IDS.lawnCare, name: 'Edging & Trimming', unitPrice: 2500, unitType: 'per_visit', estimatedDurationMinutes: 30, sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000302', tenantId: DEMO_TENANT_ID, categoryId: DEMO_CATEGORY_IDS.lawnCare, name: 'Aeration', unitPrice: 7500, unitType: 'flat', estimatedDurationMinutes: 60, sortOrder: 2 },
    { id: '00000000-0000-0000-0000-000000000303', tenantId: DEMO_TENANT_ID, categoryId: DEMO_CATEGORY_IDS.treeService, name: 'Tree Trimming', unitPrice: 8500, unitType: 'hourly', estimatedDurationMinutes: 120, sortOrder: 0 },
    { id: '00000000-0000-0000-0000-000000000304', tenantId: DEMO_TENANT_ID, categoryId: DEMO_CATEGORY_IDS.treeService, name: 'Tree Removal', unitPrice: 50000, unitType: 'flat', estimatedDurationMinutes: 240, sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000305', tenantId: DEMO_TENANT_ID, categoryId: DEMO_CATEGORY_IDS.landscaping, name: 'Mulch Installation', unitPrice: 350, unitType: 'per_sqft', estimatedDurationMinutes: null, sortOrder: 0 },
    { id: '00000000-0000-0000-0000-000000000306', tenantId: DEMO_TENANT_ID, categoryId: DEMO_CATEGORY_IDS.landscaping, name: 'Landscape Design Consultation', unitPrice: 15000, unitType: 'flat', estimatedDurationMinutes: 90, sortOrder: 1 },
    { id: '00000000-0000-0000-0000-000000000307', tenantId: DEMO_TENANT_ID, categoryId: DEMO_CATEGORY_IDS.landscaping, name: 'Shrub Planting', unitPrice: 2500, unitType: 'per_unit', estimatedDurationMinutes: 30, sortOrder: 2 },
  ];
  for (const svc of serviceValues) {
    await db
      .insert(serviceItems)
      .values(svc)
      .onConflictDoUpdate({
        target: serviceItems.id,
        set: { name: svc.name, unitPrice: svc.unitPrice, unitType: svc.unitType, estimatedDurationMinutes: svc.estimatedDurationMinutes, sortOrder: svc.sortOrder },
      });
  }

  // Upsert demo clients
  const DEMO_CLIENT_IDS = {
    johnSmith: '00000000-0000-0000-0000-000000000400',
    janeJohnson: '00000000-0000-0000-0000-000000000401',
    bobWilson: '00000000-0000-0000-0000-000000000402',
  };

  const clientValues = [
    { id: DEMO_CLIENT_IDS.johnSmith, tenantId: DEMO_TENANT_ID, firstName: 'John', lastName: 'Smith', email: 'john.smith@example.com', phone: '(555) 100-1001', company: 'Smith Residence', notes: 'Prefers communication via text', tags: ['residential', 'weekly'] },
    { id: DEMO_CLIENT_IDS.janeJohnson, tenantId: DEMO_TENANT_ID, firstName: 'Jane', lastName: 'Johnson', email: 'jane.johnson@example.com', phone: '(555) 100-1002', company: 'Johnson & Co', notes: null, tags: ['commercial'] },
    { id: DEMO_CLIENT_IDS.bobWilson, tenantId: DEMO_TENANT_ID, firstName: 'Bob', lastName: 'Wilson', email: 'bob.wilson@example.com', phone: '(555) 100-1003', company: null, notes: 'Has large backyard', tags: ['residential'] },
  ];
  for (const c of clientValues) {
    await db
      .insert(clients)
      .values(c)
      .onConflictDoUpdate({
        target: clients.id,
        set: { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, company: c.company, notes: c.notes, tags: c.tags },
      });
  }

  // Upsert demo properties
  const propertyValues = [
    { id: '00000000-0000-0000-0000-000000000500', tenantId: DEMO_TENANT_ID, clientId: DEMO_CLIENT_IDS.johnSmith, addressLine1: '123 Main Street', addressLine2: null, city: 'Springfield', state: 'IL', zip: '62701', notes: 'Corner lot, large yard' },
    { id: '00000000-0000-0000-0000-000000000501', tenantId: DEMO_TENANT_ID, clientId: DEMO_CLIENT_IDS.janeJohnson, addressLine1: '456 Commerce Blvd', addressLine2: 'Suite 200', city: 'Springfield', state: 'IL', zip: '62702', notes: 'Commercial property — main entrance on Commerce' },
    { id: '00000000-0000-0000-0000-000000000502', tenantId: DEMO_TENANT_ID, clientId: DEMO_CLIENT_IDS.bobWilson, addressLine1: '789 Oak Avenue', addressLine2: null, city: 'Springfield', state: 'IL', zip: '62703', notes: null },
  ];
  for (const p of propertyValues) {
    await db
      .insert(properties)
      .values(p)
      .onConflictDoUpdate({
        target: properties.id,
        set: { addressLine1: p.addressLine1, addressLine2: p.addressLine2, city: p.city, state: p.state, zip: p.zip, notes: p.notes },
      });
  }

  // Upsert demo requests
  const DEMO_REQUEST_IDS = {
    lawnRequest: '00000000-0000-0000-0000-000000000600',
    treeRequest: '00000000-0000-0000-0000-000000000601',
    landscapeRequest: '00000000-0000-0000-0000-000000000602',
  };

  const requestValues = [
    { id: DEMO_REQUEST_IDS.lawnRequest, tenantId: DEMO_TENANT_ID, source: 'public_form', clientName: 'Sarah Davis', clientEmail: 'sarah.davis@example.com', clientPhone: '(555) 200-3001', description: 'Looking for weekly lawn mowing service for my 1/4 acre lot. Front and back yard.', status: 'new' },
    { id: DEMO_REQUEST_IDS.treeRequest, tenantId: DEMO_TENANT_ID, source: 'public_form', clientName: 'Mike Chen', clientEmail: 'mike.chen@example.com', clientPhone: '(555) 200-3002', description: 'Have a large oak tree that needs trimming before storm season. Branches hanging over the house.', status: 'new' },
    { id: DEMO_REQUEST_IDS.landscapeRequest, tenantId: DEMO_TENANT_ID, source: 'public_form', clientName: 'Emily Rodriguez', clientEmail: 'emily.r@example.com', clientPhone: null, description: 'Interested in a landscape design consultation for our new home. Backyard is about 2000 sq ft.', status: 'new' },
  ];
  for (const r of requestValues) {
    await db
      .insert(requests)
      .values(r)
      .onConflictDoUpdate({
        target: requests.id,
        set: { clientName: r.clientName, clientEmail: r.clientEmail, clientPhone: r.clientPhone, description: r.description, status: r.status },
      });
  }

  // Upsert demo quote (linked to johnSmith client)
  const DEMO_QUOTE_ID = '00000000-0000-0000-0000-000000000700';
  const quoteLineItems = [
    { serviceItemId: '00000000-0000-0000-0000-000000000300', description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
    { serviceItemId: '00000000-0000-0000-0000-000000000301', description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
  ];
  const quoteSubtotal = 7000;
  const quoteTax = 0;
  const quoteTotal = 7000;

  await db
    .insert(quotes)
    .values({
      id: DEMO_QUOTE_ID,
      tenantId: DEMO_TENANT_ID,
      requestId: null,
      clientId: DEMO_CLIENT_IDS.johnSmith,
      propertyId: '00000000-0000-0000-0000-000000000500',
      title: 'Lawn Service for John Smith',
      lineItems: quoteLineItems,
      subtotal: quoteSubtotal,
      tax: quoteTax,
      total: quoteTotal,
      status: 'draft',
    })
    .onConflictDoUpdate({
      target: quotes.id,
      set: { title: 'Lawn Service for John Smith', lineItems: quoteLineItems, subtotal: quoteSubtotal, tax: quoteTax, total: quoteTotal, status: 'draft' },
    });

  // Insert audit events (idempotent: check first)
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(sql`${auditEvents.tenantId} = ${DEMO_TENANT_ID}`);

  if (existing[0].count === 0) {
    await db.insert(auditEvents).values([
      {
        id: '00000000-0000-0000-0000-000000000100',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'tenant.created',
        subjectType: 'tenant',
        subjectId: DEMO_TENANT_ID,
        correlationId: 'seed',
      },
      {
        id: '00000000-0000-0000-0000-000000000101',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'auth.signup',
        subjectType: 'user',
        subjectId: DEMO_USER_ID,
        correlationId: 'seed',
      },
      // Client created events (for timeline)
      {
        id: '00000000-0000-0000-0000-000000000110',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'client.created',
        subjectType: 'client',
        subjectId: DEMO_CLIENT_IDS.johnSmith,
        correlationId: 'seed',
      },
      {
        id: '00000000-0000-0000-0000-000000000111',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'client.created',
        subjectType: 'client',
        subjectId: DEMO_CLIENT_IDS.janeJohnson,
        correlationId: 'seed',
      },
      {
        id: '00000000-0000-0000-0000-000000000112',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'client.created',
        subjectType: 'client',
        subjectId: DEMO_CLIENT_IDS.bobWilson,
        correlationId: 'seed',
      },
      // Property created events (for timeline)
      {
        id: '00000000-0000-0000-0000-000000000120',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'property.created',
        subjectType: 'property',
        subjectId: '00000000-0000-0000-0000-000000000500',
        correlationId: 'seed',
      },
      {
        id: '00000000-0000-0000-0000-000000000121',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'property.created',
        subjectType: 'property',
        subjectId: '00000000-0000-0000-0000-000000000501',
        correlationId: 'seed',
      },
      {
        id: '00000000-0000-0000-0000-000000000122',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'property.created',
        subjectType: 'property',
        subjectId: '00000000-0000-0000-0000-000000000502',
        correlationId: 'seed',
      },
      // Request created events
      {
        id: '00000000-0000-0000-0000-000000000130',
        tenantId: DEMO_TENANT_ID,
        principalType: 'system',
        principalId: 'public_form',
        eventName: 'request.created',
        subjectType: 'request',
        subjectId: DEMO_REQUEST_IDS.lawnRequest,
        correlationId: 'seed',
      },
      {
        id: '00000000-0000-0000-0000-000000000131',
        tenantId: DEMO_TENANT_ID,
        principalType: 'system',
        principalId: 'public_form',
        eventName: 'request.created',
        subjectType: 'request',
        subjectId: DEMO_REQUEST_IDS.treeRequest,
        correlationId: 'seed',
      },
      {
        id: '00000000-0000-0000-0000-000000000132',
        tenantId: DEMO_TENANT_ID,
        principalType: 'system',
        principalId: 'public_form',
        eventName: 'request.created',
        subjectType: 'request',
        subjectId: DEMO_REQUEST_IDS.landscapeRequest,
        correlationId: 'seed',
      },
      // Quote created event
      {
        id: '00000000-0000-0000-0000-000000000140',
        tenantId: DEMO_TENANT_ID,
        principalType: 'internal',
        principalId: DEMO_USER_ID,
        eventName: 'quote.created',
        subjectType: 'quote',
        subjectId: DEMO_QUOTE_ID,
        correlationId: 'seed',
      },
    ]);
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
