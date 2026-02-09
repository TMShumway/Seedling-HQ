import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString });
  return drizzle(pool, { schema });
}

/** Query-compatible type that both `db` and `tx` (PgTransaction) satisfy. */
export type Database = NodePgDatabase<typeof schema>;
