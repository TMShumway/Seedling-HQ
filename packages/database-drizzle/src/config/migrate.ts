import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabaseConnectionFromEnv, closeDatabaseConnection } from './connection.js';

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  console.log('🔄 Running database migrations...');
  
  const db = createDatabaseConnectionFromEnv();
  
  try {
    await migrate(db, { 
      migrationsFolder: './src/migrations',
    });
    
    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await closeDatabaseConnection(db);
  }
}

// Allow running migrations directly with: node dist/config/migrate.js
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}
