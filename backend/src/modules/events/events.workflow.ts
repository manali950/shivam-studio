/** Shared event transitions used by several modules (bookings → event, completion, galleries → delivery). */
import { AppError } from '../../lib/errors.js';
import type { Ctx } from '../../lib/types.js';
import { clientUserId, notify } from '../notifications.js';
import { getSettings } from '../tenants/config.js';
import { eventsRepository, type StudioEvent } from './events.repository.js';
 
/** Creates the event for a confirmed booking (once), copying the team and the studio's delivery target. */
export async function createFromBooking(ctx: Ctx, bookingId: string): Promise<string> {
  const existing = await ctx.db.query<{ id: string }>('SELECT id FROM events WHERE tenant_id = $1 AND booking_id = $2 AND deleted_at IS NULL', [ctx.tenantId, bookingId]);
  if (existing.rowCount) return existing.rows[0].id;
  const b = (await ctx.db.query<{ client_id: string | null; customer_name: string; event_date: string; location: string; requirements: string; name: string | null; category: string | null; image_url: string | null }>(
    `SELECT b.client_id, b.customer_name, b.event_date, b.location, b.requirements, s.name, s.category, s.image_url
       FROM bookings b LEFT JOIN services s ON s.tenant_id = b.tenant_id AND s.id = b.service_id WHERE b.tenant_id = $1 AND b.id = $2`, [ctx.tenantId, bookingId])).rows[0];
  if (!b) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const settings = await getSettings(ctx.db, ctx.tenantId);
  const id = await eventsRepository.insert(ctx.db, ctx.tenantId, {
    bookingId, clientId: b.client_id, title: `${b.customer_name} — ${b.name ?? 'Photography'}`, type: b.category ?? 'event', date: b.event_date, startTime: '10:00',
    venue: b.location, city: '', description: b.requirements, status: 'scheduled', progress: 'planned', isPublic: false, coverUrl: b.image_url ?? '',
    deliveryTargetHours: settings.deliveryTargetHours,
  });
  const team = (await ctx.db.query<{ photographer_id: string }>('SELECT photographer_id FROM booking_photographers WHERE booking_id = $1 ORDER BY position', [bookingId])).rows.map((r) => r.photographer_id);
  await eventsRepository.setPhotographers(ctx.db, ctx.tenantId, id, team);
  return id;
}
 
/** Event finished shooting → enters the delivery workflow ("pending highlights"). Idempotent; never changes a clock-based status. */
export async function completeEvent(ctx: Ctx, e: Pick<StudioEvent, 'id' | 'title' | 'clientId' | 'delivery'>): Promise<void> {
  const changed = await eventsRepository.markCompleted(ctx.db, ctx.tenantId, e.id);
  if (changed)
    await notify(ctx.db, ctx.tenantId, [await clientUserId(ctx.db, ctx.tenantId, e.clientId)], {
      type: 'booking_update', title: 'Your event has been photographed', body: `${e.title} — your highlights will be ready within ${e.delivery.targetHours} hours.`, link: '/portal/events' });
}