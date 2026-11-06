import { Router } from 'express';
import { z } from 'zod';
import { createRepository, type EntitySpec } from '../../db/repository.js';
import { assertRefs } from '../../db/refs.js';
import { isStaff } from '../../lib/handlers.js';
import { listQuery, longText, reqText, stringList, uuid } from '../../lib/validation.js';
import { createCrudController, createCrudService, crudRouter } from '../crud.js';
 
export interface Package { id: string; tenantId: string; serviceId: string; name: string; price: number; [k: string]: unknown }
 
const spec: EntitySpec = {
  table: 'packages', softDelete: true,
  fields: {
    id: 'id', tenantId: 'tenant_id', serviceId: 'service_id', name: 'name', description: 'description', price: 'price', durationHours: 'duration_hours',
    photographerCount: 'photographer_count', deliverables: 'deliverables', features: 'features', popular: 'popular', status: 'status', sortOrder: 'sort_order',
  },
  sort: { fields: { sortOrder: 't.sort_order', name: 't.name', price: 't.price' }, default: 'sortOrder' },
};
export const packagesRepo = createRepository<Package>(spec);
 
const body = z.object({
  serviceId: uuid, name: reqText(120, 'Enter a package name'), description: longText(600), price: z.number().min(0).max(100_000_000),
  durationHours: z.number().int().min(1).max(200), photographerCount: z.number().int().min(1).max(20),
  deliverables: stringList(30, 200), features: stringList(30, 200), popular: z.boolean(), status: z.enum(['active', 'inactive']), sortOrder: z.number().int().min(0).max(9999),
});
const query = listQuery.extend({ status: z.enum(['active', 'inactive']).optional(), serviceId: uuid.optional() });
 
const service = createCrudService<Package>({
  label: 'Package', entity: 'package', repo: packagesRepo, query,
  createSchema: body.partial().required({ serviceId: true, name: true, price: true }), updateSchema: body.partial(),
  searchColumns: ['t.name', 't.description'],
  scope: (ctx, q) => { if (!isStaff(ctx.principal)) q.raw(`t.status = 'active'`); },
  filters: (_c, q, p) => { if (p.status) q.where('t.status = ?', p.status); if (p.serviceId) q.where('t.service_id = ?', p.serviceId); },
  prepare: async (ctx, input, existing) => {
    if (input.serviceId) await assertRefs(ctx.db, ctx.tenantId, 'services', [input.serviceId], 'Choose a valid service for this package.');
    const out: Record<string, unknown> = { ...input };
    if (!existing && input.sortOrder === undefined) out.sortOrder = (await ctx.db.query<{ n: number }>('SELECT count(*) AS n FROM packages WHERE tenant_id = $1 AND deleted_at IS NULL', [ctx.tenantId])).rows[0].n + 1;
    return out;
  },
});
export const packagesRouter: Router = crudRouter(createCrudController(service));