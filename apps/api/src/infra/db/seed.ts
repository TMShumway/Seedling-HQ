import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { tenants, users, auditEvents, serviceCategories, serviceItems } from './schema.js';
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
    ]);
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
