/** In-app notifications: helpers other modules call inside their transaction + the user-facing list/read endpoints. */
import { Router } from 'express';
import { Query, orderBy } from '../db/query.js';
import type { Db } from '../db/pool.js';
import { idParam, requireRoles, tenantRoute } from '../lib/handlers.js';
import { notFound } from '../lib/errors.js';
import { Page, type Ctx } from '../lib/types.js';
import { listQuery, qbool } from '../lib/validation.js';
 
export type NotificationType = 'booking_confirmed' | 'booking_update' | 'event_reminder' | 'highlights_published' | 'gallery_published' | 'new_enquiry' | 'delivery_overdue' | 'system';
export interface NewNotification { type: NotificationType; title: string; body: string; link: string }
 
/** Inserts one notification per distinct user (null/undefined ids are ignored). */
export async function notify(db: Db, tenantId: string, userIds: (string | null | undefined)[], n: NewNotification) {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))];
  if (!ids.length) return;
  await db.query(
    `INSERT INTO notifications (tenant_id, user_id, type, title, body, link) SELECT $1, u, $2, $3, $4, $5 FROM unnest($6::uuid[]) AS u`,
    [tenantId, n.type, n.title.slice(0, 200), n.body.slice(0, 600), n.link, ids]);
}
export const adminUserIds = async (db: Db, tenantId: string) =>
  (await db.query<{ id: string }>(`SELECT id FROM users WHERE tenant_id = $1 AND role = 'studio_admin' AND status = 'active' AND deleted_at IS NULL`, [tenantId])).rows.map((r) => r.id);
export const clientUserId = async (db: Db, tenantId: string, clientId: string | null | undefined) =>
  clientId ? (await db.query<{ user_id: string | null }>('SELECT user_id FROM clients WHERE tenant_id = $1 AND id = $2', [tenantId, clientId])).rows[0]?.user_id ?? null : null;
export const photographerUserIds = async (db: Db, tenantId: string, photographerIds: string[]) =>
  photographerIds.length ? (await db.query<{ user_id: string | null }>('SELECT user_id FROM photographers WHERE tenant_id = $1 AND id = ANY($2::uuid[])', [tenantId, photographerIds])).rows.map((r) => r.user_id) : [];
 
const SELECT = `n.id, n.tenant_id AS "tenantId", n.user_id AS "userId", n.type, n.title, n.body, n.link, n.read, n.created_at AS "createdAt"`;
const query = listQuery.extend({ unread: qbool.optional() });
 
const service = {
  async list(ctx: Ctx, raw: unknown) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer', 'client');
    const p = query.parse(raw);
    const q = new Query().where('n.tenant_id = ? AND n.user_id = ?', ctx.tenantId, me.userId);   // only ever your own
    if (p.unread) q.raw('NOT n.read');
    const total = (await ctx.db.query<{ n: number }>(`SELECT count(*) AS n FROM notifications n ${q.whereSql}`, q.params)).rows[0].n;
    const sql = `SELECT ${SELECT} FROM notifications n ${q.whereSql} ${orderBy({ fields: { createdAt: 'n.created_at' }, default: 'createdAt', order: 'desc' }, 'createdAt', 'desc', 'n.id')} LIMIT ${q.p(p.pageSize)} OFFSET ${q.p((p.page - 1) * p.pageSize)}`;
    return new Page((await ctx.db.query(sql, q.params)).rows, total, p.page, p.pageSize);
  },
  async markRead(ctx: Ctx, id: string) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer', 'client');
    const r = await ctx.db.query(`UPDATE notifications n SET read = true WHERE n.id = $1 AND n.tenant_id = $2 AND n.user_id = $3 RETURNING ${SELECT}`, [id, ctx.tenantId, me.userId]);
    if (!r.rowCount) throw notFound('Notification');
    return r.rows[0];
  },
  async markAllRead(ctx: Ctx) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer', 'client');
    await ctx.db.query('UPDATE notifications SET read = true WHERE tenant_id = $1 AND user_id = $2 AND NOT read', [ctx.tenantId, me.userId]);
  },
};
 
export const notificationsRouter = Router();
notificationsRouter.get('/', tenantRoute((ctx, req) => service.list(ctx, req.query)));
notificationsRouter.post('/read-all', tenantRoute((ctx) => service.markAllRead(ctx)));
notificationsRouter.patch('/:id/read', tenantRoute((ctx, req) => service.markRead(ctx, idParam(req))));