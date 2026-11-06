import { Router } from 'express';
import { z } from 'zod';
import { createRepository, type EntitySpec } from '../../db/repository.js';
import { conflict, notFound } from '../../lib/errors.js';
import { idParam, isStaff, requireStaff, tenantRoute } from '../../lib/handlers.js';
import { email, longText, phone, reqText, text } from '../../lib/validation.js';
import { createCrudController, createCrudService, crudRouter } from '../crud.js';
import { bookingsRepository } from '../bookings/bookings.repository.js';
import { eventsRepository } from '../events/events.repository.js';
 
export interface Client { id: string; tenantId: string; userId: string | null; email: string; [k: string]: unknown }
 
const spec: EntitySpec = {
  table: 'clients', softDelete: true,
  fields: { id: 'id', tenantId: 'tenant_id', userId: 'user_id', name: 'name', email: 'email', phone: 'phone', city: 'city', notes: 'notes', source: 'source', createdAt: 'created_at' },
  sort: { fields: { createdAt: 't.created_at', name: 't.name', email: 't.email', city: 't.city' }, default: 'createdAt', order: 'desc' },
};
export const clientsRepo = createRepository<Client>(spec);
 
const body = z.object({ name: reqText(100), email, phone, city: text(80), notes: longText(1000), source: z.enum(['website', 'whatsapp', 'referral', 'walk-in']) });
 
const service = createCrudService<Client>({
  label: 'Customer', entity: 'client', repo: clientsRepo,
  createSchema: body.partial().required({ name: true, email: true }), updateSchema: body.partial(),
  searchColumns: ['t.name', 't.email', 't.phone', 't.city'],
  scope: (ctx, q) => { if (!isStaff(ctx.principal)) q.raw('false'); },      // customer data is staff-only
  prepare: async (ctx, input, existing) => {
    if (input.email) {
      const dup = await ctx.db.query('SELECT 1 FROM clients WHERE tenant_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL AND ($3::uuid IS NULL OR id <> $3)', [ctx.tenantId, input.email, existing?.id ?? null]);
      if (dup.rowCount) throw conflict('A customer with this email already exists.');
    }
    return input;
  },
  afterDelete: async (ctx, c) => {
    if (c.userId) await ctx.db.query(`UPDATE users SET status = 'disabled' WHERE tenant_id = $1 AND id = $2`, [ctx.tenantId, c.userId]);
  },
});
 
export const clientsRouter: Router = crudRouter(createCrudController(service), (r) => {
  /** A customer's 360° view: profile + every booking and event. */
  r.get('/:id/profile', tenantRoute(async (ctx, req) => {
    requireStaff(ctx);
    const id = idParam(req);
    const client = (await clientsRepo.get(ctx.db, ctx.tenantId, id)) ?? (() => { throw notFound('Customer'); })();
    const bookings = await bookingsRepository.listForClient(ctx.db, ctx.tenantId, id);
    const events = await eventsRepository.listForClient(ctx.db, ctx.tenantId, id);
    return { client, bookings, events };
  }));
});