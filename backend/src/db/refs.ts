import { invalid } from '../lib/errors.js';
import type { Db } from './pool.js';
 
/** Tables a request body may reference by id. A fixed whitelist — never interpolate anything else into SQL. */
const SOFT: Record<string, boolean> = { events: true, clients: true, photographers: true, services: true, packages: true, bookings: true, galleries: true };
export type RefTable = keyof typeof SOFT;
 
/** Validates that every referenced id exists in THIS studio (the composite FKs would also reject it, but with an unfriendly error). */
export async function assertRefs(db: Db, tenantId: string, table: RefTable, ids: (string | null | undefined)[], message: string): Promise<void> {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return;
  const { rows } = await db.query<{ n: number }>(`SELECT count(*) AS n FROM ${table} WHERE tenant_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL`, [tenantId, list]);
  if (rows[0].n !== list.length) throw invalid(message);
}
 
/** Next free slug for (tenant, table): "base", "base-2", "base-3"… Tables are code constants, not user input. */
export async function uniqueSlug(db: Db, table: 'photographers' | 'services' | 'blog_posts', tenantId: string, base: string, excludeId?: string): Promise<string> {
  const root = base || 'item';
  const { rows } = await db.query<{ slug: string }>(
    `SELECT slug FROM ${table} WHERE tenant_id = $1 AND deleted_at IS NULL AND (slug = $2 OR slug LIKE $3) AND ($4::uuid IS NULL OR id <> $4)`,
    [tenantId, root, `${root.replace(/[\\%_]/g, '\\$&')}-%`, excludeId ?? null]);
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}