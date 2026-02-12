import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../../src/infra/db/schema.js';
import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { JwtVerifier } from '../../src/application/ports/jwt-verifier.js';

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
  await db.execute(sql`TRUNCATE visits, jobs, secure_link_tokens, quotes, message_outbox, requests, properties, clients, service_items, service_categories, business_settings, audit_events, users, tenants CASCADE`);
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
    NOTIFICATION_ENABLED: false,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_FROM: 'test@seedling.local',
    APP_BASE_URL: 'http://localhost:5173',
    SECURE_LINK_HMAC_SECRET: 'test-hmac-secret',
    COGNITO_USER_POOL_ID: '',
    COGNITO_CLIENT_ID: '',
    COGNITO_REGION: '',
    ...overrides,
  };
}

export async function buildTestApp(configOverrides: Partial<AppConfig> = {}, opts?: { jwtVerifier?: JwtVerifier }) {
  const config = makeConfig(configOverrides);
  const app = await createApp({ config, db, jwtVerifier: opts?.jwtVerifier });
  return app;
}
