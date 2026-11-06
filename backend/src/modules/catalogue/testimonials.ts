import { Router } from 'express';
import { z } from 'zod';
import { createRepository, type EntitySpec } from '../../db/repository.js';
import { category, listQuery, mediaUrl, qbool, reqText, text } from '../../lib/validation.js';
import { createCrudController, createCrudService, crudRouter } from '../crud.js';
 
export interface Testimonial { id: string; tenantId: string; clientName: string; [k: string]: unknown }
 
const spec: EntitySpec = {
  table: 'testimonials', softDelete: true,
  fields: { id: 'id', tenantId: 'tenant_id', clientName: 'client_name', role: 'role', eventType: 'event_type', rating: 'rating', quote: 'quote', avatarUrl: 'avatar_url', featured: 'featured', createdAt: 'created_at' },
  sort: { fields: { createdAt: 't.created_at', rating: 't.rating', clientName: 't.client_name' }, default: 'createdAt', order: 'desc' },
};
const body = z.object({ clientName: reqText(100), role: text(120), eventType: category, rating: z.number().int().min(1).max(5), quote: reqText(800), avatarUrl: mediaUrl, featured: z.boolean() });
const query = listQuery.extend({ featured: qbool.optional() });
 
const service = createCrudService<Testimonial>({
  label: 'Testimonial', entity: 'testimonial', repo: createRepository<Testimonial>(spec), query,
  createSchema: body.partial().required({ clientName: true, quote: true }), updateSchema: body.partial(),   // reading is public: they power the website
  searchColumns: ['t.client_name', 't.quote'],
  filters: (_c, q, p) => { if (p.featured !== undefined) q.where('t.featured = ?', p.featured); },
});
export const testimonialsRouter: Router = crudRouter(createCrudController(service));