/**
 * Generic CRUD module factory: repository (db/repository.ts) → service (this file) → controller → router.
 * Simple resources define only what is specific to them (schemas, visibility rules, cross-reference checks).
 * Auth order is always: authenticate (401/403) → validate body (422) → business rules (409/422) → write → audit.
 */
import { Router, type RequestHandler } from 'express';
import type { z } from 'zod';
import type { Repository } from '../db/repository.js';
import { addSearch, type Query } from '../db/query.js';
import { audit } from '../lib/audit.js';
import { notFound } from '../lib/errors.js';
import { STAFF, idParam, requireRoles, tenantRoute } from '../lib/handlers.js';
import { Page, type Ctx, type Role } from '../lib/types.js';
import { listQuery } from '../lib/validation.js';
 
export interface CrudConfig<T extends { id: string }> {
  label: string;                                  // "Photographer" (used in 404 messages)
  entity: string;                                 // audit_logs.entity
  repo: Repository<T>;
  query?: z.AnyZodObject;                         // list query = listQuery + module filters
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  searchColumns?: string[];
  /** Row visibility for list AND get — who may see what (public / client / photographer / staff). */
  scope?: (ctx: Ctx, q: Query) => void;
  filters?: (ctx: Ctx, q: Query, p: any) => void;
  writeRoles?: Role[];
  /** Cross-reference validation + derived columns; returns the values to persist (API field names). */
  prepare?: (ctx: Ctx, input: Record<string, any>, existing: T | null) => Promise<Record<string, unknown>>;
  beforeDelete?: (ctx: Ctx, existing: T) => Promise<void>;
  afterDelete?: (ctx: Ctx, existing: T) => Promise<void>;
}
 
export function createCrudService<T extends { id: string }>(cfg: CrudConfig<T>) {
  const query = cfg.query ?? listQuery;
  const writers = cfg.writeRoles ?? STAFF;
  const service = {
    async list(ctx: Ctx, raw: unknown) {
      const p = query.parse(raw);
      const { items, total } = await cfg.repo.list(ctx.db, ctx.tenantId, (q) => {
        cfg.scope?.(ctx, q);
        addSearch(q, p.search, cfg.searchColumns ?? []);
        cfg.filters?.(ctx, q, p);
      }, { sort: p.sort, order: p.order, page: p.page, pageSize: p.pageSize });
      return new Page(items, total, p.page, p.pageSize);
    },
    async get(ctx: Ctx, id: string) {
      return (await cfg.repo.get(ctx.db, ctx.tenantId, id, (q) => cfg.scope?.(ctx, q))) ?? Promise.reject(notFound(cfg.label));
    },
    async create(ctx: Ctx, body: unknown) {
      requireRoles(ctx, ...writers);
      const input = cfg.createSchema.parse(body) as Record<string, any>;
      const values = cfg.prepare ? await cfg.prepare(ctx, input, null) : input;
      const row = await cfg.repo.insert(ctx.db, ctx.tenantId, values);
      await audit(ctx, 'create', cfg.entity, row.id);
      return row;
    },
    async update(ctx: Ctx, id: string, body: unknown) {
      requireRoles(ctx, ...writers);
      const existing = (await cfg.repo.get(ctx.db, ctx.tenantId, id)) ?? (() => { throw notFound(cfg.label); })();
      const input = cfg.updateSchema.parse(body) as Record<string, any>;
      const values = cfg.prepare ? await cfg.prepare(ctx, input, existing) : input;
      const row = (await cfg.repo.update(ctx.db, ctx.tenantId, id, values)) ?? (() => { throw notFound(cfg.label); })();
      await audit(ctx, 'update', cfg.entity, id, { fields: Object.keys(values) });
      return row;
    },
    async remove(ctx: Ctx, id: string) {
      requireRoles(ctx, ...writers);
      const existing = (await cfg.repo.get(ctx.db, ctx.tenantId, id)) ?? (() => { throw notFound(cfg.label); })();
      await cfg.beforeDelete?.(ctx, existing);
      await cfg.repo.remove(ctx.db, ctx.tenantId, id);
      await cfg.afterDelete?.(ctx, existing);
      await audit(ctx, 'delete', cfg.entity, id);
    },
  };
  return service;
}
export type CrudService<T extends { id: string }> = ReturnType<typeof createCrudService<T>>;
 
export function createCrudController<T extends { id: string }>(svc: CrudService<T>) {
  return {
    list: tenantRoute((ctx, req) => svc.list(ctx, req.query)),
    get: tenantRoute((ctx, req) => svc.get(ctx, idParam(req))),
    create: tenantRoute((ctx, req) => svc.create(ctx, req.body), { status: 201 }),
    update: tenantRoute((ctx, req) => svc.update(ctx, idParam(req), req.body)),
    remove: tenantRoute((ctx, req) => svc.remove(ctx, idParam(req))),
  };
}
 
/** `before` registers extra routes that must win over `/:id` (e.g. /by-slug/:slug, /sample-library). */
export function crudRouter(c: ReturnType<typeof createCrudController>, before?: (r: Router) => void): Router {
  const r = Router();
  before?.(r);
  r.get('/', c.list);
  r.post('/', c.create as RequestHandler);
  r.get('/:id', c.get);
  r.put('/:id', c.update);
  r.delete('/:id', c.remove);
  return r;
}