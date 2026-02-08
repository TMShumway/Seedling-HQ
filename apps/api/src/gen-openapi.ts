import { writeFileSync } from 'node:fs';
import { loadConfig } from './shared/config.js';
import { createDb } from './infra/db/client.js';
import { createApp } from './app.js';

async function main() {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);
  const app = await createApp({ config, db });
  await app.ready();

  const spec = app.swagger();
  const json = JSON.stringify(spec, null, 2);

  const outPath = process.argv[2] ?? 'openapi.json';
  writeFileSync(outPath, json);
  console.log(`OpenAPI spec written to ${outPath}`);

  await app.close();
}

main().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
