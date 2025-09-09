import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schemas/index.js';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeout?: number;
  debug?: boolean;
}

/**
 * Creates a database connection using Drizzle ORM with PostgreSQL
 */
export function createDatabaseConnection(config: DatabaseConfig): PostgresJsDatabase<typeof schema> {
  // Create postgres client
  const client = postgres(config.connectionString, {
    max: config.maxConnections || 10,
    idle_timeout: config.idleTimeout || 20,
    debug: config.debug || false,
  });

  // Create Drizzle database instance
  const db = drizzle(client, { schema });

  return db;
}

/**
 * Creates a database connection from environment variables
 */
export function createDatabaseConnectionFromEnv(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return createDatabaseConnection({
    connectionString,
    maxConnections: process.env.DB_MAX_CONNECTIONS ? parseInt(process.env.DB_MAX_CONNECTIONS) : undefined,
    idleTimeout: process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT) : undefined,
    debug: process.env.NODE_ENV === 'development',
  });
}

/**
 * Close database connection
 */
export async function closeDatabaseConnection(db: PostgresJsDatabase<typeof schema>): Promise<void> {
  // Get the postgres client from Drizzle
  const client = (db as any)._.session.client;
  if (client && typeof client.end === 'function') {
    await client.end();
  }
}
