/**
 * Generic tenant-scoped repository for the simple "one table = one resource" entities (photographers, services, packages,
 * testimonials, blog, videos, drive links, clients). Entities with joins/aggregates (bookings, events, galleries) have
 * hand-written repositories next to their module.
 *
 * Every statement filters on tenant_id (in addition to PostgreSQL row-level security) and on deleted_at when the table soft-deletes.
 */
import type { Db } from './pool.js';
import { Query, orderBy, type SortSpec } from './query.js';
 
export interface EntitySpec {
  table: string;
  /** API field → column. A field may be flagged `json` (stored as jsonb). */
  fields: Record<string, string | { col: string; json?: true }>;
  softDelete: boolean;
  sort: SortSpec;
}
 
const colOf = (f: string | { col: string }) => (typeof f === 'string' ? f : f.col);
const isJson = (f: string | { col: string; json?: true }) => typeof f !== 'string' && !!f.json;
 
export function createRepository<T extends { id: string }>(spec: EntitySpec) {
  const select = Object.entries(spec.fields).map(([k, f]) => `t.${colOf(f)} AS "${k}"`).join(', ');
  const alive = spec.softDelete ? ' AND t.deleted_at IS NULL' : '';
 
  function writeSet(values: Record<string, unknown>, q: Query) {
    const cols: string[] = []; const phs: string[] = [];
    for (const [k, v] of Object.entries(values)) {
      const f = spec.fields[k];
      if (!f || k === 'id' || k === 'tenantId' || v === undefined) continue;
      cols.push(colOf(f)); phs.push(isJson(f) ? `${q.p(JSON.stringify(v))}::jsonb` : q.p(v));
    }
    return { cols, phs };
  }
 
  return {
    spec,
    /** `build` receives the query so callers can add role scoping + filters (all parameterised). */
    async list(db: Db, tenantId: string, build: (q: Query) => void, opts: { sort?: string; order?: 'asc' | 'desc'; page: number; pageSize: number }) {
      const q = new Query();
      q.where('t.tenant_id = ?', tenantId);
      if (spec.softDelete) q.raw('t.deleted_at IS NULL');
      build(q);
      const total = (await db.query<{ n: number }>(`SELECT count(*) AS n FROM ${spec.table} t ${q.whereSql}`, q.params)).rows[0].n;
      const sql = `SELECT ${select} FROM ${spec.table} t ${q.whereSql} ${orderBy(spec.sort, opts.sort, opts.order, 't.id')} LIMIT ${q.p(opts.pageSize)} OFFSET ${q.p((opts.page - 1) * opts.pageSize)}`;
      return { items: (await db.query<T>(sql, q.params)).rows, total };
    },
    async get(db: Db, tenantId: string, id: string, build?: (q: Query) => void): Promise<T | null> {
      const q = new Query();
      q.where('t.tenant_id = ? AND t.id = ?', tenantId, id);
      if (spec.softDelete) q.raw('t.deleted_at IS NULL');
      build?.(q);
      return (await db.query<T>(`SELECT ${select} FROM ${spec.table} t ${q.whereSql}`, q.params)).rows[0] ?? null;
    },
    async insert(db: Db, tenantId: string, values: Record<string, unknown>): Promise<T> {
      const q = new Query();
      const tenantPh = q.p(tenantId);
      const { cols, phs } = writeSet(values, q);
      const sql = `INSERT INTO ${spec.table} (tenant_id${cols.length ? ', ' + cols.join(', ') : ''}) VALUES (${tenantPh}${phs.length ? ', ' + phs.join(', ') : ''}) RETURNING id`;
      const id = (await db.query<{ id: string }>(sql, q.params)).rows[0].id;
      return (await this.get(db, tenantId, id))!;
    },
    async update(db: Db, tenantId: string, id: string, values: Record<string, unknown>): Promise<T | null> {
      const q = new Query();
      const { cols, phs } = writeSet(values, q);
      if (!cols.length) return this.get(db, tenantId, id);
      const set = cols.map((c, i) => `${c} = ${phs[i]}`).join(', ');
      const sql = `UPDATE ${spec.table} t SET ${set} WHERE t.tenant_id = ${q.p(tenantId)} AND t.id = ${q.p(id)}${alive} RETURNING t.id`;
      const r = await db.query(sql, q.params);
      return r.rowCount ? this.get(db, tenantId, id) : null;
    },
    async remove(db: Db, tenantId: string, id: string): Promise<boolean> {
      const sql = spec.softDelete
        ? `UPDATE ${spec.table} t SET deleted_at = now() WHERE t.tenant_id = $1 AND t.id = $2 AND t.deleted_at IS NULL`
        : `DELETE FROM ${spec.table} t WHERE t.tenant_id = $1 AND t.id = $2`;
      return (await db.query(sql, [tenantId, id])).rowCount > 0;
    },
    /** Does a live row with this id exist in the tenant? (cross-reference validation) */
    async exists(db: Db, tenantId: string, id: string): Promise<boolean> {
      return (await db.query(`SELECT 1 FROM ${spec.table} t WHERE t.tenant_id = $1 AND t.id = $2${alive}`, [tenantId, id])).rowCount > 0;
    },
  };
}
export type Repository<T extends { id: string }> = ReturnType<typeof createRepository<T>>;