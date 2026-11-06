import { Router } from 'express';
import { z } from 'zod';
import { createRepository, type EntitySpec } from '../../db/repository.js';
import { uniqueSlug } from '../../db/refs.js';
import { conflict } from '../../lib/errors.js';
import { isStaff } from '../../lib/handlers.js';
import { category, listQuery, longText, mediaUrl, reqText, slugify } from '../../lib/validation.js';
import { createCrudController, createCrudService, crudRouter } from '../crud.js';
 
export interface Service { id: string; tenantId: string; name: string; [k: string]: unknown }
 
const spec: EntitySpec = {
  table: 'services', softDelete: true,
  fields: {
    id: 'id', tenantId: 'tenant_id', name: 'name', slug: 'slug', category: 'category', description: 'description', startingPrice: 'starting_price',
    imageUrl: 'image_url', status: 'status', featured: 'featured', sortOrder: 'sort_order',
  },
  sort: { fields: { sortOrder: 't.sort_order', name: 't.name', startingPrice: 't.starting_price' }, default: 'sortOrder' },
};
export const servicesRepo = createRepository<Service>(spec);
 
const body = z.object({
  name: reqText(120, 'Enter a service name'), category, description: longText(1500), startingPrice: z.number().min(0).max(100_000_000), imageUrl: mediaUrl,
  status: z.enum(['active', 'inactive']), featured: z.boolean(), sortOrder: z.number().int().min(0).max(9999),
});
const query = listQuery.extend({ status: z.enum(['active', 'inactive']).optional(), category: category.optional() });
 
const service = createCrudService<Service>({
  label: 'Service', entity: 'service', repo: servicesRepo, query,
  createSchema: body.partial().required({ name: true, category: true }), updateSchema: body.partial(),
  searchColumns: ['t.name', 't.category', 't.description'],
  scope: (ctx, q) => { if (!isStaff(ctx.principal)) q.raw(`t.status = 'active'`); },
  filters: (_c, q, p) => { if (p.status) q.where('t.status = ?', p.status); if (p.category) q.where('t.category = ?', p.category); },
  prepare: async (ctx, input, existing) => {
    const out: Record<string, unknown> = { ...input };
    if (!existing || (input.name && input.name !== existing.name)) out.slug = await uniqueSlug(ctx.db, 'services', ctx.tenantId, slugify(String(input.name ?? existing?.name)), existing?.id);
    if (!existing && input.sortOrder === undefined) out.sortOrder = (await ctx.db.query<{ n: number }>('SELECT count(*) AS n FROM services WHERE tenant_id = $1 AND deleted_at IS NULL', [ctx.tenantId])).rows[0].n + 1;
    return out;
  },
  beforeDelete: async (ctx, s) => {
    const n = (await ctx.db.query<{ n: number }>('SELECT count(*) AS n FROM packages WHERE tenant_id = $1 AND service_id = $2 AND deleted_at IS NULL', [ctx.tenantId, s.id])).rows[0].n;
    if (n) throw conflict('Remove or move this service’s packages first.');
  },
});
export const servicesRouter: Router = crudRouter(createCrudController(service));