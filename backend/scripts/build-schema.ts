/** Regenerates database/schema.sql (a readable, single-file snapshot) from the migrations — migrations stay the source of truth. */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DB_DIR, migrationFiles, readMigration } from './_db.js';
 
const parts = migrationFiles().map((f) => `-- ============ ${f} ============\n${readMigration(f).trim()}\n`);
writeFileSync(join(DB_DIR, 'schema.sql'), `-- schema.sql — GENERATED snapshot of database/migrations/*.sql (run \`npm run db:schema\` after adding a migration).\n-- Fresh databases: prefer \`npm run db:migrate\`. This file is for reading, diffing and one-shot \`psql -f\` setups.\n\n${parts.join('\n')}`);
console.log(`schema.sql written from ${migrationFiles().length} migrations.`);