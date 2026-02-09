import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../../src/infra/db/schema.js';
import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/shared/config.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://fsa:fsa@localhost:5432/fsa';

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

export function getDb() {
  return db;
}

export function getPool() {
  return pool;
}

export async function truncateAll() {
  await db.execute(sql`TRUNCATE business_settings, audit_events, users, tenants CASCADE`);
}

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    DATABASE_URL,
    API_PORT: 0,
    NODE_ENV: 'test',
    AUTH_MODE: 'local',
    DEV_AUTH_TENANT_ID: '00000000-0000-0000-0000-000000000001',
    DEV_AUTH_USER_ID: '00000000-0000-0000-0000-000000000010',
    DEV_AUTH_ROLE: 'owner',
    ...overrides,
  };
}

export async function buildTestApp(configOverrides: Partial<AppConfig> = {}) {
  const config = makeConfig(configOverrides);
  const app = await createApp({ config, db });
  return app;
}
