import pg from 'pg';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

async function reset() {
  const connectionString = process.env.DATABASE_URL ?? 'postgresql://fsa:fsa@localhost:5432/fsa';
  const pool = new pg.Pool({ connectionString });
  const db = drizzle(pool);

  console.log('Resetting database (truncating all tables)...');
  await db.execute(sql`TRUNCATE requests, properties, clients, service_items, service_categories, business_settings, audit_events, users, tenants CASCADE`);
  console.log('Reset complete.');

  await pool.end();
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
