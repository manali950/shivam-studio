/**
 * Applies database/migrations/*.sql in order, each in its own transaction, recording a checksum in schema_migrations.
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --reset DROP and recreate the public schema first (development only)
 */
import { createHash } from 'node:crypto';
import { connect, migrationFiles, readMigration } from './_db.js';
 
const reset = process.argv.includes('--reset');
if (reset && process.env.NODE_ENV === 'production') { console.error('Refusing to --reset in production.'); process.exit(1); }
 
const client = connect();
await client.connect();
try {
  if (reset) {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER; GRANT USAGE ON SCHEMA public TO PUBLIC;');
    console.log('Schema reset.');
  }
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const applied = new Map((await client.query<{ id: string; checksum: string }>('SELECT id, checksum FROM schema_migrations')).rows.map((r) => [r.id, r.checksum]));
  let count = 0;
  for (const file of migrationFiles()) {
    const sql = readMigration(file);
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) { console.error(`✗ ${file} was modified after being applied. Add a NEW migration instead of editing an applied one.`); process.exit(1); }
      continue;
    }
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [file, checksum]);
      await client.query('COMMIT');
      console.log(`✓ applied ${file}`); count++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`✗ ${file} failed: ${(e as Error).message}`); process.exit(1);
    }
  }
  console.log(count ? `${count} migration(s) applied.` : 'Database is up to date.');
} finally { await client.end(); }