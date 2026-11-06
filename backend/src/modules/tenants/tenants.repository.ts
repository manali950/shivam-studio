import type { Db } from '../../db/pool.js';
import { Query, orderBy, type SortSpec } from '../../db/query.js';
 
export interface Tenant {
  id: string; slug: string; name: string; status: 'active' | 'inactive' | 'trial'; planId: string; subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'cancelled';
  renewsAt: string | null; subdomain: string; customDomain: string | null; ownerName: string; ownerEmail: string; city: string; createdAt: string;
}
 
const SELECT = `t.id, t.slug, t.name, t.status, t.plan_id AS "planId", t.subscription_status AS "subscriptionStatus", t.renews_at AS "renewsAt", t.subdomain,
  t.custom_domain AS "customDomain", t.owner_name AS "ownerName", t.owner_email AS "ownerEmail", t.city, t.created_at AS "createdAt"`;
const SORT: SortSpec = { fields: { createdAt: 't.created_at', name: 't.name', slug: 't.slug', city: 't.city', status: 't.status' }, default: 'createdAt', order: 'desc' };
const COLS: Record<string, string> = {
  name: 'name', slug: 'slug', status: 'status', planId: 'plan_id', subscriptionStatus: 'subscription_status', renewsAt: 'renews_at', subdomain: 'subdomain',
  customDomain: 'custom_domain', ownerName: 'owner_name', ownerEmail: 'owner_email', city: 'city',
};
 
export const tenantsRepository = {
  async list(db: Db, build: (q: Query) => void, o: { sort?: string; order?: 'asc' | 'desc'; page: number; pageSize: number }) {
    const q = new Query().raw('t.deleted_at IS NULL');
    build(q);
    const total = (await db.query<{ n: number }>(`SELECT count(*) AS n FROM tenants t ${q.whereSql}`, q.params)).rows[0].n;
    const sql = `SELECT ${SELECT} FROM tenants t ${q.whereSql} ${orderBy(SORT, o.sort, o.order, 't.id')} LIMIT ${q.p(o.pageSize)} OFFSET ${q.p((o.page - 1) * o.pageSize)}`;
    return { items: (await db.query<Tenant>(sql, q.params)).rows, total };
  },
  async get(db: Db, id: string): Promise<Tenant | null> {
    return (await db.query<Tenant>(`SELECT ${SELECT} FROM tenants t WHERE t.id = $1 AND t.deleted_at IS NULL`, [id])).rows[0] ?? null;
  },
  async find(db: Db, build: (q: Query) => void): Promise<Tenant | null> {
    const q = new Query().raw('t.deleted_at IS NULL'); build(q);
    return (await db.query<Tenant>(`SELECT ${SELECT} FROM tenants t ${q.whereSql} LIMIT 1`, q.params)).rows[0] ?? null;
  },
  async insert(db: Db, v: Record<string, unknown>): Promise<string> {
    const q = new Query(); const cols: string[] = []; const phs: string[] = [];
    for (const [k, val] of Object.entries(v)) if (COLS[k] && val !== undefined) { cols.push(COLS[k]); phs.push(q.p(val)); }
    return (await db.query<{ id: string }>(`INSERT INTO tenants (${cols.join(', ')}) VALUES (${phs.join(', ')}) RETURNING id`, q.params)).rows[0].id;
  },
  async update(db: Db, id: string, v: Record<string, unknown>): Promise<boolean> {
    const q = new Query(); const sets: string[] = [];
    for (const [k, val] of Object.entries(v)) if (COLS[k] && val !== undefined) sets.push(`${COLS[k]} = ${q.p(val)}`);
    if (!sets.length) return true;
    return (await db.query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ${q.p(id)} AND deleted_at IS NULL`, q.params)).rowCount > 0;
  },
  async getConfig(db: Db, tenantId: string): Promise<Record<string, any> | null> {
    return (await db.query(
      `SELECT tenant_id AS "tenantId", branding, home, about, contact, social, footer, settings FROM tenant_configs WHERE tenant_id = $1`, [tenantId])).rows[0] ?? null;
  },
  async upsertConfig(db: Db, tenantId: string, sections: Record<string, unknown>) {
    const names = Object.keys(sections);
    const q = new Query(); const tenantPh = q.p(tenantId);
    const values = names.map((n) => `${q.p(JSON.stringify(sections[n]))}::jsonb`);
    await db.query(
      `INSERT INTO tenant_configs (tenant_id, ${names.join(', ')}) VALUES (${tenantPh}, ${values.join(', ')})
       ON CONFLICT (tenant_id) DO UPDATE SET ${names.map((n) => `${n} = EXCLUDED.${n}`).join(', ')}`, q.params);
  },
};