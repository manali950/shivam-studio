import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
 
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DB_DIR = join(ROOT, 'database');
export const MIGRATIONS_DIR = join(DB_DIR, 'migrations');
 
/** Migrations and seeding run as the OWNER role (MIGRATE_DATABASE_URL); the API itself uses the restricted DATABASE_URL. */
export function connect() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) { console.error('Set MIGRATE_DATABASE_URL (or DATABASE_URL) in backend/.env'); process.exit(1); }
  return new pg.Client({ connectionString: url });
}
export const migrationFiles = () => readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
export const readMigration = (f: string) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8');