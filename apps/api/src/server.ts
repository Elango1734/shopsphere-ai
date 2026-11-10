import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { connectToDatabase, registerGracefulShutdown } from './db/connection.js';
import { logger } from './http/middleware/logger.js';

async function main() {
  const env = getEnv();
  await connectToDatabase();

  const app = createApp();
  const server = app.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT }, 'ShopSphere AI API listening');
  });

  registerGracefulShutdown();
  process.once('SIGTERM', () => server.close());
  process.once('SIGINT', () => server.close());
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', error);
  process.exit(1);
});
