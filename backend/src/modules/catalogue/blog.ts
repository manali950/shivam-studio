import { Router } from 'express';
import { z } from 'zod';
import { createRepository, type EntitySpec } from '../../db/repository.js';
import { uniqueSlug } from '../../db/refs.js';
import { notFound } from '../../lib/errors.js';
import { isStaff, tenantRoute } from '../../lib/handlers.js';
import { listQuery, longText, mediaUrl, reqText, slugify, text } from '../../lib/validation.js';
import { createCrudController, createCrudService, crudRouter } from '../crud.js';
 
export interface BlogPost { id: string; tenantId: string; slug: string; title: string; [k: string]: unknown }
 
const spec: EntitySpec = {
  table: 'blog_posts', softDelete: true,
  fields: {
    id: 'id', tenantId: 'tenant_id', slug: 'slug', title: 'title', excerpt: 'excerpt', body: 'body', coverUrl: 'cover_url', category: 'category',
    authorName: 'author_name', readMinutes: 'read_minutes', publishedAt: 'published_at', status: 'status',
  },
  sort: { fields: { publishedAt: 't.published_at', title: 't.title' }, default: 'publishedAt', order: 'desc' },
};
const repo = createRepository<BlogPost>(spec);
 
const body = z.object({
  title: reqText(160), slug: text(80), excerpt: longText(300), body: longText(50_000), coverUrl: mediaUrl, category: z.enum(['tips', 'stories']),
  authorName: text(100), readMinutes: z.number().int().min(1).max(120), status: z.enum(['published', 'draft']), publishedAt: z.string().datetime({ offset: true }),
});
const query = listQuery.extend({ status: z.enum(['published', 'draft']).optional(), category: z.enum(['tips', 'stories']).optional() });
const scope = (ctx: Parameters<NonNullable<Parameters<typeof createCrudService>[0]['scope']>>[0], q: Parameters<NonNullable<Parameters<typeof createCrudService>[0]['scope']>>[1]) => {
  if (!isStaff(ctx.principal)) q.raw(`t.status = 'published'`);       // drafts are staff-only
};
 
const service = createCrudService<BlogPost>({
  label: 'Article', entity: 'blog_post', repo, query,
  createSchema: body.partial().required({ title: true }), updateSchema: body.partial(),
  searchColumns: ['t.title', 't.excerpt'], scope,
  filters: (_c, q, p) => { if (p.status) q.where('t.status = ?', p.status); if (p.category) q.where('t.category = ?', p.category); },
  prepare: async (ctx, input, existing) => {
    const out: Record<string, unknown> = { ...input };
    if (!existing || input.slug || (input.title && input.title !== existing.title && !existing.slug)) out.slug = await uniqueSlug(ctx.db, 'blog_posts', ctx.tenantId, slugify(String(input.slug || input.title || existing?.title)), existing?.id);
    return out;
  },
});
const controller = createCrudController(service);
export const blogRouter: Router = crudRouter(controller, (r) => {
  r.get('/by-slug/:slug', tenantRoute(async (ctx, req) => {
    const slug = String(req.params.slug).slice(0, 120);
    const { items } = await repo.list(ctx.db, ctx.tenantId, (q) => { scope(ctx, q); q.where('t.slug = ?', slug); }, { page: 1, pageSize: 1 });
    return items[0] ?? Promise.reject(notFound('Article'));
  }));
});