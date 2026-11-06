import { requireStaff } from '../../lib/handlers.js';
import type { Ctx } from '../../lib/types.js';
import { todayIn } from '../../lib/validation.js';
import { getSettings } from '../tenants/config.js';
 
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Last `n` calendar months (UTC) oldest → newest, as { key: '2026-11', label: 'Nov' }. */
export function lastMonths(n: number) {
  const d = new Date(); d.setUTCDate(1);
  return Array.from({ length: n }, (_, i) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (n - 1 - i), 1));
    return { key: `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`, label: MONTHS[x.getUTCMonth()] };
  });
}
 
const STATUSES = ['enquiry', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected'] as const;
 
/** Studio dashboard numbers — all computed in SQL, always for the caller's own studio only. */
export const analyticsService = {
  async dashboard(ctx: Ctx) {
    requireStaff(ctx);
    const { db, tenantId } = ctx;
    const today = todayIn((await getSettings(db, tenantId)).business.timezone);
    const one = async <T,>(sql: string, params: unknown[] = [tenantId]) => (await db.query<T & Record<string, any>>(sql, params)).rows[0];
 
    const b = await one<{ bookings: number; pending: number; revenue: number; outstanding: number }>(
      `SELECT count(*) AS bookings, count(*) FILTER (WHERE status IN ('enquiry','pending')) AS pending, COALESCE(sum(paid_amount), 0) AS revenue,
              COALESCE(sum(GREATEST(amount - paid_amount, 0)) FILTER (WHERE status IN ('confirmed','completed')), 0) AS outstanding
         FROM bookings WHERE tenant_id = $1 AND deleted_at IS NULL`);
    const e = await one<{ upcoming: number; completed: number; pending_deliveries: number; done: number; submitted: number; published: number; delivered: number }>(
      `SELECT count(*) FILTER (WHERE date >= $2 AND status IN ('scheduled','in_progress')) AS upcoming,
              count(*) FILTER (WHERE status = 'completed') AS completed,
              count(*) FILTER (WHERE status = 'completed' AND delivery_status <> 'delivered') AS pending_deliveries,
              count(*) FILTER (WHERE status = 'completed' AND delivery_completed_at IS NOT NULL) AS done,
              count(*) FILTER (WHERE status = 'completed' AND delivery_highlights_submitted_at IS NOT NULL) AS submitted,
              count(*) FILTER (WHERE status = 'completed' AND delivery_highlights_published_at IS NOT NULL) AS published,
              count(*) FILTER (WHERE status = 'completed' AND delivery_status = 'delivered') AS delivered
         FROM events WHERE tenant_id = $1 AND deleted_at IS NULL`, [tenantId, today]);
    const clients = (await one<{ n: number }>('SELECT count(*) AS n FROM clients WHERE tenant_id = $1 AND deleted_at IS NULL')).n;
    const photographers = (await one<{ n: number }>(`SELECT count(*) AS n FROM photographers WHERE tenant_id = $1 AND deleted_at IS NULL AND status <> 'inactive'`)).n;
 
    const months = lastMonths(7);
    const byMonth = (await db.query<{ m: string; revenue: number; bookings: number }>(
      `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS m, COALESCE(sum(paid_amount), 0) AS revenue, count(*) AS bookings
         FROM bookings WHERE tenant_id = $1 AND deleted_at IS NULL AND created_at >= $2 GROUP BY 1`, [tenantId, `${months[0].key}-01T00:00:00Z`])).rows;
    const statusRows = (await db.query<{ status: string; n: number }>('SELECT status, count(*) AS n FROM bookings WHERE tenant_id = $1 AND deleted_at IS NULL GROUP BY 1', [tenantId])).rows;
    const byService = (await db.query<{ name: string; count: number; revenue: number }>(
      `SELECT s.name, count(b.id) AS count, COALESCE(sum(b.paid_amount), 0) AS revenue
         FROM services s JOIN bookings b ON b.tenant_id = s.tenant_id AND b.service_id = s.id AND b.deleted_at IS NULL AND b.status NOT IN ('cancelled','rejected')
        WHERE s.tenant_id = $1 AND s.deleted_at IS NULL GROUP BY s.id, s.name ORDER BY count DESC, s.name`, [tenantId])).rows;
    const load = (await db.query<{ photographerId: string; name: string; upcoming: number; completed: number }>(
      `SELECT p.id AS "photographerId", p.name,
              count(e.id) FILTER (WHERE e.date >= $2 AND e.status NOT IN ('completed','cancelled')) AS upcoming,
              count(e.id) FILTER (WHERE e.status = 'completed') AS completed
         FROM photographers p
         LEFT JOIN event_photographers ep ON ep.tenant_id = p.tenant_id AND ep.photographer_id = p.id
         LEFT JOIN events e ON e.tenant_id = ep.tenant_id AND e.id = ep.event_id AND e.deleted_at IS NULL
        WHERE p.tenant_id = $1 AND p.deleted_at IS NULL GROUP BY p.id, p.name ORDER BY p.name`, [tenantId, today])).rows;
 
    return {
      totals: {
        bookings: b.bookings, pendingEnquiries: b.pending, upcomingEvents: e.upcoming, completedEvents: e.completed, clients, photographers,
        revenue: b.revenue, outstanding: b.outstanding, pendingDeliveries: e.pending_deliveries,
      },
      revenueByMonth: months.map((m) => { const r = byMonth.find((x) => x.m === m.key); return { month: m.label, revenue: r?.revenue ?? 0, bookings: r?.bookings ?? 0 }; }),
      bookingsByStatus: STATUSES.map((status) => ({ status, count: statusRows.find((r) => r.status === status)?.n ?? 0 })),
      bookingsByService: byService,
      deliveryFunnel: [
        { label: 'Events completed', count: e.done }, { label: 'Highlights submitted', count: e.submitted },
        { label: 'Highlights published', count: e.published }, { label: 'Fully delivered', count: e.delivered },
      ],
      photographerLoad: load,
    };
  },
};