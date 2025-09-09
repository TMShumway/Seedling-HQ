import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schemas/*',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5434/seedling_hq',
  },
  verbose: true,
  strict: true,
});
