import { loadConfig } from './shared/config.js';
import { createDb } from './infra/db/client.js';
import { createApp } from './app.js';
import { logger } from './shared/logging.js';

async function main() {
  const config = loadConfig();
  const db = createDb(config.DATABASE_URL);
  const app = await createApp({ config, db });

  await app.listen({ port: config.API_PORT, host: '0.0.0.0' });
  logger.info(`API listening on http://localhost:${config.API_PORT}`);
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start API');
  process.exit(1);
});
