import { Router } from 'express';
import { z } from 'zod';
import { createRepository, type EntitySpec } from '../../db/repository.js';
import { uniqueSlug } from '../../db/refs.js';
import { isStaff } from '../../lib/handlers.js';
import { category, dateOnly, email, listQuery, longText, mediaUrl, phone, qbool, reqText, slugify, stringList, text } from '../../lib/validation.js';
import { createCrudController, createCrudService, crudRouter } from '../crud.js';
 
export interface Photographer { id: string; tenantId: string; userId: string | null; name: string; slug: string; [k: string]: unknown }
 
const spec: EntitySpec = {
  table: 'photographers', softDelete: true,
  fields: {
    id: 'id', tenantId: 'tenant_id', userId: 'user_id', name: 'name', slug: 'slug', title: 'title', bio: 'bio', avatarUrl: 'avatar_url', email: 'email', phone: 'phone',
    experienceYears: 'experience_years', rating: 'rating', specialties: 'specialties', skills: 'skills', equipment: 'equipment', portfolio: 'portfolio',
    status: 'status', featured: 'featured', availability: { col: 'availability', json: true }, createdAt: 'created_at',
  },
  sort: { fields: { name: 't.name', createdAt: 't.created_at', rating: 't.rating', experienceYears: 't.experience_years' }, default: 'name' },
};
export const photographersRepo = createRepository<Photographer>(spec);
 
const body = z.object({
  name: reqText(100, 'Enter a name'), title: text(120), bio: longText(2000), avatarUrl: mediaUrl, email, phone,
  experienceYears: z.number().int().min(0).max(80), rating: z.number().min(0).max(5),
  specialties: z.array(category).max(9), skills: stringList(30, 60), equipment: stringList(30, 80), portfolio: z.array(mediaUrl.refine((s) => s !== '', 'Empty URL')).max(30),
  status: z.enum(['active', 'on_leave', 'inactive']), featured: z.boolean(),
  availability: z.object({ weekdays: z.array(z.number().int().min(0).max(6)).max(7), blockedDates: z.array(dateOnly).max(366), note: text(300) }),
});
const query = listQuery.extend({ status: z.enum(['active', 'on_leave', 'inactive']).optional(), specialty: category.optional(), featured: qbool.optional() });
 
const service = createCrudService<Photographer>({
  label: 'Photographer', entity: 'photographer', repo: photographersRepo, query,
  createSchema: body.partial().required({ name: true, email: true }), updateSchema: body.partial(),
  searchColumns: ['t.name', 't.title', "array_to_string(t.specialties, ' ')"],
  scope: (ctx, q) => { if (!isStaff(ctx.principal)) q.raw(`t.status <> 'inactive'`); },
  filters: (_c, q, p) => {
    if (p.status) q.where('t.status = ?', p.status);
    if (p.specialty) q.where('? = ANY(t.specialties)', p.specialty);
    if (p.featured !== undefined) q.where('t.featured = ?', p.featured);
  },
  prepare: async (ctx, input, existing) => {
    const out: Record<string, unknown> = { ...input };
    if (!existing || (input.name && input.name !== existing.name)) out.slug = await uniqueSlug(ctx.db, 'photographers', ctx.tenantId, slugify(String(input.name ?? existing?.name)), existing?.id);
    return out;
  },
  afterDelete: async (ctx, p) => {
    // A removed photographer disappears from every assignment and can no longer sign in.
    await ctx.db.query('DELETE FROM booking_photographers WHERE tenant_id = $1 AND photographer_id = $2', [ctx.tenantId, p.id]);
    await ctx.db.query('DELETE FROM event_photographers WHERE tenant_id = $1 AND photographer_id = $2', [ctx.tenantId, p.id]);
    if (p.userId) await ctx.db.query(`UPDATE users SET status = 'disabled' WHERE tenant_id = $1 AND id = $2`, [ctx.tenantId, p.userId]);
  },
});
export const photographersRouter: Router = crudRouter(createCrudController(service));