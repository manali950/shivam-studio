/** Loads database/seed.sql (demo data). Idempotent. Never run against production data. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DB_DIR, connect } from './_db.js';
 
if (process.env.NODE_ENV === 'production') { console.error('Refusing to load demo seed data in production.'); process.exit(1); }
const client = connect();
await client.connect();
try {
  await client.query(readFileSync(join(DB_DIR, 'seed.sql'), 'utf8'));
  const { rows } = await client.query<{ n: number }>(`SELECT set_config('app.system', 'on', false) AS s, (SELECT count(*) FROM tenants) AS n`);
  console.log(`Seed loaded — ${rows[0].n} studios. Demo password for every account: Demo@12345 (see README).`);
} catch (e) { console.error(`Seed failed: ${(e as Error).message}`); process.exit(1); }
finally { await client.end(); }