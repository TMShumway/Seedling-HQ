import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { tenants, users, auditEvents, businessSettings } from './schema.js';
import { sql } from 'drizzle-orm';

const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000010';
const DEMO_SETTINGS_ID = '00000000-0000-0000-0000-000000000020';

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

  // Upsert demo business settings
  const defaultBusinessHours = {
    monday: { open: '08:00', close: '17:00', closed: false },
    tuesday: { open: '08:00', close: '17:00', closed: false },
    wednesday: { open: '08:00', close: '17:00', closed: false },
    thursday: { open: '08:00', close: '17:00', closed: false },
    friday: { open: '08:00', close: '17:00', closed: false },
    saturday: { open: '09:00', close: '13:00', closed: false },
    sunday: { open: null, close: null, closed: true },
  };

  await db
    .insert(businessSettings)
    .values({
      id: DEMO_SETTINGS_ID,
      tenantId: DEMO_TENANT_ID,
      phone: '(555) 123-4567',
      addressLine1: '123 Main St',
      addressLine2: null,
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      timezone: 'America/Chicago',
      businessHours: defaultBusinessHours,
      serviceArea: 'Springfield and surrounding areas (30 mile radius)',
      defaultDurationMinutes: 60,
      description: 'Demo landscaping and lawn care business.',
    })
    .onConflictDoUpdate({
      target: businessSettings.tenantId,
      set: {
        phone: '(555) 123-4567',
        addressLine1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701',
        timezone: 'America/Chicago',
        businessHours: defaultBusinessHours,
        serviceArea: 'Springfield and surrounding areas (30 mile radius)',
        defaultDurationMinutes: 60,
        description: 'Demo landscaping and lawn care business.',
      },
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
    ]);
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
