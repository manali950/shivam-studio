import { addSearch, type Query } from '../../db/query.js';
import { assertRefs } from '../../db/refs.js';
import { audit } from '../../lib/audit.js';
import { conflict, forbidden, invalid, notFound } from '../../lib/errors.js';
import { isStaff, requireRoles, requireStaff } from '../../lib/handlers.js';
import { Page, type Ctx, type Principal } from '../../lib/types.js';
import { todayIn } from '../../lib/validation.js';
import { bookingsRepository } from '../bookings/bookings.repository.js';
import { notify, photographerUserIds } from '../notifications.js';
import { getSettings } from '../tenants/config.js';
import { eventsRepository as repo, type StudioEvent } from './events.repository.js';
import { completeEvent } from './events.workflow.js';
import { assignSchema, createEventSchema, deliverySchema, eventQuery, noteSchema, progressSchema, updateEventSchema } from './events.schemas.js';
 
/** Visibility: staff all · client their own · photographer only assigned · anonymous only public, completed events. */
function scope(ctx: Ctx, q: Query) {
  const p = ctx.principal;
  if (isStaff(p)) return;
  if (!p) q.raw(`e.is_public AND e.status = 'completed'`);
  else if (p.role === 'client') p.clientId ? q.where('e.client_id = ?', p.clientId) : q.raw('false');
  else if (p.role === 'photographer') p.photographerId ? q.where('EXISTS (SELECT 1 FROM event_photographers ep WHERE ep.event_id = e.id AND ep.photographer_id = ?)', p.photographerId) : q.raw('false');
}
 
/** Internal team notes are for staff and photographers only; anonymous visitors also never see booking/client ids. */
function present(ctx: Ctx, e: StudioEvent): StudioEvent {
  const p = ctx.principal;
  if (isStaff(p) || p?.role === 'photographer') return e;
  return { ...e, notes: [], ...(p ? {} : { clientId: null, bookingId: null }) };
}
 
const assertAssigned = (me: Principal, e: StudioEvent) => {
  if (me.role === 'photographer' && !e.photographerIds.includes(me.photographerId ?? '')) throw forbidden('You are not assigned to this event.');
};
 
async function load(ctx: Ctx, id: string): Promise<StudioEvent> {
  return (await repo.get(ctx.db, ctx.tenantId, id, (q) => scope(ctx, q))) ?? Promise.reject(notFound('Event'));
}
 
/** Replaces an event's team (and keeps the linked booking's team in sync), notifying newly assigned photographers. */
async function assignTeam(ctx: Ctx, e: StudioEvent, ids: string[]) {
  await assertRefs(ctx.db, ctx.tenantId, 'photographers', ids, 'One or more photographers do not belong to this studio.');
  const added = ids.filter((p) => !e.photographerIds.includes(p));
  await repo.setPhotographers(ctx.db, ctx.tenantId, e.id, ids);
  if (e.bookingId) await bookingsRepository.setPhotographers(ctx.db, ctx.tenantId, e.bookingId, ids);
  await notify(ctx.db, ctx.tenantId, await photographerUserIds(ctx.db, ctx.tenantId, added), { type: 'booking_update', title: `You were assigned to ${e.title}`, body: `${e.date} · ${e.venue}`, link: '/photographer/events' });
}
 
export const eventsService = {
  async list(ctx: Ctx, raw: unknown) {
    const p = eventQuery.parse(raw);
    const today = p.upcoming ? todayIn((await getSettings(ctx.db, ctx.tenantId)).business.timezone) : '';
    const { items, total } = await repo.list(ctx.db, ctx.tenantId, (q) => {
      scope(ctx, q);
      addSearch(q, p.search, ['e.title', 'e.venue', 'e.city', 'e.type']);
      if (p.status) q.where('e.status = ?', p.status);
      if (p.clientId) q.where('e.client_id = ?', p.clientId);
      if (p.isPublic !== undefined) q.where('e.is_public = ?', p.isPublic);
      if (p.photographerId) q.where('EXISTS (SELECT 1 FROM event_photographers ep WHERE ep.event_id = e.id AND ep.photographer_id = ?)', p.photographerId);
      if (p.delivery) q.where('e.delivery_status = ?', p.delivery);
      if (p.upcoming) q.where(`e.date >= ? AND e.status IN ('scheduled','in_progress')`, today);
    }, { sort: p.sort, order: p.order, page: p.page, pageSize: p.pageSize });
    return new Page(items.map((e) => present(ctx, e)), total, p.page, p.pageSize);
  },
 
  async get(ctx: Ctx, id: string) { return present(ctx, await load(ctx, id)); },
 
  async create(ctx: Ctx, body: unknown) {
    requireStaff(ctx);
    const input = createEventSchema.parse(body);
    await assertRefs(ctx.db, ctx.tenantId, 'bookings', [input.bookingId], 'Booking not found in this studio.');
    await assertRefs(ctx.db, ctx.tenantId, 'clients', [input.clientId], 'Client not found in this studio.');
    let clientId = input.clientId;
    if (!clientId && input.bookingId) clientId = (await bookingsRepository.get(ctx.db, ctx.tenantId, input.bookingId))?.clientId ?? null;
    const settings = await getSettings(ctx.db, ctx.tenantId);
    const { photographerIds, ...rest } = input;
    const id = await repo.insert(ctx.db, ctx.tenantId, { ...rest, clientId, deliveryTargetHours: settings.deliveryTargetHours });
    const created = (await repo.get(ctx.db, ctx.tenantId, id))!;
    if (photographerIds?.length) await assignTeam(ctx, created, photographerIds);
    await audit(ctx, 'create', 'event', id);
    return (await repo.get(ctx.db, ctx.tenantId, id))!;
  },
 
  async update(ctx: Ctx, id: string, body: unknown) {
    requireStaff(ctx);
    const e = (await repo.get(ctx.db, ctx.tenantId, id)) ?? (() => { throw notFound('Event'); })();
    const input = updateEventSchema.parse(body);
    if (input.status && e.status === 'completed') throw conflict('Completed events cannot change status.');
    await assertRefs(ctx.db, ctx.tenantId, 'bookings', [input.bookingId], 'Booking not found in this studio.');
    await assertRefs(ctx.db, ctx.tenantId, 'clients', [input.clientId], 'Client not found in this studio.');
    const { photographerIds, ...rest } = input;
    await repo.update(ctx.db, ctx.tenantId, id, rest);
    if (photographerIds) await assignTeam(ctx, e, photographerIds);
    await audit(ctx, 'update', 'event', id, { fields: Object.keys(input) });
    return (await repo.get(ctx.db, ctx.tenantId, id))!;
  },
 
  async remove(ctx: Ctx, id: string) {
    requireStaff(ctx);
    if (!(await repo.softDelete(ctx.db, ctx.tenantId, id))) throw notFound('Event');
    await audit(ctx, 'delete', 'event', id);
  },
 
  /** Photographer (assigned) or staff marks the shoot finished → delivery clock starts, client is told highlights are coming. */
  async complete(ctx: Ctx, id: string) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer');
    const e = await load(ctx, id); assertAssigned(me, e);
    if (e.status === 'cancelled') throw conflict('Cancelled events cannot be completed.');
    await completeEvent(ctx, e);
    await audit(ctx, 'complete', 'event', id);
    return (await repo.get(ctx.db, ctx.tenantId, id))!;
  },
 
  async updateProgress(ctx: Ctx, id: string, body: unknown) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer');
    const { progress } = progressSchema.parse(body);
    const e = await load(ctx, id); assertAssigned(me, e);
    if (progress === 'delivered') throw invalid('“Delivered” is set automatically when the complete gallery is published.');
    if (e.delivery.galleryPublishedAt) throw conflict('This event has already been delivered.');
    if (e.status === 'cancelled') throw conflict('Cancelled events cannot be updated.');
    await repo.update(ctx.db, ctx.tenantId, id, { progress, ...(progress === 'shooting' && e.status === 'scheduled' ? { status: 'in_progress' } : {}) });
    if (progress === 'wrapped' || progress === 'editing') await completeEvent(ctx, e);
    return (await repo.get(ctx.db, ctx.tenantId, id))!;
  },
 
  async assignPhotographers(ctx: Ctx, id: string, body: unknown) {
    requireStaff(ctx);
    const { photographerIds } = assignSchema.parse(body);
    const e = (await repo.get(ctx.db, ctx.tenantId, id)) ?? (() => { throw notFound('Event'); })();
    await assignTeam(ctx, e, photographerIds);
    await audit(ctx, 'assign', 'event', id, { photographerIds });
    return (await repo.get(ctx.db, ctx.tenantId, id))!;
  },
 
  async addNote(ctx: Ctx, id: string, body: unknown) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer');
    const { text } = noteSchema.parse(body);
    const e = await load(ctx, id); assertAssigned(me, e);
    return repo.addNote(ctx.db, ctx.tenantId, id, { userId: me.userId, name: me.name, role: me.role, text });
  },
 
  async updateDelivery(ctx: Ctx, id: string, body: unknown) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer');
    const patch = deliverySchema.parse(body);
    const e = await load(ctx, id); assertAssigned(me, e);
    await repo.update(ctx.db, ctx.tenantId, id, { deliveryTargetHours: patch.targetHours, deliveryNotes: patch.notes });
    await audit(ctx, 'delivery_settings', 'event', id, patch);
    return (await repo.get(ctx.db, ctx.tenantId, id))!;
  },
};