import { createApp } from './app.js';
import { env } from './config/env.js';
import { assertSafeDbRole, pool } from './db/pool.js';
import { log } from './lib/logger.js';
 
async function main() {
  await pool.query('SELECT 1').catch((e) => { throw new Error(`Cannot connect to PostgreSQL (${e.message}). Check DATABASE_URL and run "npm run db:migrate".`); });
  await assertSafeDbRole();
  const server = createApp().listen(env.PORT, () => log.info(`shivamStudio API listening on http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`));
 
  const shutdown = (signal: string) => {
    log.info(`${signal} received — shutting down`);
    server.close(() => pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
main().catch((e) => { log.error(e.message); process.exit(1); });