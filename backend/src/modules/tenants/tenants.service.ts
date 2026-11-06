import { z } from 'zod';
import { env } from '../../config/env.js';
import type { Db } from '../../db/pool.js';
import { addSearch } from '../../db/query.js';
import { audit, auditDb } from '../../lib/audit.js';
import { AppError, conflict, forbidden, invalid, notFound } from '../../lib/errors.js';
import { requireStaff } from '../../lib/handlers.js';
import { hashPassword, randomPassword } from '../../lib/password.js';
import { Page, type Ctx, type Principal } from '../../lib/types.js';
import { dateOnly, email, listQuery, reqText, slugify, text, uuid } from '../../lib/validation.js';
import { adminUserIds, notify } from '../notifications.js';
import { SECTIONS, configSchemas, defaultConfig } from './config.js';
import { tenantsRepository as repo, type Tenant } from './tenants.repository.js';
 
const RESERVED = new Set(['platform', 'api', 'admin', 'www', 'app', 'portal', 'photographer', 'login', 'register', 'static', 'assets', 'tenants', 'studios', 'support', 'mail']);
const SLUG = /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/;
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
 
const slugField = z.string().trim().toLowerCase().transform(slugify).refine((s) => SLUG.test(s) && !RESERVED.has(s), 'This slug is reserved or invalid.');
const domainField = z.union([z.literal(''), z.null(), z.string().trim().toLowerCase().transform((s) => s.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '')).refine((s) => HOST.test(s), 'Enter a valid domain, e.g. studio.example.com')])
  .transform((v) => v || null);
 
const base = z.object({
  name: reqText(120, 'Enter the studio name'), slug: slugField, status: z.enum(['active', 'inactive', 'trial']), planId: uuid,
  subscriptionStatus: z.enum(['trialing', 'active', 'past_due', 'cancelled']), renewsAt: z.union([dateOnly, z.null()]), subdomain: slugField, customDomain: domainField,
  ownerName: reqText(100), ownerEmail: email, city: text(100),
});
const createSchema = base.partial().required({ name: true, slug: true, ownerName: true, ownerEmail: true });
const updateSchema = base.partial();
const listSchema = listQuery.extend({ status: z.enum(['active', 'inactive', 'trial']).optional() });
const resolveSchema = z.object({ host: z.string().trim().toLowerCase().max(255).optional(), slug: z.string().trim().toLowerCase().max(60).optional() });
const contactSchema = z.object({ name: reqText(100, 'Enter your name'), email, phone: z.string().trim().max(40).optional(), message: reqText(2000, 'Write a message') });
 
/** Everyone may see a studio's public identity; billing contact details are for super admins and the studio's own team. */
const view = (t: Tenant, p: Principal | null): Tenant => (p && (p.role === 'super_admin' || p.tenantId === t.id) ? t : { ...t, ownerEmail: '' });
 
const deepMerge = (target: any, patch: any): any => {
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;      // prototype-pollution guard
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) deepMerge(target[k], v);
    else if (v !== undefined) target[k] = v;
  }
  return target;
};
 
export const tenantsService = {
  /** Public. Resolves a studio from a custom domain, a platform subdomain (royal.shivamstudio.app, royal.localhost) or a dev slug. */
  async resolve(db: Db, raw: unknown, p: Principal | null) {
    const q = resolveSchema.parse(raw);
    if (q.slug) { const t = await repo.find(db, (w) => w.where('t.slug = ?', q.slug)); return t ? view(t, p) : null; }
    if (!q.host) return null;
    const host = q.host.replace(/:\d+$/, '').replace(/^www\./, '');
    const dbBase = (await db.query<{ b: string }>('SELECT base_domain AS b FROM platform_settings LIMIT 1')).rows[0]?.b?.toLowerCase();
    const bases = [...new Set([env.PLATFORM_BASE_DOMAIN, dbBase, 'localhost'].filter((b): b is string => !!b))];
    const sub = bases.map((b) => (host.endsWith(`.${b}`) ? host.slice(0, -b.length - 1) : null)).find((s) => s && !s.includes('.')) ?? null;
    const t = await repo.find(db, (w) => w.where('t.custom_domain = ? OR (?::text IS NOT NULL AND t.subdomain = ?::text)', host, sub, sub));
    return t ? view(t, p) : null;
  },
 
  async listPublic(db: Db, p: Principal | null) {
    if (!env.ENABLE_PUBLIC_TENANT_LIST) throw new AppError(404, 'NOT_FOUND', 'Route not found');
    return (await repo.list(db, () => undefined, { sort: 'name', order: 'asc', page: 1, pageSize: 500 })).items.map((t) => view(t, p));
  },
 
  async list(db: Db, raw: unknown) {
    const p = listSchema.parse(raw);
    const { items, total } = await repo.list(db, (q) => {
      if (p.status) q.where('t.status = ?', p.status);
      addSearch(q, p.search, ['t.name', 't.slug', 't.city', 't.owner_name']);
    }, { sort: p.sort, order: p.order, page: p.page, pageSize: p.pageSize });
    return new Page(items, total, p.page, p.pageSize);
  },
 
  async get(db: Db, id: string, p: Principal | null) { const t = await repo.get(db, id); if (!t) throw notFound('Studio'); return view(t, p); },
 
  /** Super admin: onboard a studio — tenant, default website content and the owner's admin account (random temporary password, shown once). */
  async create(db: Db, raw: unknown, me: Principal) {
    const input = createSchema.parse(raw);
    const settings = (await db.query<{ default_plan_id: string; trial_days: number }>('SELECT default_plan_id, trial_days FROM platform_settings LIMIT 1')).rows[0];
    const planId = input.planId ?? settings?.default_plan_id;
    if (!planId || !(await db.query(`SELECT 1 FROM plans WHERE id = $1 AND status = 'active'`, [planId])).rowCount) throw invalid('Choose an active subscription plan.');
    if (await repo.find(db, (w) => w.where('t.slug = ?', input.slug))) throw conflict('A studio with this slug already exists.');
    const trial = new Date(Date.now() + (settings?.trial_days ?? 14) * 86_400_000).toISOString().slice(0, 10);
    const id = await repo.insert(db, {
      name: input.name, slug: input.slug, status: input.status ?? 'trial', planId, subscriptionStatus: 'trialing', renewsAt: input.renewsAt ?? trial,
      subdomain: input.subdomain ?? input.slug, customDomain: input.customDomain ?? null, ownerName: input.ownerName, ownerEmail: input.ownerEmail, city: input.city ?? '',
    });
    await repo.upsertConfig(db, id, defaultConfig(input.name, input.city ?? '', input.ownerEmail));
    const temp = randomPassword();
    await db.query(`INSERT INTO users (tenant_id, role, name, email, password_hash) VALUES ($1,'studio_admin',$2,$3,$4)`, [id, input.ownerName, input.ownerEmail, await hashPassword(temp)]);
    await auditDb(db, { tenantId: id, userId: me.userId, action: 'create', entity: 'tenant', entityId: id });
    // The temporary password is returned exactly once and is never stored in plain text; the owner should change it after first sign-in.
    return { ...(await repo.get(db, id))!, ownerTemporaryPassword: temp };
  },
 
  async update(db: Db, id: string, raw: unknown, me: Principal) {
    const input = updateSchema.parse(raw);
    if (!(await repo.get(db, id))) throw notFound('Studio');
    if (input.planId && !(await db.query('SELECT 1 FROM plans WHERE id = $1', [input.planId])).rowCount) throw invalid('Choose a valid subscription plan.');
    await repo.update(db, id, input);
    await auditDb(db, { tenantId: id, userId: me.userId, action: 'update', entity: 'tenant', entityId: id, metadata: { fields: Object.keys(input) } });
    return (await repo.get(db, id))!;
  },
 
  async setStatus(db: Db, id: string, raw: unknown, me: Principal) {
    const { status } = z.object({ status: z.enum(['active', 'inactive', 'trial']) }).parse(raw);
    const t = (await repo.get(db, id)) ?? (() => { throw notFound('Studio'); })();
    await repo.update(db, id, { status, ...(status === 'active' && t.subscriptionStatus !== 'active' ? { subscriptionStatus: 'active' } : {}) });
    await auditDb(db, { tenantId: id, userId: me.userId, action: 'status', entity: 'tenant', entityId: id, metadata: { from: t.status, to: status } });
    return (await repo.get(db, id))!;
  },
 
  async getConfig(ctx: Ctx) {
    const cfg = (await repo.getConfig(ctx.db, ctx.tenantId)) ?? Promise.reject(notFound('Studio configuration'));
    const c = await cfg;
    // The tax / GST number is only for the studio's own team.
    if (!(ctx.principal && (ctx.principal.role === 'super_admin' || ctx.principal.tenantId === ctx.tenantId)) && c.settings?.business) c.settings = { ...c.settings, business: { ...c.settings.business, taxId: '' } };
    return c;
  },
 
  /** Partial update: each provided section is deep-merged into the stored one, then the WHOLE section is re-validated. */
  async updateConfig(ctx: Ctx, patch: unknown) {
    requireStaff(ctx);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw invalid('Send an object of configuration sections.');
    const current = (await repo.getConfig(ctx.db, ctx.tenantId)) ?? (() => { throw notFound('Studio configuration'); })();
    const next: Record<string, unknown> = {};
    for (const s of SECTIONS) {
      if ((patch as Record<string, unknown>)[s] === undefined) continue;
      if (typeof (patch as Record<string, unknown>)[s] !== 'object') throw invalid(`“${s}” must be an object.`);
      next[s] = configSchemas[s].parse(deepMerge(structuredClone(current[s] ?? {}), (patch as Record<string, unknown>)[s]));
    }
    if (Object.keys(next).length) await repo.upsertConfig(ctx.db, ctx.tenantId, next);
    await audit(ctx, 'update', 'tenant_config', ctx.tenantId, { sections: Object.keys(next) });
    return repo.getConfig(ctx.db, ctx.tenantId);
  },
 
  /** Public contact form → stored, and every studio admin is notified in-app. */
  async submitContact(ctx: Ctx, raw: unknown) {
    const t = (await ctx.db.query<{ status: string }>('SELECT status FROM tenants WHERE id = $1', [ctx.tenantId])).rows[0];
    if (t.status === 'inactive') throw forbidden('This studio is not accepting messages.', 'TENANT_INACTIVE');
    const m = contactSchema.parse(raw);
    await ctx.db.query('INSERT INTO contact_messages (tenant_id, name, email, phone, message) VALUES ($1,$2,$3,$4,$5)', [ctx.tenantId, m.name, m.email, m.phone ?? '', m.message]);
    await notify(ctx.db, ctx.tenantId, await adminUserIds(ctx.db, ctx.tenantId), { type: 'new_enquiry', title: `Message from ${m.name}`, body: m.message.slice(0, 140), link: '/admin/bookings' });
  },
};