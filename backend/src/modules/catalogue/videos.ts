import { Router } from 'express';
import { z } from 'zod';
import { createRepository, type EntitySpec } from '../../db/repository.js';
import { assertRefs } from '../../db/refs.js';
import { invalid } from '../../lib/errors.js';
import { isStaff } from '../../lib/handlers.js';
import { parseYouTube } from '../../lib/media.js';
import { listQuery, longText, mediaUrl, qbool, reqText, uuid } from '../../lib/validation.js';
import { createCrudController, createCrudService, crudRouter } from '../crud.js';
 
export interface Video { id: string; tenantId: string; youtubeUrl: string; thumbnailUrl: string; [k: string]: unknown }
 
const spec: EntitySpec = {
  table: 'videos', softDelete: true,
  fields: {
    id: 'id', tenantId: 'tenant_id', title: 'title', description: 'description', youtubeUrl: 'youtube_url', youtubeId: 'youtube_id', category: 'category',
    thumbnailUrl: 'thumbnail_url', featured: 'featured', enabled: 'enabled', visibility: 'visibility', eventId: 'event_id', clientId: 'client_id', createdAt: 'created_at',
  },
  sort: { fields: { createdAt: 't.created_at', title: 't.title' }, default: 'createdAt', order: 'desc' },
};
const CATS = ['wedding', 'pre-wedding', 'event', 'showcase'] as const;
const nullableId = z.union([uuid, z.literal(''), z.null()]).transform((v) => v || null);
const body = z.object({
  title: reqText(160), description: longText(1000), youtubeUrl: z.string().trim().min(1).max(300), category: z.enum(CATS), thumbnailUrl: mediaUrl,
  featured: z.boolean(), enabled: z.boolean(), visibility: z.enum(['public', 'client']), eventId: nullableId, clientId: nullableId,
});
const query = listQuery.extend({
  category: z.enum(CATS).optional(), featured: qbool.optional(), enabled: qbool.optional(), visibility: z.enum(['public', 'client']).optional(), clientId: uuid.optional(), eventId: uuid.optional(),
});
 
const service = createCrudService<Video>({
  label: 'Video', entity: 'video', repo: createRepository<Video>(spec), query,
  createSchema: body.partial().required({ title: true, youtubeUrl: true }), updateSchema: body.partial(),
  searchColumns: ['t.title', 't.description', 't.category'],
  // Public sees enabled public videos; a client additionally sees videos assigned to them; staff see everything.
  scope: (ctx, q) => {
    if (isStaff(ctx.principal)) return;
    if (ctx.principal?.role === 'client' && ctx.principal.clientId) q.where(`t.enabled AND (t.visibility = 'public' OR t.client_id = ?)`, ctx.principal.clientId);
    else q.raw(`t.enabled AND t.visibility = 'public'`);
  },
  filters: (_c, q, p) => {
    if (p.category) q.where('t.category = ?', p.category);
    if (p.featured !== undefined) q.where('t.featured = ?', p.featured);
    if (p.enabled !== undefined) q.where('t.enabled = ?', p.enabled);
    if (p.visibility) q.where('t.visibility = ?', p.visibility);
    if (p.clientId) q.where('t.client_id = ?', p.clientId);
    if (p.eventId) q.where('t.event_id = ?', p.eventId);
  },
  prepare: async (ctx, input, existing) => {
    const out: Record<string, unknown> = { ...input };
    if (input.youtubeUrl !== undefined) {
      const info = parseYouTube(input.youtubeUrl);
      if (!info) throw invalid('Enter a valid YouTube link (watch, youtu.be, embed or shorts).', { youtubeUrl: 'Unsupported YouTube URL' });
      out.youtubeId = info.id; out.youtubeUrl = info.watchUrl;
      if (!input.thumbnailUrl && (!existing || !existing.thumbnailUrl || existing.youtubeUrl !== info.watchUrl)) out.thumbnailUrl = info.thumbnail;
    }
    await assertRefs(ctx.db, ctx.tenantId, 'events', [input.eventId], 'Event not found in this studio.');
    await assertRefs(ctx.db, ctx.tenantId, 'clients', [input.clientId], 'Client not found in this studio.');
    return out;
  },
});
export const videosRouter: Router = crudRouter(createCrudController(service));