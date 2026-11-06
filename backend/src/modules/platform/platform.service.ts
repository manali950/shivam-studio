/** Super-admin tools: platform statistics, subscription plans and global settings. Runs in the system scope. */
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { auditDb } from '../../lib/audit.js';
import { conflict, invalid, notFound } from '../../lib/errors.js';
import { resetMaintenanceCache } from '../../lib/handlers.js';
import type { Principal } from '../../lib/types.js';
import { email, reqText, stringList, uuid } from '../../lib/validation.js';
import { lastMonths } from '../analytics/analytics.service.js';
 
const PLAN = `id, name, price_monthly AS "priceMonthly", currency, max_photographers AS "maxPhotographers", max_storage_gb AS "maxStorageGb",
  max_bookings_per_month AS "maxBookingsPerMonth", features, status`;
const SETTINGS = `platform_name AS "platformName", support_email AS "supportEmail", base_domain AS "baseDomain", default_plan_id AS "defaultPlanId", trial_days AS "trialDays",
  allow_self_signup AS "allowSelfSignup", maintenance_mode AS "maintenanceMode", default_delivery_target_hours AS "defaultDeliveryTargetHours"`;
 
const planBody = z.object({
  name: reqText(60), priceMonthly: z.number().min(0).max(10_000_000), currency: z.enum(['INR', 'USD']), maxPhotographers: z.number().int().min(1).max(10_000),
  maxStorageGb: z.number().int().min(1).max(1_000_000), maxBookingsPerMonth: z.number().int().min(1).max(1_000_000), features: stringList(20, 120), status: z.enum(['active', 'archived']),
});
const PLAN_COLS: Record<string, string> = { name: 'name', priceMonthly: 'price_monthly', currency: 'currency', maxPhotographers: 'max_photographers', maxStorageGb: 'max_storage_gb', maxBookingsPerMonth: 'max_bookings_per_month', features: 'features', status: 'status' };
const settingsBody = z.object({
  platformName: reqText(80), supportEmail: email, baseDomain: z.string().trim().toLowerCase().max(253).regex(/^[a-z0-9.-]+$/, 'Enter a valid domain'), defaultPlanId: uuid,
  trialDays: z.number().int().min(0).max(365), allowSelfSignup: z.boolean(), maintenanceMode: z.boolean(), defaultDeliveryTargetHours: z.number().int().min(1).max(720),
}).partial();
const SETTING_COLS: Record<string, string> = {
  platformName: 'platform_name', supportEmail: 'support_email', baseDomain: 'base_domain', defaultPlanId: 'default_plan_id', trialDays: 'trial_days',
  allowSelfSignup: 'allow_self_signup', maintenanceMode: 'maintenance_mode', defaultDeliveryTargetHours: 'default_delivery_target_hours',
};
 
function sets(cols: Record<string, string>, input: Record<string, unknown>) {
  const params: unknown[] = []; const parts: string[] = [];
  for (const [k, v] of Object.entries(input)) if (cols[k] && v !== undefined) { params.push(v); parts.push(`${cols[k]} = $${params.length}`); }
  return { params, sql: parts.join(', ') };
}
 
export const platformService = {
  async stats(db: Db) {
    const n = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0].n;
    const t = (await db.query<{ total: number; active: number; inactive: number; trial: number }>(
      `SELECT count(*) AS total, count(*) FILTER (WHERE status = 'active') AS active, count(*) FILTER (WHERE status = 'inactive') AS inactive, count(*) FILTER (WHERE status = 'trial') AS trial
         FROM tenants WHERE deleted_at IS NULL`)).rows[0];
    const mrr = await n(`SELECT COALESCE(sum(p.price_monthly), 0) AS n FROM tenants t JOIN plans p ON p.id = t.plan_id WHERE t.deleted_at IS NULL AND t.subscription_status = 'active'`);
    const byPlan = (await db.query<{ planId: string; planName: string; count: number }>(
      `SELECT p.id AS "planId", p.name AS "planName", count(t.id) AS count FROM plans p LEFT JOIN tenants t ON t.plan_id = p.id AND t.deleted_at IS NULL GROUP BY p.id, p.name, p.price_monthly ORDER BY p.price_monthly`)).rows;
    const byTenant = (await db.query<{ tenantId: string; tenantName: string; bookings: number; customers: number }>(
      `SELECT t.id AS "tenantId", t.name AS "tenantName",
              (SELECT count(*) FROM bookings b WHERE b.tenant_id = t.id AND b.deleted_at IS NULL) AS bookings,
              (SELECT count(*) FROM clients c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL) AS customers
         FROM tenants t WHERE t.deleted_at IS NULL ORDER BY t.created_at`)).rows;
    const months = lastMonths(6);
    const signups = (await db.query<{ m: string; n: number }>(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS m, count(*) AS n FROM tenants WHERE deleted_at IS NULL AND created_at >= $1 GROUP BY 1`, [`${months[0].key}-01T00:00:00Z`])).rows;
    return {
      totalTenants: t.total, activeTenants: t.active, inactiveTenants: t.inactive, trialTenants: t.trial,
      totalCustomers: await n('SELECT count(*) AS n FROM clients WHERE deleted_at IS NULL'), totalBookings: await n('SELECT count(*) AS n FROM bookings WHERE deleted_at IS NULL'),
      totalPhotographers: await n('SELECT count(*) AS n FROM photographers WHERE deleted_at IS NULL'), monthlyRecurringRevenue: mrr,
      tenantsByPlan: byPlan, bookingsByTenant: byTenant, signups: months.map((m) => ({ month: m.label, tenants: signups.find((s) => s.m === m.key)?.n ?? 0 })),
    };
  },
 
  plans: {
    list: async (db: Db) => (await db.query(`SELECT ${PLAN} FROM plans ORDER BY price_monthly, name`)).rows,
    async create(db: Db, raw: unknown, me: Principal) {
      const input = planBody.partial().required({ name: true }).parse(raw);
      const entries = Object.entries(input).filter(([k, v]) => PLAN_COLS[k] && v !== undefined);
      const row = (await db.query<{ id: string }>(
        `INSERT INTO plans (${entries.map(([k]) => PLAN_COLS[k]).join(', ')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`, entries.map(([, v]) => v))).rows[0];
      await auditDb(db, { tenantId: null, userId: me.userId, action: 'create', entity: 'plan', entityId: row.id });
      return (await db.query(`SELECT ${PLAN} FROM plans WHERE id = $1`, [row.id])).rows[0];
    },
    async update(db: Db, id: string, raw: unknown, me: Principal) {
      const input = planBody.partial().parse(raw);
      const { params, sql } = sets(PLAN_COLS, input);
      if (sql) { params.push(id); if (!(await db.query(`UPDATE plans SET ${sql} WHERE id = $${params.length}`, params)).rowCount) throw notFound('Plan'); }
      const row = (await db.query(`SELECT ${PLAN} FROM plans WHERE id = $1`, [id])).rows[0] ?? (() => { throw notFound('Plan'); })();
      await auditDb(db, { tenantId: null, userId: me.userId, action: 'update', entity: 'plan', entityId: id, metadata: { fields: Object.keys(input) } });
      return row;
    },
    async remove(db: Db, id: string, me: Principal) {
      if ((await db.query('SELECT 1 FROM tenants WHERE plan_id = $1 AND deleted_at IS NULL', [id])).rowCount) throw conflict('This plan is assigned to studios. Archive it instead.');
      if (!(await db.query('DELETE FROM plans WHERE id = $1', [id])).rowCount) throw notFound('Plan');
      await auditDb(db, { tenantId: null, userId: me.userId, action: 'delete', entity: 'plan', entityId: id });
    },
  },
 
  getSettings: async (db: Db) => (await db.query(`SELECT ${SETTINGS} FROM platform_settings`)).rows[0],
  async updateSettings(db: Db, raw: unknown, me: Principal) {
    const input = settingsBody.parse(raw);
    if (input.defaultPlanId && !(await db.query(`SELECT 1 FROM plans WHERE id = $1 AND status = 'active'`, [input.defaultPlanId])).rowCount) throw invalid('Choose an active plan as the default.');
    const { params, sql } = sets(SETTING_COLS, input);
    if (sql) await db.query(`UPDATE platform_settings SET ${sql}`, params);
    resetMaintenanceCache();
    await auditDb(db, { tenantId: null, userId: me.userId, action: 'update', entity: 'platform_settings', metadata: { fields: Object.keys(input) } });
    return (await db.query(`SELECT ${SETTINGS} FROM platform_settings`)).rows[0];
  },
};