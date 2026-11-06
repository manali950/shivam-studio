/**
 * Galleries and the next-day delivery workflow:
 *   event completed (event.complete) → photographer picks highlights (submitHighlights) → admin reviews and publishes highlights
 *   (client notified) → complete gallery published later (event becomes `delivered`).
 * A missed target time is informational only — nothing here ever marks a gallery delivered because a deadline passed.
 */
import { randomUUID } from 'node:crypto';
import { addSearch, type Query } from '../../db/query.js';
import { assertRefs } from '../../db/refs.js';
import { audit } from '../../lib/audit.js';
import { conflict, forbidden, invalid, notFound } from '../../lib/errors.js';
import { isStaff, requireRoles, requireStaff } from '../../lib/handlers.js';
import { isUuid } from '../../db/pool.js';
import { Page, type Ctx, type Principal } from '../../lib/types.js';
import { eventsRepository } from '../events/events.repository.js';
import { adminUserIds, clientUserId, notify } from '../notifications.js';
import { galleriesRepository as repo, type Gallery, type GallerySummary, type Viewer } from './galleries.repository.js';
import {
  addPhotosSchema, createGallerySchema, galleryQuery, linksSchema, portfolioQuery, publishSchema, reorderSchema, submitSchema, updateGallerySchema, updatePhotoSchema,
} from './galleries.schemas.js';
 
const viewerOf = (ctx: Ctx): Viewer => {
  const p = ctx.principal;
  return { staffLike: isStaff(p) || p?.role === 'photographer', clientId: p?.role === 'client' ? p.clientId : null };
};
 
/** Row visibility: staff all · photographer only galleries of events they shoot · client public + their own non-private · anonymous public only. */
function scope(ctx: Ctx, q: Query) {
  const p = ctx.principal;
  if (isStaff(p)) return;
  if (!p) return void q.raw(`g.visibility = 'public'`);
  if (p.role === 'photographer') return void (p.photographerId
    ? q.where('EXISTS (SELECT 1 FROM event_photographers ep WHERE ep.event_id = g.event_id AND ep.photographer_id = ?)', p.photographerId) : q.raw('false'));
  if (p.role === 'client' && p.clientId) return void q.where(`(g.visibility = 'public' OR (g.client_id = ? AND g.visibility <> 'private'))`, p.clientId);
  q.raw(`g.visibility = 'public'`);
}
 
async function load(ctx: Ctx, id: string): Promise<GallerySummary> {
  return (await repo.get(ctx.db, ctx.tenantId, id, viewerOf(ctx), (q) => scope(ctx, q))) ?? Promise.reject(notFound('Gallery'));
}
async function full(ctx: Ctx, id: string): Promise<Gallery> {
  const s = await load(ctx, id);
  return { ...s, photos: await repo.photos(ctx.db, ctx.tenantId, id, viewerOf(ctx)) };
}
const eventOf = async (ctx: Ctx, g: GallerySummary) => {
  const e = g.eventId ? await eventsRepository.get(ctx.db, ctx.tenantId, g.eventId) : null;
  if (!e) throw conflict('This gallery is not linked to an event.');
  return e;
};
/** Photographers add to a gallery only until the complete gallery is published; staff are never blocked. */
const assertCanEdit = (me: Principal, g: GallerySummary) => { if (me.role === 'photographer' && g.completePublishedAt) throw forbidden('This gallery is already delivered.'); };
 
export const galleriesService = {
  async list(ctx: Ctx, raw: unknown) {
    const p = galleryQuery.parse(raw);
    const { items, total } = await repo.list(ctx.db, ctx.tenantId, viewerOf(ctx), (q) => {
      scope(ctx, q);
      addSearch(q, p.search, ['g.title', 'g.description']);
      if (p.eventId) q.where('g.event_id = ?', p.eventId);
      if (p.clientId) q.where('g.client_id = ?', p.clientId);
      if (p.visibility) q.where('g.visibility = ?', p.visibility);
      if (p.status === 'highlights_pending') q.raw('g.highlights_published_at IS NULL');
      if (p.status === 'highlights_published') q.raw('g.highlights_published_at IS NOT NULL AND g.complete_published_at IS NULL');
      if (p.status === 'complete') q.raw('g.complete_published_at IS NOT NULL');
    }, { sort: p.sort, order: p.order, page: p.page, pageSize: p.pageSize });
    return new Page(items, total, p.page, p.pageSize);
  },
 
  async listByEvent(ctx: Ctx, eventId: string) {
    return (await repo.list(ctx.db, ctx.tenantId, viewerOf(ctx), (q) => { scope(ctx, q); q.where('g.event_id = ?', eventId); }, { sort: 'createdAt', order: 'asc', page: 1, pageSize: 100 })).items;
  },
 
  get: (ctx: Ctx, id: string) => full(ctx, id),
 
  async create(ctx: Ctx, body: unknown) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer');
    const input = createGallerySchema.parse(body);
    await assertRefs(ctx.db, ctx.tenantId, 'events', [input.eventId], 'Event not found in this studio.');
    await assertRefs(ctx.db, ctx.tenantId, 'clients', [input.clientId], 'Client not found in this studio.');
    const event = input.eventId ? await eventsRepository.get(ctx.db, ctx.tenantId, input.eventId) : null;
    if (me.role === 'photographer' && !(event && event.photographerIds.includes(me.photographerId ?? '')))
      throw forbidden('You can only create galleries for events you are assigned to.');
    const id = await repo.insert(ctx.db, ctx.tenantId, {
      title: input.title, description: input.description ?? '', eventId: event?.id ?? null, clientId: input.clientId ?? event?.clientId ?? null,
      visibility: input.visibility ?? 'client', coverUrl: input.coverUrl ?? '',
    });
    if (input.externalLinks?.length) await repo.replaceLinks(ctx.db, ctx.tenantId, id, input.externalLinks.map((l) => ({ label: l.label, url: l.url })));
    await audit(ctx, 'create', 'gallery', id);
    return full(ctx, id);
  },
 
  async update(ctx: Ctx, id: string, body: unknown) {
    requireStaff(ctx);
    await load(ctx, id);
    const input = updateGallerySchema.parse(body);
    await assertRefs(ctx.db, ctx.tenantId, 'events', [input.eventId], 'Event not found in this studio.');
    await assertRefs(ctx.db, ctx.tenantId, 'clients', [input.clientId], 'Client not found in this studio.');
    const { externalLinks, ...fields } = input;
    await repo.update(ctx.db, ctx.tenantId, id, fields);
    if (externalLinks) await repo.replaceLinks(ctx.db, ctx.tenantId, id, externalLinks.map((l) => ({ label: l.label, url: l.url })));
    await repo.touch(ctx.db, ctx.tenantId, id);
    await audit(ctx, 'update', 'gallery', id, { fields: Object.keys(input) });
    return full(ctx, id);
  },
 
  async remove(ctx: Ctx, id: string) {
    requireStaff(ctx);
    await load(ctx, id);
    await repo.softDelete(ctx.db, ctx.tenantId, id);
    await audit(ctx, 'delete', 'gallery', id);
  },
 
  async addPhotos(ctx: Ctx, id: string, body: unknown) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer');
    const g = await load(ctx, id); assertCanEdit(me, g);
    const { photos } = addPhotosSchema.parse(body);
    await repo.addPhotos(ctx.db, ctx.tenantId, id, photos);
    await repo.touch(ctx.db, ctx.tenantId, id);
    await audit(ctx, 'add_photos', 'gallery', id, { count: photos.length });
    return full(ctx, id);
  },
 
  async updatePhoto(ctx: Ctx, id: string, photoId: string, body: unknown) {
    requireStaff(ctx);
    await load(ctx, id);
    const patch = updatePhotoSchema.parse(body);
    if (!(await repo.updatePhoto(ctx.db, ctx.tenantId, id, photoId, patch))) throw notFound('Photo');
    await repo.touch(ctx.db, ctx.tenantId, id);
    return full(ctx, id);
  },
 
  async removePhoto(ctx: Ctx, id: string, photoId: string) {
    requireStaff(ctx);
    await load(ctx, id);
    if (!(await repo.removePhoto(ctx.db, ctx.tenantId, id, photoId))) throw notFound('Photo');
    await repo.touch(ctx.db, ctx.tenantId, id);
    await audit(ctx, 'remove_photo', 'gallery', id, { photoId });
  },
 
  async reorderPhotos(ctx: Ctx, id: string, body: unknown) {
    requireStaff(ctx);
    await load(ctx, id);
    const { photoIds } = reorderSchema.parse(body);
    await repo.reorder(ctx.db, ctx.tenantId, id, photoIds);
    await repo.touch(ctx.db, ctx.tenantId, id);
    return full(ctx, id);
  },
 
  async setExternalLinks(ctx: Ctx, id: string, body: unknown) {
    const me = requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer');
    const g = await load(ctx, id); assertCanEdit(me, g);
    const { links } = linksSchema.parse(body);
    await repo.replaceLinks(ctx.db, ctx.tenantId, id, links.map((l) => ({ id: l.id && isUuid(l.id) ? l.id : randomUUID(), label: l.label, url: l.url })));
    await repo.touch(ctx.db, ctx.tenantId, id);
    await audit(ctx, 'set_links', 'gallery', id, { count: links.length });
    return full(ctx, id);
  },
 
  /** Step 2: photographer (or admin) submits the chosen highlights for review. */
  async submitHighlights(ctx: Ctx, id: string, body: unknown) {
    requireRoles(ctx, 'studio_admin', 'super_admin', 'photographer');
    const { photoIds, note } = submitSchema.parse(body);
    const g = await load(ctx, id);
    await repo.lock(ctx.db, ctx.tenantId, id);
    const e = await eventOf(ctx, g);
    if (!e.delivery.completedAt) throw conflict('Mark the event completed before submitting highlights.');
    if (g.highlightsPublishedAt) throw conflict('Highlights are already published. Publish the complete gallery next.');
    if (photoIds.length === 0) throw invalid('Select at least one highlight photograph.');
    if (new Set(photoIds).size !== photoIds.length || (await repo.photoIdsIn(ctx.db, ctx.tenantId, id, photoIds)) !== photoIds.length)
      throw invalid('Some selected photos do not belong to this gallery.');
    await repo.setHighlights(ctx.db, ctx.tenantId, id, photoIds);
    await eventsRepository.markHighlightsSubmitted(ctx.db, ctx.tenantId, e.id, note);
    await notify(ctx.db, ctx.tenantId, await adminUserIds(ctx.db, ctx.tenantId), { type: 'system', title: 'Highlights ready for review', body: `${e.title}: ${photoIds.length} highlight photographs submitted.`, link: '/admin/delivery' });
    await audit(ctx, 'submit_highlights', 'gallery', id, { count: photoIds.length });
    return full(ctx, id);
  },
 
  /** Steps 3–5: admin publishes highlights (client notified) and, later, the complete gallery. Re-publishing is a no-op. */
  async publish(ctx: Ctx, id: string, body: unknown) {
    requireStaff(ctx);
    const { stage } = publishSchema.parse(body);
    const g = await load(ctx, id);
    await repo.lock(ctx.db, ctx.tenantId, id);
    const e = await eventOf(ctx, g);
    const counts = await repo.counts(ctx.db, ctx.tenantId, id);
    const clientUser = await clientUserId(ctx.db, ctx.tenantId, g.clientId ?? e.clientId);
    if (stage === 'highlights') {
      if (g.highlightsPublishedAt) return full(ctx, id);
      if (!g.highlightsSubmittedAt) throw conflict('Highlights must be submitted by the photographer first.');
      if (counts.highlights === 0) throw invalid('Mark at least one photograph as a highlight.');
      await repo.publish(ctx.db, ctx.tenantId, id, 'highlights');
      await eventsRepository.markHighlightsPublished(ctx.db, ctx.tenantId, e.id);
      await notify(ctx.db, ctx.tenantId, [clientUser], { type: 'highlights_published', title: 'Your highlights are ready', body: `${counts.highlights} highlight photographs from “${e.title}” are now available.`, link: '/portal/photos' });
    } else {
      if (g.completePublishedAt) return full(ctx, id);
      if (counts.total === 0) throw invalid('Add photographs before publishing the complete gallery.');
      await repo.publish(ctx.db, ctx.tenantId, id, 'complete');
      await eventsRepository.markDelivered(ctx.db, ctx.tenantId, e.id);
      await notify(ctx.db, ctx.tenantId, [clientUser], { type: 'gallery_published', title: 'Your complete gallery is live', body: `All ${counts.total} photographs from “${e.title}” are available to view and download.`, link: '/portal/photos' });
    }
    await audit(ctx, `publish_${stage}`, 'gallery', id);
    return full(ctx, id);
  },
 
  /** Public portfolio: photos of public galleries that have been published (highlights or complete). */
  async portfolio(ctx: Ctx, raw: unknown) {
    const p = portfolioQuery.parse(raw);
    const { items, total } = await repo.portfolio(ctx.db, ctx.tenantId, p);
    return new Page(items, total, p.page, p.pageSize);
  },
};