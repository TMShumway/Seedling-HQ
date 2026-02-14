/**
 * seed-demo.ts — Rich demo seed data for showcasing the app.
 *
 * Run: pnpm --filter api run db:seed-demo
 * Prereqs: db:reset → db:push
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ID RANGE MAP  (all UUIDs share prefix 00000000-0000-0000-0000-)       │
 * │                                                                         │
 * │  Entity           seed-test.ts (E2E)      seed-demo.ts (Demo)          │
 * │  ───────────────  ────────────────────     ───────────────────────      │
 * │  Tenant           …0001 (shared)        …0001 (shared)             │
 * │  Users            …0010 – …0012         …0010 – …0014 (adds 2)    │
 * │  Categories       …0200 – …0202         …0200 – …0202 (shared)    │
 * │  Service items    …0300 – …0307         …0300 – …0307 (shared)    │
 * │  Clients          …0400 – …0402         …1400 – …1414             │
 * │  Properties       …0500 – …0502         …1500 – …1524             │
 * │  Requests         …0600 – …0602         …1600 – …1614             │
 * │  Quotes           …0700 – …0708         …1700 – …1753             │
 * │  Tokens           …0800 – …0801         …1800 – …1805             │
 * │  Jobs             …0900 – …0904         …1900 – …1933             │
 * │  Visits           …0950 – …0954         …2000 – …2044             │
 * │  Audit events     …0100 – …0171         …3000+                    │
 * │  Biz settings     (none)                …0050                      │
 * │                                                                     │
 * │  Rule: E2E uses 0xxx range. Demo uses 1xxx+ range.                 │
 * │  Shared: tenant, users 10-12, categories, service items.           │
 * │  The two scripts are safe to run independently or together.        │
 * └─────────────────────────────────────────────────────────────────────┘
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
  tenants, users, auditEvents, serviceCategories, serviceItems,
  clients, properties, requests, quotes, secureLinkTokens, jobs, visits,
  businessSettings,
} from './schema.js';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../../shared/password.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_PREFIX = '00000000-0000-0000-0000-';

/** Build a well-known UUID from a 12-char hex suffix */
function id(suffix: string): string {
  return `${UUID_PREFIX}${suffix.padStart(12, '0')}`;
}

/** Today at a given hour/minute in local time */
function getTodayAt(hour: number, minute: number): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** A date offset by `daysOffset` from today (negative = past) at the given hour/minute */
function getDateAt(daysOffset: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Add minutes to a date */
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// ─── IDs ──────────────────────────────────────────────────────────────────────

const T = id('000000000001'); // tenant

const USERS = {
  owner:  id('000000000010'),
  admin:  id('000000000011'),
  member: id('000000000012'),
  jake:   id('000000000013'),
  sam:    id('000000000014'),
};

const CATS = {
  lawnCare:    id('000000000200'),
  treeService: id('000000000201'),
  landscaping: id('000000000202'),
};

const SVC = {
  weeklyMowing:        id('000000000300'),
  edgingTrimming:      id('000000000301'),
  aeration:            id('000000000302'),
  treeTrimming:        id('000000000303'),
  treeRemoval:         id('000000000304'),
  mulchInstallation:   id('000000000305'),
  landscapeDesign:     id('000000000306'),
  shrubPlanting:       id('000000000307'),
};

// Client IDs: 1400–1414
function clientId(n: number) { return id(`000000001${(400 + n).toString()}`); }
// Property IDs: 1500–1524
function propId(n: number) { return id(`00000000${(1500 + n).toString()}`); }
// Request IDs: 1600–1614
function reqId(n: number) { return id(`00000000${(1600 + n).toString()}`); }
// Quote IDs: 1700–1739
function quoteId(n: number) { return id(`00000000${(1700 + n).toString()}`); }
// Token IDs: 1800–1805
function tokenId(n: number) { return id(`00000000${(1800 + n).toString()}`); }
// Job IDs: 1900–1929
function jobId(n: number) { return id(`00000000${(1900 + n).toString()}`); }
// Visit IDs: 2000–2049
function visitId(n: number) { return id(`00000000${(2000 + n).toString()}`); }
// Audit IDs: 3000+
function auditId(n: number) { return id(`00000000${(3000 + n).toString()}`); }

// ─── Line-item helper ─────────────────────────────────────────────────────────

interface LineItem {
  serviceItemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

function makeQuoteData(items: LineItem[], taxRate = 0.075) {
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tax = Math.round(subtotal * taxRate);
  return { lineItems: items, subtotal, tax, total: subtotal + tax };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seedDemo() {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://fsa:fsa@localhost:5432/fsa';
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  console.log('Seeding demo data...');

  // ── 1. Tenant ────────────────────────────────────────────────────────────
  await db.insert(tenants).values({
    id: T, slug: 'demo', name: 'Demo Business', status: 'active',
  }).onConflictDoUpdate({
    target: tenants.id,
    set: { name: 'Demo Business', slug: 'demo', status: 'active' },
  });

  // ── 2. Users (3 existing + 2 new members) ───────────────────────────────
  const pw = await hashPassword('password');
  const userRows = [
    { id: USERS.owner,  tenantId: T, email: 'owner@demo.local',  fullName: 'Demo Owner',    role: 'owner',  passwordHash: pw, status: 'active' },
    { id: USERS.admin,  tenantId: T, email: 'admin@demo.local',  fullName: 'Demo Admin',    role: 'admin',  passwordHash: pw, status: 'active' },
    { id: USERS.member, tenantId: T, email: 'member@demo.local', fullName: 'Demo Member',   role: 'member', passwordHash: pw, status: 'active' },
    { id: USERS.jake,   tenantId: T, email: 'jake@demo.local',   fullName: 'Jake Torres',   role: 'member', passwordHash: pw, status: 'active' },
    { id: USERS.sam,    tenantId: T, email: 'sam@demo.local',     fullName: 'Samantha Lee',  role: 'member', passwordHash: pw, status: 'active' },
  ];
  for (const u of userRows) {
    await db.insert(users).values(u).onConflictDoUpdate({
      target: users.id,
      set: { email: u.email, fullName: u.fullName, role: u.role, passwordHash: u.passwordHash, status: u.status },
    });
  }

  // ── 3. Business settings ────────────────────────────────────────────────
  const BS_ID = id('000000000050');
  const businessHoursData = {
    monday:    { open: '07:00', close: '18:00', closed: false },
    tuesday:   { open: '07:00', close: '18:00', closed: false },
    wednesday: { open: '07:00', close: '18:00', closed: false },
    thursday:  { open: '07:00', close: '18:00', closed: false },
    friday:    { open: '07:00', close: '18:00', closed: false },
    saturday:  { open: '08:00', close: '14:00', closed: false },
    sunday:    { open: null,    close: null,     closed: true  },
  };
  await db.insert(businessSettings).values({
    id: BS_ID,
    tenantId: T,
    phone: '(555) 987-6543',
    addressLine1: '100 Greenway Drive',
    addressLine2: 'Suite 4',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    timezone: 'America/Chicago',
    businessHours: businessHoursData,
    serviceArea: 'Springfield metro area and surrounding communities within 25 miles',
    defaultDurationMinutes: 60,
    description: 'Full-service landscaping and lawn care for residential and commercial properties.',
  }).onConflictDoUpdate({
    target: businessSettings.tenantId,
    set: {
      phone: '(555) 987-6543',
      addressLine1: '100 Greenway Drive',
      addressLine2: 'Suite 4',
      city: 'Springfield',
      state: 'IL',
      zip: '62701',
      timezone: 'America/Chicago',
      businessHours: businessHoursData,
      serviceArea: 'Springfield metro area and surrounding communities within 25 miles',
      defaultDurationMinutes: 60,
      description: 'Full-service landscaping and lawn care for residential and commercial properties.',
    },
  });

  // ── 4. Categories + service items (same as E2E seed, upsert) ────────────
  const catValues = [
    { id: CATS.lawnCare,    tenantId: T, name: 'Lawn Care',    description: 'Mowing, edging, and lawn maintenance', sortOrder: 0 },
    { id: CATS.treeService, tenantId: T, name: 'Tree Service', description: 'Trimming, removal, and stump grinding', sortOrder: 1 },
    { id: CATS.landscaping, tenantId: T, name: 'Landscaping',  description: 'Design, planting, and hardscaping',    sortOrder: 2 },
  ];
  for (const c of catValues) {
    await db.insert(serviceCategories).values(c).onConflictDoUpdate({
      target: serviceCategories.id,
      set: { name: c.name, description: c.description, sortOrder: c.sortOrder },
    });
  }

  const svcValues = [
    { id: SVC.weeklyMowing,      tenantId: T, categoryId: CATS.lawnCare,    name: 'Weekly Mowing',                  unitPrice: 4500,  unitType: 'per_visit', estimatedDurationMinutes: 45,   sortOrder: 0 },
    { id: SVC.edgingTrimming,    tenantId: T, categoryId: CATS.lawnCare,    name: 'Edging & Trimming',              unitPrice: 2500,  unitType: 'per_visit', estimatedDurationMinutes: 30,   sortOrder: 1 },
    { id: SVC.aeration,          tenantId: T, categoryId: CATS.lawnCare,    name: 'Aeration',                       unitPrice: 7500,  unitType: 'flat',      estimatedDurationMinutes: 60,   sortOrder: 2 },
    { id: SVC.treeTrimming,      tenantId: T, categoryId: CATS.treeService, name: 'Tree Trimming',                  unitPrice: 8500,  unitType: 'hourly',    estimatedDurationMinutes: 120,  sortOrder: 0 },
    { id: SVC.treeRemoval,       tenantId: T, categoryId: CATS.treeService, name: 'Tree Removal',                   unitPrice: 50000, unitType: 'flat',      estimatedDurationMinutes: 240,  sortOrder: 1 },
    { id: SVC.mulchInstallation, tenantId: T, categoryId: CATS.landscaping, name: 'Mulch Installation',             unitPrice: 350,   unitType: 'per_sqft',  estimatedDurationMinutes: null, sortOrder: 0 },
    { id: SVC.landscapeDesign,   tenantId: T, categoryId: CATS.landscaping, name: 'Landscape Design Consultation',  unitPrice: 15000, unitType: 'flat',      estimatedDurationMinutes: 90,   sortOrder: 1 },
    { id: SVC.shrubPlanting,     tenantId: T, categoryId: CATS.landscaping, name: 'Shrub Planting',                 unitPrice: 2500,  unitType: 'per_unit',  estimatedDurationMinutes: 30,   sortOrder: 2 },
  ];
  for (const s of svcValues) {
    await db.insert(serviceItems).values(s).onConflictDoUpdate({
      target: serviceItems.id,
      set: { name: s.name, unitPrice: s.unitPrice, unitType: s.unitType, estimatedDurationMinutes: s.estimatedDurationMinutes, sortOrder: s.sortOrder },
    });
  }

  // ── 5. Clients (15) + properties (25) ───────────────────────────────────
  const clientRows = [
    { id: clientId(0),  tenantId: T, firstName: 'Margaret',  lastName: 'Chen',       email: 'margaret.chen@example.com',    phone: '(555) 301-1001', company: null,                       notes: 'Prefers early morning visits',           tags: ['residential', 'weekly'] },
    { id: clientId(1),  tenantId: T, firstName: 'David',     lastName: 'Okafor',     email: 'david.okafor@example.com',     phone: '(555) 301-1002', company: 'Okafor Properties LLC',    notes: 'Manages three rental properties',        tags: ['commercial', 'monthly'] },
    { id: clientId(2),  tenantId: T, firstName: 'Lisa',      lastName: 'Ramirez',    email: 'lisa.ramirez@example.com',     phone: '(555) 301-1003', company: null,                       notes: null,                                     tags: ['residential'] },
    { id: clientId(3),  tenantId: T, firstName: 'Thomas',    lastName: 'Nguyen',     email: 'tom.nguyen@example.com',       phone: '(555) 301-1004', company: 'Nguyen Dental Office',     notes: 'Gate code: 4455',                        tags: ['commercial'] },
    { id: clientId(4),  tenantId: T, firstName: 'Sandra',    lastName: 'Williams',   email: 'sandra.w@example.com',         phone: '(555) 301-1005', company: null,                       notes: 'Has two dogs in backyard — call before entering', tags: ['residential', 'weekly'] },
    { id: clientId(5),  tenantId: T, firstName: 'Robert',    lastName: 'Garcia',     email: 'robert.garcia@example.com',    phone: '(555) 301-1006', company: 'Garcia Auto Body',         notes: 'Side entrance for equipment access',     tags: ['commercial', 'bi-weekly'] },
    { id: clientId(6),  tenantId: T, firstName: 'Jennifer',  lastName: 'Kim',        email: 'jennifer.kim@example.com',     phone: '(555) 301-1007', company: null,                       notes: null,                                     tags: ['residential'] },
    { id: clientId(7),  tenantId: T, firstName: 'Michael',   lastName: 'Thompson',   email: 'mthompson@example.com',        phone: '(555) 301-1008', company: 'Thompson & Associates',   notes: 'Large commercial lot, need crew of 2+',  tags: ['commercial', 'weekly'] },
    { id: clientId(8),  tenantId: T, firstName: 'Patricia',  lastName: 'Anderson',   email: 'p.anderson@example.com',       phone: '(555) 301-1009', company: null,                       notes: 'Corner lot with steep slope in back',     tags: ['residential', 'bi-weekly'] },
    { id: clientId(9),  tenantId: T, firstName: 'James',     lastName: 'Martinez',   email: 'james.m@example.com',          phone: '(555) 301-1010', company: null,                       notes: null,                                     tags: ['residential'] },
    { id: clientId(10), tenantId: T, firstName: 'Karen',     lastName: 'Brown',      email: 'karen.brown@example.com',      phone: '(555) 301-1011', company: 'Sunrise HOA',              notes: 'HOA common areas — 4 parcels',           tags: ['commercial', 'weekly'] },
    { id: clientId(11), tenantId: T, firstName: 'William',   lastName: 'Davis',      email: 'will.davis@example.com',       phone: '(555) 301-1012', company: null,                       notes: 'New construction, lots of debris still', tags: ['residential'] },
    { id: clientId(12), tenantId: T, firstName: 'Nancy',     lastName: 'Wilson',     email: 'nancy.wilson@example.com',     phone: '(555) 301-1013', company: null,                       notes: 'Elderly — prefers text over phone calls', tags: ['residential', 'weekly'] },
    { id: clientId(13), tenantId: T, firstName: 'Charles',   lastName: 'Taylor',     email: 'charlie.taylor@example.com',   phone: '(555) 301-1014', company: 'Taylor Realty Group',     notes: 'Multiple properties — seasonal cleanup',  tags: ['commercial', 'seasonal'] },
    { id: clientId(14), tenantId: T, firstName: 'Angela',    lastName: 'Robinson',   email: 'angela.r@example.com',         phone: '(555) 301-1015', company: null,                       notes: null,                                     tags: ['residential'] },
  ];
  for (const c of clientRows) {
    await db.insert(clients).values(c).onConflictDoUpdate({
      target: clients.id,
      set: { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, company: c.company, notes: c.notes, tags: c.tags },
    });
  }

  // 25 properties — some clients have 2
  const propRows = [
    { id: propId(0),  tenantId: T, clientId: clientId(0),  addressLine1: '210 Maple Lane',           addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62701', notes: '1/3 acre lot, fenced backyard' },
    { id: propId(1),  tenantId: T, clientId: clientId(1),  addressLine1: '800 Industrial Parkway',   addressLine2: 'Unit A',    city: 'Springfield', state: 'IL', zip: '62702', notes: 'Large commercial lot' },
    { id: propId(2),  tenantId: T, clientId: clientId(1),  addressLine1: '812 Industrial Parkway',   addressLine2: 'Unit B',    city: 'Springfield', state: 'IL', zip: '62702', notes: 'Adjacent lot, same mowing schedule' },
    { id: propId(3),  tenantId: T, clientId: clientId(2),  addressLine1: '45 Birch Court',           addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62703', notes: null },
    { id: propId(4),  tenantId: T, clientId: clientId(3),  addressLine1: '1200 Health Center Blvd',  addressLine2: 'Suite 100', city: 'Springfield', state: 'IL', zip: '62704', notes: 'Park in rear, dental office entrance on east side' },
    { id: propId(5),  tenantId: T, clientId: clientId(4),  addressLine1: '789 Sunset Drive',         addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62701', notes: 'Beware of dogs in yard' },
    { id: propId(6),  tenantId: T, clientId: clientId(5),  addressLine1: '350 Auto Mile Road',       addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62705', notes: 'Side entrance for equipment' },
    { id: propId(7),  tenantId: T, clientId: clientId(6),  addressLine1: '27 Cherry Blossom Way',    addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62701', notes: null },
    { id: propId(8),  tenantId: T, clientId: clientId(6),  addressLine1: '29 Cherry Blossom Way',    addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62701', notes: 'Rental property next door' },
    { id: propId(9),  tenantId: T, clientId: clientId(7),  addressLine1: '500 Commerce Center',      addressLine2: 'Floor 1',  city: 'Springfield', state: 'IL', zip: '62702', notes: 'Large campus, takes 2 hours' },
    { id: propId(10), tenantId: T, clientId: clientId(8),  addressLine1: '101 Hilltop Road',         addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62703', notes: 'Steep slope in rear' },
    { id: propId(11), tenantId: T, clientId: clientId(9),  addressLine1: '67 Pine Street',           addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62704', notes: null },
    { id: propId(12), tenantId: T, clientId: clientId(10), addressLine1: '1 Sunrise Circle',         addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62705', notes: 'HOA common area — zone A' },
    { id: propId(13), tenantId: T, clientId: clientId(10), addressLine1: '2 Sunrise Circle',         addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62705', notes: 'HOA common area — zone B' },
    { id: propId(14), tenantId: T, clientId: clientId(11), addressLine1: '450 New Build Lane',       addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62701', notes: 'New construction cleanup needed first' },
    { id: propId(15), tenantId: T, clientId: clientId(12), addressLine1: '88 Elm Street',            addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62703', notes: 'Elderly homeowner — be respectful of schedule' },
    { id: propId(16), tenantId: T, clientId: clientId(13), addressLine1: '600 Realty Row',           addressLine2: 'Office 1',  city: 'Springfield', state: 'IL', zip: '62702', notes: 'Realty office front landscaping' },
    { id: propId(17), tenantId: T, clientId: clientId(13), addressLine1: '620 Realty Row',           addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62702', notes: 'Vacant lot for sale — mow monthly' },
    { id: propId(18), tenantId: T, clientId: clientId(14), addressLine1: '333 Willow Lane',          addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62704', notes: null },
    { id: propId(19), tenantId: T, clientId: clientId(4),  addressLine1: '791 Sunset Drive',         addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62701', notes: 'Detached garage lot' },
    { id: propId(20), tenantId: T, clientId: clientId(7),  addressLine1: '510 Commerce Center',      addressLine2: 'Floor 2',  city: 'Springfield', state: 'IL', zip: '62702', notes: 'Upper campus section' },
    { id: propId(21), tenantId: T, clientId: clientId(9),  addressLine1: '69 Pine Street',           addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62704', notes: 'Rental next door' },
    { id: propId(22), tenantId: T, clientId: clientId(3),  addressLine1: '1210 Health Center Blvd',  addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62704', notes: 'Overflow parking lot landscaping' },
    { id: propId(23), tenantId: T, clientId: clientId(11), addressLine1: '452 New Build Lane',       addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62701', notes: 'Lot B — adjacent to main build' },
    { id: propId(24), tenantId: T, clientId: clientId(8),  addressLine1: '103 Hilltop Road',         addressLine2: null,        city: 'Springfield', state: 'IL', zip: '62703', notes: 'Side yard only' },
  ];
  for (const p of propRows) {
    await db.insert(properties).values(p).onConflictDoUpdate({
      target: properties.id,
      set: { clientId: p.clientId, addressLine1: p.addressLine1, addressLine2: p.addressLine2, city: p.city, state: p.state, zip: p.zip, notes: p.notes },
    });
  }

  // ── 6. Requests (15 total, 4 statuses) ──────────────────────────────────
  const reqRows = [
    // 5 × new
    { id: reqId(0), tenantId: T, source: 'public_form', clientName: 'Rachel Green',    clientEmail: 'rachel.g@example.com',    clientPhone: '(555) 400-0001', description: 'Need weekly mowing for a 1/2 acre residential lot. Front and backyard.', status: 'new' },
    { id: reqId(1), tenantId: T, source: 'public_form', clientName: 'Kevin Park',      clientEmail: 'kpark@example.com',       clientPhone: '(555) 400-0002', description: 'Three large oak trees need trimming before spring storms. One is leaning dangerously.', status: 'new' },
    { id: reqId(2), tenantId: T, source: 'public_form', clientName: 'Maria Santos',    clientEmail: 'msantos@example.com',     clientPhone: null,             description: 'Looking for a landscape design consultation for our new backyard patio area, roughly 1500 sqft.', status: 'new' },
    { id: reqId(3), tenantId: T, source: 'public_form', clientName: 'Derek Foster',    clientEmail: 'derek.f@example.com',     clientPhone: '(555) 400-0004', description: 'Commercial property needs bi-weekly lawn maintenance. About 2 acres total.', status: 'new' },
    { id: reqId(4), tenantId: T, source: 'public_form', clientName: 'Heather Long',    clientEmail: 'hlong@example.com',       clientPhone: '(555) 400-0005', description: 'Need aeration and overseeding for my front lawn before summer.', status: 'new' },
    // 3 × reviewed
    { id: reqId(5), tenantId: T, source: 'public_form', clientName: 'Brandon Scott',   clientEmail: 'bscott@example.com',      clientPhone: '(555) 400-0006', description: 'Stump grinding needed — two stumps in backyard from trees removed last year.', status: 'reviewed', assignedUserId: USERS.owner },
    { id: reqId(6), tenantId: T, source: 'public_form', clientName: 'Courtney Adams',  clientEmail: 'cadams@example.com',      clientPhone: '(555) 400-0007', description: 'Want to install mulch beds around the perimeter of my home. About 800 sqft total.', status: 'reviewed', assignedUserId: USERS.admin },
    { id: reqId(7), tenantId: T, source: 'public_form', clientName: 'Tyler Brooks',    clientEmail: 'tbrooks@example.com',     clientPhone: null,             description: 'HOA looking for a seasonal grounds maintenance contract — 6 common areas.', status: 'reviewed', assignedUserId: USERS.owner },
    // 4 × converted (linked to quotes below)
    { id: reqId(8),  tenantId: T, source: 'public_form', clientName: 'Margaret Chen',   clientEmail: 'margaret.chen@example.com', clientPhone: '(555) 301-1001', description: 'Weekly lawn service for my residential property on Maple Lane.',           status: 'converted' },
    { id: reqId(9),  tenantId: T, source: 'public_form', clientName: 'David Okafor',    clientEmail: 'david.okafor@example.com',  clientPhone: '(555) 301-1002', description: 'Need regular maintenance for two commercial properties on Industrial Pkwy.', status: 'converted' },
    { id: reqId(10), tenantId: T, source: 'public_form', clientName: 'Thomas Nguyen',   clientEmail: 'tom.nguyen@example.com',    clientPhone: '(555) 301-1004', description: 'Dental office landscaping — seasonal flower beds and mulch.',               status: 'converted' },
    { id: reqId(11), tenantId: T, source: 'public_form', clientName: 'Karen Brown',     clientEmail: 'karen.brown@example.com',   clientPhone: '(555) 301-1011', description: 'Sunrise HOA — need quote for maintaining common areas zones A and B.',     status: 'converted' },
    // 3 × declined
    { id: reqId(12), tenantId: T, source: 'public_form', clientName: 'Ethan Wright',    clientEmail: 'ewright@example.com',     clientPhone: '(555) 400-0013', description: 'Want full property redesign including pool landscaping.',  status: 'declined' },
    { id: reqId(13), tenantId: T, source: 'public_form', clientName: 'Olivia Harris',   clientEmail: 'oharris@example.com',     clientPhone: '(555) 400-0014', description: 'Need lawn care but property is 45 miles outside your area.', status: 'declined' },
    { id: reqId(14), tenantId: T, source: 'public_form', clientName: 'Nathan Price',    clientEmail: 'nprice@example.com',      clientPhone: null,             description: 'Looking for indoor plant maintenance only.',              status: 'declined' },
  ];
  for (const r of reqRows) {
    await db.insert(requests).values(r).onConflictDoUpdate({
      target: requests.id,
      set: { clientName: r.clientName, clientEmail: r.clientEmail, clientPhone: r.clientPhone, description: r.description, status: r.status },
    });
  }

  // ── 7. Quotes (40 total, 6 statuses) ────────────────────────────────────

  // Helper to upsert a quote
  async function upsertQuote(q: {
    id: string; clientId: string; propertyId: string; title: string;
    lineItems: LineItem[]; subtotal: number; tax: number; total: number;
    status: string; requestId?: string | null;
    sentAt?: Date | null; approvedAt?: Date | null; declinedAt?: Date | null; scheduledAt?: Date | null;
  }) {
    await db.insert(quotes).values({
      id: q.id, tenantId: T, requestId: q.requestId ?? null,
      clientId: q.clientId, propertyId: q.propertyId, title: q.title,
      lineItems: q.lineItems, subtotal: q.subtotal, tax: q.tax, total: q.total,
      status: q.status, sentAt: q.sentAt ?? null, approvedAt: q.approvedAt ?? null,
      declinedAt: q.declinedAt ?? null, scheduledAt: q.scheduledAt ?? null,
    }).onConflictDoUpdate({
      target: quotes.id,
      set: {
        title: q.title, lineItems: q.lineItems, subtotal: q.subtotal, tax: q.tax, total: q.total,
        status: q.status, sentAt: q.sentAt ?? null, approvedAt: q.approvedAt ?? null,
        declinedAt: q.declinedAt ?? null, scheduledAt: q.scheduledAt ?? null,
        requestId: q.requestId ?? null,
      },
    });
  }

  // ── 5 × draft ────
  const draftQuotes = [
    { id: quoteId(0), clientId: clientId(2),  propertyId: propId(3),  title: 'Lawn Mowing for Lisa Ramirez',
      ...makeQuoteData([{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }]),
      status: 'draft' },
    { id: quoteId(1), clientId: clientId(9),  propertyId: propId(11), title: 'Lawn Package for James Martinez',
      ...makeQuoteData([
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ]),
      status: 'draft' },
    { id: quoteId(2), clientId: clientId(14), propertyId: propId(18), title: 'Tree Trimming for Angela Robinson',
      ...makeQuoteData([{ serviceItemId: SVC.treeTrimming, description: 'Tree Trimming', quantity: 3, unitPrice: 8500, total: 25500 }]),
      status: 'draft' },
    { id: quoteId(3), clientId: clientId(11), propertyId: propId(14), title: 'Cleanup & Mulch for William Davis',
      ...makeQuoteData([
        { serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 300, unitPrice: 350, total: 105000 },
        { serviceItemId: SVC.shrubPlanting, description: 'Shrub Planting', quantity: 8, unitPrice: 2500, total: 20000 },
      ]),
      status: 'draft' },
    { id: quoteId(4), clientId: clientId(6),  propertyId: propId(7),  title: 'Landscape Design for Jennifer Kim',
      ...makeQuoteData([{ serviceItemId: SVC.landscapeDesign, description: 'Landscape Design Consultation', quantity: 1, unitPrice: 15000, total: 15000 }]),
      status: 'draft' },
  ];
  for (const q of draftQuotes) await upsertQuote(q);

  // ── 6 × sent (with secure link tokens) ────
  const sentQuotes = [
    { id: quoteId(5), clientId: clientId(0),  propertyId: propId(0),  title: 'Weekly Lawn Service for Margaret Chen',
      ...makeQuoteData([
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 4, unitPrice: 4500, total: 18000 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 4, unitPrice: 2500, total: 10000 },
      ]),
      status: 'sent', sentAt: getDateAt(-2, 10, 0), requestId: reqId(8) },
    { id: quoteId(6), clientId: clientId(3),  propertyId: propId(4),  title: 'Dental Office Landscaping for Thomas Nguyen',
      ...makeQuoteData([
        { serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 200, unitPrice: 350, total: 70000 },
        { serviceItemId: SVC.shrubPlanting, description: 'Shrub Planting', quantity: 12, unitPrice: 2500, total: 30000 },
      ]),
      status: 'sent', sentAt: getDateAt(-3, 14, 0), requestId: reqId(10) },
    { id: quoteId(7), clientId: clientId(8),  propertyId: propId(10), title: 'Bi-Weekly Mowing for Patricia Anderson',
      ...makeQuoteData([{ serviceItemId: SVC.weeklyMowing, description: 'Bi-Weekly Mowing', quantity: 2, unitPrice: 4500, total: 9000 }]),
      status: 'sent', sentAt: getDateAt(-1, 9, 0) },
    { id: quoteId(8), clientId: clientId(12), propertyId: propId(15), title: 'Weekly Mowing for Nancy Wilson',
      ...makeQuoteData([
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ]),
      status: 'sent', sentAt: getDateAt(-1, 11, 0) },
    { id: quoteId(9), clientId: clientId(5),  propertyId: propId(6),  title: 'Commercial Maintenance for Garcia Auto Body',
      ...makeQuoteData([
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
        { serviceItemId: SVC.shrubPlanting, description: 'Shrub Trimming', quantity: 6, unitPrice: 2500, total: 15000 },
      ]),
      status: 'sent', sentAt: getDateAt(-4, 15, 0) },
    { id: quoteId(10), clientId: clientId(13), propertyId: propId(16), title: 'Office Landscaping for Taylor Realty',
      ...makeQuoteData([
        { serviceItemId: SVC.landscapeDesign, description: 'Landscape Design Consultation', quantity: 1, unitPrice: 15000, total: 15000 },
        { serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 150, unitPrice: 350, total: 52500 },
      ]),
      status: 'sent', sentAt: getDateAt(-5, 8, 0) },
  ];
  for (const q of sentQuotes) await upsertQuote(q);

  // Secure link tokens for sent quotes
  const tokenHashes = [
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60001',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60002',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60003',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60004',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60005',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60006',
  ];
  for (let i = 0; i < 6; i++) {
    await db.insert(secureLinkTokens).values({
      id: tokenId(i), tenantId: T,
      tokenHash: tokenHashes[i], hashVersion: 'v1',
      subjectType: 'quote', subjectId: quoteId(5 + i),
      scopes: ['quote:read', 'quote:respond'],
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdByUserId: USERS.owner,
    }).onConflictDoUpdate({
      target: secureLinkTokens.id,
      set: { tokenHash: tokenHashes[i], subjectId: quoteId(5 + i), expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    });
  }

  // ── 5 × approved (ready to schedule) ────
  const approvedQuotes = [
    { id: quoteId(11), clientId: clientId(1),  propertyId: propId(1),  title: 'Commercial Mowing for Okafor Properties (Unit A)',
      ...makeQuoteData([{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 4, unitPrice: 4500, total: 18000 }]),
      status: 'approved', sentAt: getDateAt(-10, 9, 0), approvedAt: getDateAt(-8, 14, 0), requestId: reqId(9) },
    { id: quoteId(12), clientId: clientId(7),  propertyId: propId(9),  title: 'Campus Maintenance for Thompson & Associates',
      ...makeQuoteData([
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
        { serviceItemId: SVC.treeTrimming, description: 'Tree Trimming', quantity: 2, unitPrice: 8500, total: 17000 },
      ]),
      status: 'approved', sentAt: getDateAt(-7, 10, 0), approvedAt: getDateAt(-5, 16, 0) },
    { id: quoteId(13), clientId: clientId(4),  propertyId: propId(5),  title: 'Lawn & Aeration for Sandra Williams',
      ...makeQuoteData([
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 4, unitPrice: 4500, total: 18000 },
        { serviceItemId: SVC.aeration, description: 'Aeration', quantity: 1, unitPrice: 7500, total: 7500 },
      ]),
      status: 'approved', sentAt: getDateAt(-6, 11, 0), approvedAt: getDateAt(-4, 9, 0) },
    { id: quoteId(14), clientId: clientId(10), propertyId: propId(12), title: 'HOA Zone A Maintenance for Sunrise HOA',
      ...makeQuoteData([
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 4, unitPrice: 4500, total: 18000 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 4, unitPrice: 2500, total: 10000 },
        { serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 100, unitPrice: 350, total: 35000 },
      ]),
      status: 'approved', sentAt: getDateAt(-14, 8, 0), approvedAt: getDateAt(-10, 11, 0), requestId: reqId(11) },
    { id: quoteId(15), clientId: clientId(11), propertyId: propId(14), title: 'New Build Cleanup for William Davis',
      ...makeQuoteData([
        { serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 250, unitPrice: 350, total: 87500 },
        { serviceItemId: SVC.shrubPlanting, description: 'Shrub Planting', quantity: 15, unitPrice: 2500, total: 37500 },
      ]),
      status: 'approved', sentAt: getDateAt(-5, 10, 0), approvedAt: getDateAt(-3, 12, 0) },
  ];
  for (const q of approvedQuotes) await upsertQuote(q);

  // ── 3 × declined ────
  const declinedQuotes = [
    { id: quoteId(16), clientId: clientId(9),  propertyId: propId(11), title: 'Tree Removal for James Martinez',
      ...makeQuoteData([{ serviceItemId: SVC.treeRemoval, description: 'Tree Removal', quantity: 1, unitPrice: 50000, total: 50000 }]),
      status: 'declined', sentAt: getDateAt(-14, 10, 0), declinedAt: getDateAt(-12, 15, 0) },
    { id: quoteId(17), clientId: clientId(14), propertyId: propId(18), title: 'Full Landscaping for Angela Robinson',
      ...makeQuoteData([
        { serviceItemId: SVC.landscapeDesign, description: 'Landscape Design Consultation', quantity: 1, unitPrice: 15000, total: 15000 },
        { serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 400, unitPrice: 350, total: 140000 },
        { serviceItemId: SVC.shrubPlanting, description: 'Shrub Planting', quantity: 20, unitPrice: 2500, total: 50000 },
      ]),
      status: 'declined', sentAt: getDateAt(-21, 9, 0), declinedAt: getDateAt(-18, 10, 0) },
    { id: quoteId(18), clientId: clientId(6),  propertyId: propId(7),  title: 'Aeration for Jennifer Kim',
      ...makeQuoteData([{ serviceItemId: SVC.aeration, description: 'Aeration', quantity: 1, unitPrice: 7500, total: 7500 }]),
      status: 'declined', sentAt: getDateAt(-10, 14, 0), declinedAt: getDateAt(-9, 8, 0) },
  ];
  for (const q of declinedQuotes) await upsertQuote(q);

  // ── 1 × expired ────
  await upsertQuote({
    id: quoteId(19), clientId: clientId(8), propertyId: propId(10), title: 'Tree Trimming for Patricia Anderson',
    ...makeQuoteData([{ serviceItemId: SVC.treeTrimming, description: 'Tree Trimming', quantity: 2, unitPrice: 8500, total: 17000 }]),
    status: 'expired', sentAt: getDateAt(-30, 10, 0),
  });

  // ── 20 × scheduled (have jobs + visits — built below in jobs section) ────
  // Quotes 20–39 are scheduled, created with jobs/visits

  // ── 8. Jobs (30 total) + Visits (50 total) ─────────────────────────────
  // Track which quotes/jobs/visits to create together for consistency

  interface VisitDef {
    visitIdx: number;
    assignedUserId: string;
    scheduledStart: Date | null;
    durationMin: number;
    status: 'scheduled' | 'en_route' | 'started' | 'completed' | 'cancelled';
    notes: string | null;
    completedAt: Date | null;
  }

  interface JobDef {
    jobIdx: number;
    quoteIdx: number;
    clientIdx: number;
    propIdx: number;
    title: string;
    items: LineItem[];
    jobStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    requestId?: string | null;
    sentAt: Date;
    approvedAt: Date;
    scheduledAt: Date;
    visits: VisitDef[];
  }

  // ── Today visits per user ──

  const todayJobs: JobDef[] = [
    // ── Demo Owner (5 today) ──
    { jobIdx: 0, quoteIdx: 20, clientIdx: 0, propIdx: 0, title: 'Morning Mow — Margaret Chen',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'completed', sentAt: getDateAt(-10, 9, 0), approvedAt: getDateAt(-8, 14, 0), scheduledAt: getDateAt(-5, 10, 0),
      visits: [
        { visitIdx: 0, assignedUserId: USERS.owner, scheduledStart: getTodayAt(7, 0), durationMin: 45, status: 'completed', notes: 'Lawn was damp — took a bit longer. Left clippings bagged by the curb.', completedAt: getTodayAt(7, 55) },
      ] },
    { jobIdx: 1, quoteIdx: 21, clientIdx: 1, propIdx: 1, title: 'Commercial Mow — Okafor Unit A',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'completed', sentAt: getDateAt(-14, 9, 0), approvedAt: getDateAt(-12, 11, 0), scheduledAt: getDateAt(-7, 8, 0),
      visits: [
        { visitIdx: 1, assignedUserId: USERS.owner, scheduledStart: getTodayAt(9, 0), durationMin: 60, status: 'completed', notes: 'Trimmed around parking lot edges. Blew debris from sidewalks.', completedAt: getTodayAt(10, 5) },
      ] },
    { jobIdx: 2, quoteIdx: 22, clientIdx: 4, propIdx: 5, title: 'Lawn & Edge — Sandra Williams',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'in_progress', sentAt: getDateAt(-7, 10, 0), approvedAt: getDateAt(-5, 14, 0), scheduledAt: getDateAt(-3, 9, 0),
      visits: [
        { visitIdx: 2, assignedUserId: USERS.owner, scheduledStart: getTodayAt(11, 0), durationMin: 75, status: 'started', notes: null, completedAt: null },
      ] },
    { jobIdx: 3, quoteIdx: 23, clientIdx: 3, propIdx: 4, title: 'Landscaping — Nguyen Dental Office',
      items: [
        { serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 100, unitPrice: 350, total: 35000 },
        { serviceItemId: SVC.shrubPlanting, description: 'Shrub Planting', quantity: 6, unitPrice: 2500, total: 15000 },
      ],
      jobStatus: 'in_progress', sentAt: getDateAt(-10, 14, 0), approvedAt: getDateAt(-8, 9, 0), scheduledAt: getDateAt(-4, 11, 0),
      visits: [
        { visitIdx: 3, assignedUserId: USERS.owner, scheduledStart: getTodayAt(13, 30), durationMin: 120, status: 'en_route', notes: null, completedAt: null },
      ] },
    { jobIdx: 4, quoteIdx: 24, clientIdx: 12, propIdx: 15, title: 'Weekly Mow — Nancy Wilson',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-7, 11, 0), approvedAt: getDateAt(-5, 10, 0), scheduledAt: getDateAt(-3, 9, 0),
      visits: [
        { visitIdx: 4, assignedUserId: USERS.owner, scheduledStart: getTodayAt(15, 30), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
      ] },

    // ── Demo Admin (5 today) ──
    { jobIdx: 5, quoteIdx: 25, clientIdx: 7, propIdx: 9, title: 'Campus Mow — Thompson & Associates',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'completed', sentAt: getDateAt(-14, 10, 0), approvedAt: getDateAt(-12, 15, 0), scheduledAt: getDateAt(-7, 10, 0),
      visits: [
        { visitIdx: 5, assignedUserId: USERS.admin, scheduledStart: getTodayAt(7, 30), durationMin: 90, status: 'completed', notes: 'Full campus done. Noticed irrigation head broken near east building — flagged for client.', completedAt: getTodayAt(9, 10) },
      ] },
    { jobIdx: 6, quoteIdx: 26, clientIdx: 5, propIdx: 6, title: 'Maintenance — Garcia Auto Body',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'in_progress', sentAt: getDateAt(-10, 9, 0), approvedAt: getDateAt(-8, 11, 0), scheduledAt: getDateAt(-5, 8, 0),
      visits: [
        { visitIdx: 6, assignedUserId: USERS.admin, scheduledStart: getTodayAt(9, 30), durationMin: 60, status: 'started', notes: null, completedAt: null },
      ] },
    { jobIdx: 7, quoteIdx: 27, clientIdx: 10, propIdx: 12, title: 'HOA Zone A — Sunrise HOA',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'in_progress', sentAt: getDateAt(-14, 8, 0), approvedAt: getDateAt(-12, 10, 0), scheduledAt: getDateAt(-7, 9, 0),
      visits: [
        { visitIdx: 7, assignedUserId: USERS.admin, scheduledStart: getTodayAt(11, 30), durationMin: 60, status: 'en_route', notes: null, completedAt: null },
      ] },
    { jobIdx: 8, quoteIdx: 28, clientIdx: 10, propIdx: 13, title: 'HOA Zone B — Sunrise HOA',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-14, 8, 0), approvedAt: getDateAt(-12, 10, 0), scheduledAt: getDateAt(-7, 9, 0),
      visits: [
        { visitIdx: 8, assignedUserId: USERS.admin, scheduledStart: getTodayAt(13, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
      ] },
    { jobIdx: 9, quoteIdx: 29, clientIdx: 8, propIdx: 10, title: 'Bi-Weekly Mow — Patricia Anderson',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Bi-Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-10, 14, 0), approvedAt: getDateAt(-8, 9, 0), scheduledAt: getDateAt(-5, 10, 0),
      visits: [
        { visitIdx: 9, assignedUserId: USERS.admin, scheduledStart: getTodayAt(15, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
      ] },

    // ── Demo Member (5 today) ──
    { jobIdx: 10, quoteIdx: 30, clientIdx: 6, propIdx: 7, title: 'Mow & Edge — Jennifer Kim',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'completed', sentAt: getDateAt(-10, 10, 0), approvedAt: getDateAt(-8, 12, 0), scheduledAt: getDateAt(-5, 9, 0),
      visits: [
        { visitIdx: 10, assignedUserId: USERS.member, scheduledStart: getTodayAt(8, 0), durationMin: 60, status: 'completed', notes: 'Mowed front and back. Edged sidewalk and driveway.', completedAt: getTodayAt(9, 5) },
      ] },
    { jobIdx: 11, quoteIdx: 31, clientIdx: 9, propIdx: 11, title: 'Weekly Mow — James Martinez',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'completed', sentAt: getDateAt(-7, 9, 0), approvedAt: getDateAt(-5, 11, 0), scheduledAt: getDateAt(-3, 10, 0),
      visits: [
        { visitIdx: 11, assignedUserId: USERS.member, scheduledStart: getTodayAt(10, 0), durationMin: 45, status: 'completed', notes: 'Standard mow — no issues.', completedAt: getTodayAt(10, 50) },
      ] },
    { jobIdx: 12, quoteIdx: 32, clientIdx: 1, propIdx: 2, title: 'Commercial Mow — Okafor Unit B',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'in_progress', sentAt: getDateAt(-14, 11, 0), approvedAt: getDateAt(-12, 14, 0), scheduledAt: getDateAt(-7, 8, 0),
      visits: [
        { visitIdx: 12, assignedUserId: USERS.member, scheduledStart: getTodayAt(12, 0), durationMin: 60, status: 'started', notes: 'Started rear lot first — front lot next.', completedAt: null },
      ] },
    { jobIdx: 13, quoteIdx: 33, clientIdx: 14, propIdx: 18, title: 'Mow — Angela Robinson',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-5, 10, 0), approvedAt: getDateAt(-3, 14, 0), scheduledAt: getDateAt(-2, 9, 0),
      visits: [
        { visitIdx: 13, assignedUserId: USERS.member, scheduledStart: getTodayAt(14, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
      ] },
    { jobIdx: 14, quoteIdx: 34, clientIdx: 2, propIdx: 3, title: 'Mow — Lisa Ramirez',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-7, 14, 0), approvedAt: getDateAt(-5, 9, 0), scheduledAt: getDateAt(-3, 10, 0),
      visits: [
        { visitIdx: 14, assignedUserId: USERS.member, scheduledStart: getTodayAt(16, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
      ] },

    // ── Jake Torres (4 today) ──
    { jobIdx: 15, quoteIdx: 35, clientIdx: 13, propIdx: 16, title: 'Office Front — Taylor Realty',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'completed', sentAt: getDateAt(-10, 9, 0), approvedAt: getDateAt(-8, 11, 0), scheduledAt: getDateAt(-5, 8, 0),
      visits: [
        { visitIdx: 15, assignedUserId: USERS.jake, scheduledStart: getTodayAt(8, 30), durationMin: 60, status: 'completed', notes: 'Office frontage mowed and edged. Blew sidewalk clean.', completedAt: getTodayAt(9, 35) },
      ] },
    { jobIdx: 16, quoteIdx: 36, clientIdx: 13, propIdx: 17, title: 'Vacant Lot Mow — Taylor Realty',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Monthly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'in_progress', sentAt: getDateAt(-10, 9, 0), approvedAt: getDateAt(-8, 11, 0), scheduledAt: getDateAt(-5, 8, 0),
      visits: [
        { visitIdx: 16, assignedUserId: USERS.jake, scheduledStart: getTodayAt(10, 30), durationMin: 45, status: 'started', notes: null, completedAt: null },
      ] },
    { jobIdx: 17, quoteIdx: 37, clientIdx: 4, propIdx: 19, title: 'Garage Lot — Sandra Williams',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-7, 10, 0), approvedAt: getDateAt(-5, 14, 0), scheduledAt: getDateAt(-3, 9, 0),
      visits: [
        { visitIdx: 17, assignedUserId: USERS.jake, scheduledStart: getTodayAt(13, 0), durationMin: 30, status: 'scheduled', notes: null, completedAt: null },
      ] },
    { jobIdx: 18, quoteIdx: 38, clientIdx: 7, propIdx: 20, title: 'Upper Campus — Thompson & Associates',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'scheduled', sentAt: getDateAt(-14, 10, 0), approvedAt: getDateAt(-12, 15, 0), scheduledAt: getDateAt(-7, 10, 0),
      visits: [
        { visitIdx: 18, assignedUserId: USERS.jake, scheduledStart: getTodayAt(15, 0), durationMin: 90, status: 'scheduled', notes: null, completedAt: null },
      ] },

    // ── Samantha Lee (4 today) ──
    { jobIdx: 19, quoteIdx: 39, clientIdx: 8, propIdx: 24, title: 'Side Yard — Patricia Anderson',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Bi-Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'completed', sentAt: getDateAt(-10, 14, 0), approvedAt: getDateAt(-8, 9, 0), scheduledAt: getDateAt(-5, 10, 0),
      visits: [
        { visitIdx: 19, assignedUserId: USERS.sam, scheduledStart: getTodayAt(7, 0), durationMin: 30, status: 'completed', notes: 'Quick side yard mow. All clear.', completedAt: getTodayAt(7, 35) },
      ] },
  ];

  // Samantha's remaining 3 today visits need separate jobs
  const samRemainingJobs: JobDef[] = [
    { jobIdx: 20, quoteIdx: 20, clientIdx: 6, propIdx: 8, title: 'Rental Mow — Jennifer Kim (29 Cherry Blossom)',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'in_progress', sentAt: getDateAt(-10, 10, 0), approvedAt: getDateAt(-8, 12, 0), scheduledAt: getDateAt(-5, 9, 0),
      visits: [
        { visitIdx: 20, assignedUserId: USERS.sam, scheduledStart: getTodayAt(9, 0), durationMin: 45, status: 'en_route', notes: null, completedAt: null },
      ] },
    { jobIdx: 21, quoteIdx: 20, clientIdx: 9, propIdx: 21, title: 'Mow — James Martinez (Rental)',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-7, 9, 0), approvedAt: getDateAt(-5, 11, 0), scheduledAt: getDateAt(-3, 10, 0),
      visits: [
        { visitIdx: 21, assignedUserId: USERS.sam, scheduledStart: getTodayAt(11, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
      ] },
    { jobIdx: 22, quoteIdx: 20, clientIdx: 3, propIdx: 22, title: 'Parking Lot Landscaping — Nguyen Dental',
      items: [
        { serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 50, unitPrice: 350, total: 17500 },
        { serviceItemId: SVC.shrubPlanting, description: 'Shrub Planting', quantity: 4, unitPrice: 2500, total: 10000 },
      ],
      jobStatus: 'scheduled', sentAt: getDateAt(-10, 14, 0), approvedAt: getDateAt(-8, 9, 0), scheduledAt: getDateAt(-4, 11, 0),
      visits: [
        { visitIdx: 22, assignedUserId: USERS.sam, scheduledStart: getTodayAt(14, 0), durationMin: 120, status: 'scheduled', notes: null, completedAt: null },
      ] },
  ];

  // ── Past completed visits (12 visits, 1-4 weeks ago) ──
  const pastJobs: JobDef[] = [
    { jobIdx: 23, quoteIdx: 20, clientIdx: 0, propIdx: 0, title: 'Weekly Mow — Margaret Chen (Past)',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'completed', sentAt: getDateAt(-28, 9, 0), approvedAt: getDateAt(-26, 14, 0), scheduledAt: getDateAt(-21, 10, 0),
      visits: [
        { visitIdx: 23, assignedUserId: USERS.owner, scheduledStart: getDateAt(-21, 8, 0), durationMin: 45, status: 'completed', notes: 'Standard weekly mow.', completedAt: getDateAt(-21, 8, 50) },
        { visitIdx: 24, assignedUserId: USERS.owner, scheduledStart: getDateAt(-14, 8, 0), durationMin: 45, status: 'completed', notes: 'Mowed and edged front.', completedAt: getDateAt(-14, 8, 50) },
        { visitIdx: 25, assignedUserId: USERS.member, scheduledStart: getDateAt(-7, 8, 0), durationMin: 45, status: 'completed', notes: 'Covered for Demo Owner. All good.', completedAt: getDateAt(-7, 8, 55) },
      ] },
    { jobIdx: 24, quoteIdx: 20, clientIdx: 7, propIdx: 9, title: 'Campus Mow — Thompson (Past)',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'completed', sentAt: getDateAt(-28, 10, 0), approvedAt: getDateAt(-26, 15, 0), scheduledAt: getDateAt(-21, 10, 0),
      visits: [
        { visitIdx: 26, assignedUserId: USERS.admin, scheduledStart: getDateAt(-21, 9, 0), durationMin: 90, status: 'completed', notes: 'Full campus done.', completedAt: getDateAt(-21, 10, 35) },
        { visitIdx: 27, assignedUserId: USERS.admin, scheduledStart: getDateAt(-14, 9, 0), durationMin: 90, status: 'completed', notes: 'Trimmed hedges along east building as well.', completedAt: getDateAt(-14, 10, 40) },
        { visitIdx: 28, assignedUserId: USERS.jake, scheduledStart: getDateAt(-7, 9, 0), durationMin: 90, status: 'completed', notes: 'Covered for Demo Admin. All areas mowed.', completedAt: getDateAt(-7, 10, 30) },
      ] },
    { jobIdx: 25, quoteIdx: 20, clientIdx: 5, propIdx: 6, title: 'Commercial Maintenance — Garcia (Past)',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'completed', sentAt: getDateAt(-21, 9, 0), approvedAt: getDateAt(-19, 11, 0), scheduledAt: getDateAt(-14, 8, 0),
      visits: [
        { visitIdx: 29, assignedUserId: USERS.sam, scheduledStart: getDateAt(-14, 10, 0), durationMin: 45, status: 'completed', notes: 'Commercial lot done. Blew parking area clean.', completedAt: getDateAt(-14, 10, 50) },
        { visitIdx: 30, assignedUserId: USERS.sam, scheduledStart: getDateAt(-7, 10, 0), durationMin: 45, status: 'completed', notes: 'Routine mow. No issues.', completedAt: getDateAt(-7, 10, 50) },
      ] },
    { jobIdx: 26, quoteIdx: 20, clientIdx: 12, propIdx: 15, title: 'Weekly Mow — Nancy Wilson (Past)',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'completed', sentAt: getDateAt(-21, 11, 0), approvedAt: getDateAt(-19, 10, 0), scheduledAt: getDateAt(-14, 9, 0),
      visits: [
        { visitIdx: 31, assignedUserId: USERS.member, scheduledStart: getDateAt(-14, 14, 0), durationMin: 45, status: 'completed', notes: 'Mowed and tidied flower beds per request.', completedAt: getDateAt(-14, 14, 55) },
        { visitIdx: 32, assignedUserId: USERS.member, scheduledStart: getDateAt(-7, 14, 0), durationMin: 45, status: 'completed', notes: 'Standard visit.', completedAt: getDateAt(-7, 14, 50) },
      ] },
  ];

  // ── Future visits (8 visits, next 1-2 weeks) ──
  const futureJobs: JobDef[] = [
    { jobIdx: 27, quoteIdx: 20, clientIdx: 0, propIdx: 0, title: 'Weekly Mow — Margaret Chen (Next Week)',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-10, 9, 0), approvedAt: getDateAt(-8, 14, 0), scheduledAt: getDateAt(-5, 10, 0),
      visits: [
        { visitIdx: 33, assignedUserId: USERS.owner, scheduledStart: getDateAt(3, 8, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
        { visitIdx: 34, assignedUserId: USERS.owner, scheduledStart: getDateAt(10, 8, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
      ] },
    { jobIdx: 28, quoteIdx: 20, clientIdx: 7, propIdx: 9, title: 'Campus Mow — Thompson (Next Week)',
      items: [
        { serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 },
        { serviceItemId: SVC.edgingTrimming, description: 'Edging & Trimming', quantity: 1, unitPrice: 2500, total: 2500 },
      ],
      jobStatus: 'scheduled', sentAt: getDateAt(-14, 10, 0), approvedAt: getDateAt(-12, 15, 0), scheduledAt: getDateAt(-7, 10, 0),
      visits: [
        { visitIdx: 35, assignedUserId: USERS.admin, scheduledStart: getDateAt(4, 9, 0), durationMin: 90, status: 'scheduled', notes: null, completedAt: null },
        { visitIdx: 36, assignedUserId: USERS.jake, scheduledStart: getDateAt(11, 9, 0), durationMin: 90, status: 'scheduled', notes: null, completedAt: null },
      ] },
    { jobIdx: 29, quoteIdx: 20, clientIdx: 5, propIdx: 6, title: 'Commercial Maintenance — Garcia (Next)',
      items: [{ serviceItemId: SVC.weeklyMowing, description: 'Weekly Mowing', quantity: 1, unitPrice: 4500, total: 4500 }],
      jobStatus: 'scheduled', sentAt: getDateAt(-10, 9, 0), approvedAt: getDateAt(-8, 11, 0), scheduledAt: getDateAt(-5, 8, 0),
      visits: [
        { visitIdx: 37, assignedUserId: USERS.sam, scheduledStart: getDateAt(5, 10, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
        { visitIdx: 38, assignedUserId: USERS.member, scheduledStart: getDateAt(2, 14, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
        { visitIdx: 39, assignedUserId: USERS.jake, scheduledStart: getDateAt(8, 10, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
        { visitIdx: 40, assignedUserId: USERS.sam, scheduledStart: getDateAt(12, 10, 0), durationMin: 45, status: 'scheduled', notes: null, completedAt: null },
      ] },
  ];

  // ── Cancelled jobs (4 jobs, 4 visits) ──
  const cancelledJobs: JobDef[] = [
    { jobIdx: 30, quoteIdx: 20, clientIdx: 11, propIdx: 14, title: 'Cleanup — William Davis (Cancelled)',
      items: [{ serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 100, unitPrice: 350, total: 35000 }],
      jobStatus: 'cancelled', sentAt: getDateAt(-21, 10, 0), approvedAt: getDateAt(-19, 14, 0), scheduledAt: getDateAt(-14, 9, 0),
      visits: [
        { visitIdx: 41, assignedUserId: USERS.member, scheduledStart: getDateAt(-7, 9, 0), durationMin: 120, status: 'cancelled', notes: null, completedAt: null },
      ] },
    { jobIdx: 31, quoteIdx: 20, clientIdx: 11, propIdx: 23, title: 'Lot B Cleanup — William Davis (Cancelled)',
      items: [{ serviceItemId: SVC.mulchInstallation, description: 'Mulch Installation', quantity: 50, unitPrice: 350, total: 17500 }],
      jobStatus: 'cancelled', sentAt: getDateAt(-21, 10, 0), approvedAt: getDateAt(-19, 14, 0), scheduledAt: getDateAt(-14, 9, 0),
      visits: [
        { visitIdx: 42, assignedUserId: USERS.jake, scheduledStart: getDateAt(-7, 11, 0), durationMin: 90, status: 'cancelled', notes: null, completedAt: null },
      ] },
    { jobIdx: 32, quoteIdx: 20, clientIdx: 2, propIdx: 3, title: 'Aeration — Lisa Ramirez (Cancelled)',
      items: [{ serviceItemId: SVC.aeration, description: 'Aeration', quantity: 1, unitPrice: 7500, total: 7500 }],
      jobStatus: 'cancelled', sentAt: getDateAt(-14, 14, 0), approvedAt: getDateAt(-12, 9, 0), scheduledAt: getDateAt(-10, 10, 0),
      visits: [
        { visitIdx: 43, assignedUserId: USERS.sam, scheduledStart: getDateAt(-5, 13, 0), durationMin: 60, status: 'cancelled', notes: null, completedAt: null },
      ] },
    { jobIdx: 33, quoteIdx: 20, clientIdx: 14, propIdx: 18, title: 'Tree Trimming — Angela Robinson (Cancelled)',
      items: [{ serviceItemId: SVC.treeTrimming, description: 'Tree Trimming', quantity: 2, unitPrice: 8500, total: 17000 }],
      jobStatus: 'cancelled', sentAt: getDateAt(-10, 10, 0), approvedAt: getDateAt(-8, 15, 0), scheduledAt: getDateAt(-7, 8, 0),
      visits: [
        { visitIdx: 44, assignedUserId: USERS.owner, scheduledStart: getDateAt(-3, 10, 0), durationMin: 120, status: 'cancelled', notes: null, completedAt: null },
      ] },
  ];

  // Combine all job definitions
  const allJobDefs = [...todayJobs, ...samRemainingJobs, ...pastJobs, ...futureJobs, ...cancelledJobs];

  // Each jobDef needs its own unique quote (for the jobs_tenant_quote_unique constraint).
  // todayJobs (0-22) use quoteIdx 20-38; Sam's remaining use quoteIdx for new ones; past/future/cancelled share.
  // We'll create individual quotes per job, using the quoteIdx offset.

  // Build a global quote counter starting at 20
  let quoteCounter = 20;
  for (const jd of allJobDefs) {
    const qi = quoteCounter++;
    const qd = makeQuoteData(jd.items);

    // Upsert the quote
    await upsertQuote({
      id: quoteId(qi),
      clientId: clientId(jd.clientIdx),
      propertyId: propId(jd.propIdx),
      title: jd.title,
      lineItems: qd.lineItems, subtotal: qd.subtotal, tax: qd.tax, total: qd.total,
      status: 'scheduled',
      sentAt: jd.sentAt,
      approvedAt: jd.approvedAt,
      scheduledAt: jd.scheduledAt,
    });

    // Upsert the job
    await db.insert(jobs).values({
      id: jobId(jd.jobIdx),
      tenantId: T,
      quoteId: quoteId(qi),
      clientId: clientId(jd.clientIdx),
      propertyId: propId(jd.propIdx),
      title: jd.title,
      status: jd.jobStatus,
    }).onConflictDoUpdate({
      target: jobs.id,
      set: { title: jd.title, status: jd.jobStatus, quoteId: quoteId(qi) },
    });

    // Upsert visits
    for (const v of jd.visits) {
      const schedEnd = v.scheduledStart ? addMinutes(v.scheduledStart, v.durationMin) : null;
      await db.insert(visits).values({
        id: visitId(v.visitIdx),
        tenantId: T,
        jobId: jobId(jd.jobIdx),
        assignedUserId: v.assignedUserId,
        scheduledStart: v.scheduledStart,
        scheduledEnd: schedEnd,
        estimatedDurationMinutes: v.durationMin,
        status: v.status,
        notes: v.notes,
        completedAt: v.completedAt,
      }).onConflictDoUpdate({
        target: visits.id,
        set: {
          assignedUserId: v.assignedUserId,
          scheduledStart: v.scheduledStart,
          scheduledEnd: schedEnd,
          estimatedDurationMinutes: v.durationMin,
          status: v.status,
          notes: v.notes,
          completedAt: v.completedAt,
        },
      });
    }
  }

  // ── 9. Audit events (idempotent) ───────────────────────────────────────
  const demoAuditCheck = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(sql`${auditEvents.tenantId} = ${T} AND ${auditEvents.correlationId} = 'seed-demo'`);

  if (demoAuditCheck[0].count === 0) {
    const auditRows: Array<{
      id: string; tenantId: string; principalType: string; principalId: string;
      eventName: string; subjectType: string; subjectId: string; correlationId: string;
    }> = [];
    let ai = 0;

    // Client created events
    for (let i = 0; i < 15; i++) {
      auditRows.push({
        id: auditId(ai++), tenantId: T,
        principalType: 'internal', principalId: USERS.owner,
        eventName: 'client.created', subjectType: 'client', subjectId: clientId(i),
        correlationId: 'seed-demo',
      });
    }

    // Property created events
    for (let i = 0; i < 25; i++) {
      auditRows.push({
        id: auditId(ai++), tenantId: T,
        principalType: 'internal', principalId: USERS.owner,
        eventName: 'property.created', subjectType: 'property', subjectId: propId(i),
        correlationId: 'seed-demo',
      });
    }

    // Request created events
    for (let i = 0; i < 15; i++) {
      auditRows.push({
        id: auditId(ai++), tenantId: T,
        principalType: 'system', principalId: 'public_form',
        eventName: 'request.created', subjectType: 'request', subjectId: reqId(i),
        correlationId: 'seed-demo',
      });
    }

    // Quote created events (for all quotes)
    for (let i = 0; i < quoteCounter; i++) {
      auditRows.push({
        id: auditId(ai++), tenantId: T,
        principalType: 'internal', principalId: USERS.owner,
        eventName: 'quote.created', subjectType: 'quote', subjectId: quoteId(i),
        correlationId: 'seed-demo',
      });
    }

    // Job created events
    for (const jd of allJobDefs) {
      auditRows.push({
        id: auditId(ai++), tenantId: T,
        principalType: 'internal', principalId: USERS.owner,
        eventName: 'job.created', subjectType: 'job', subjectId: jobId(jd.jobIdx),
        correlationId: 'seed-demo',
      });
    }

    await db.insert(auditEvents).values(auditRows);
  }

  console.log('Demo seed complete.');
  console.log(`  Clients: 15 | Properties: 25 | Requests: 15`);
  console.log(`  Quotes: ${quoteCounter} | Jobs: ${allJobDefs.length} | Visits: ${allJobDefs.reduce((s, j) => s + j.visits.length, 0)}`);
  console.log(`  Today visits per user: Owner=5, Admin=5, Member=5, Jake=4, Sam=4`);
  await pool.end();
}

seedDemo().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
