import pg from 'pg';
import { env } from '../config/env.js';
import { log } from '../lib/logger.js';
 
// Return JSON-friendly values: numeric → number, bigint (count) → number, date → 'YYYY-MM-DD', timestamptz → ISO string.
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
 
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
pool.on('error', (e) => log.error('Unexpected idle PostgreSQL client error', { error: e.message }));
 
export interface Db {
  query<T = Record<string, any>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
}
 
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);
 
type Scope = { tenantId: string } | { system: true };
 
/**
 * Runs `fn` in ONE transaction with the row-level-security context set (see database/migrations/002_rls_and_grants.sql).
 *  - { tenantId }: only that studio's rows are visible/writable.
 *  - { system: true }: platform operations only (login, tenant resolution, super admin). Never derived from client input.
 * set_config(..., true) is transaction-local, so the context can never leak to another request on the pooled connection.
 */
export async function withScope<T>(scope: Scope, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if ('system' in scope) await client.query(`SELECT set_config('app.system', 'on', true)`);
    else {
      if (!isUuid(scope.tenantId)) throw new Error('withScope: invalid tenant id');
      await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [scope.tenantId]);
    }
    const result = await fn(client as unknown as Db);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
export const withTenantTx = <T>(tenantId: string, fn: (db: Db) => Promise<T>) => withScope({ tenantId }, fn);
export const withSystemTx = <T>(fn: (db: Db) => Promise<T>) => withScope({ system: true }, fn);
 
/** Startup safety check: a superuser / BYPASSRLS role silently disables tenant isolation at the database level. */
export async function assertSafeDbRole(): Promise<void> {
  const { rows } = await pool.query<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>(
    'SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
  const r = rows[0];
  if (r && (r.rolsuper || r.rolbypassrls)) {
    const msg = `Database role "${r.rolname}" is a superuser/BYPASSRLS role, so row-level tenant isolation is NOT enforced. Use the shivamstudio_app role (database/setup.sql).`;
    if (env.isProd) throw new Error(msg);
    log.warn(msg);
  }
}