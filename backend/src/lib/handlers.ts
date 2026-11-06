import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { withSystemTx, withTenantTx, isUuid, type Db } from '../db/pool.js';
import { AppError, badRequest, forbidden, notFound, unauthenticated } from './errors.js';
import { Page, type Ctx, type Principal, type Role } from './types.js';
 
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { fn(req, res, next).catch(next); };
 
/** Consistent envelope: { data } or { data, meta: { page, pageSize, total } }; `undefined` → 204 No Content. */
export function send(res: Response, result: unknown, status = 200) {
  if (result === undefined) return void res.status(204).end();
  if (result instanceof Page) return void res.status(status).json({ data: result.items, meta: { page: result.page, pageSize: result.pageSize, total: result.total } });
  res.status(status).json({ data: result });
}
 
export const isStaff = (p: Principal | null | undefined) => !!p && (p.role === 'studio_admin' || p.role === 'super_admin');
export const STAFF: Role[] = ['studio_admin', 'super_admin'];
 
export function requireRoles(ctx: Pick<Ctx, 'principal' | 'crossTenant'>, ...roles: Role[]): Principal {
  if (!ctx.principal) throw ctx.crossTenant ? forbidden('You do not have access to this studio.', 'TENANT_FORBIDDEN') : unauthenticated();
  if (!roles.includes(ctx.principal.role)) throw forbidden();
  return ctx.principal;
}
export const requireStaff = (ctx: Pick<Ctx, 'principal' | 'crossTenant'>) => requireRoles(ctx, ...STAFF);
 
export function idParam(req: Request, name = 'id'): string {
  const v = req.params[name];
  if (!isUuid(v)) throw notFound();
  return v;
}
 
/** Platform-wide switch (super admin → Platform settings). Cached for a few seconds. */
let maintenance = { at: 0, on: false };
async function isMaintenance(): Promise<boolean> {
  if (Date.now() - maintenance.at < 10_000) return maintenance.on;
  const on = await withSystemTx(async (db) => (await db.query<{ m: boolean }>('SELECT maintenance_mode AS m FROM platform_settings LIMIT 1')).rows[0]?.m ?? false);
  maintenance = { at: Date.now(), on };
  return on;
}
export const resetMaintenanceCache = () => { maintenance = { at: 0, on: false }; };
export async function assertNotInMaintenance(principal: Principal | null) {
  if (principal?.role === 'super_admin') return;
  if (await isMaintenance()) throw new AppError(503, 'MAINTENANCE', 'The platform is under maintenance. Please try again shortly.');
}
 
/**
 * Tenant-scoped route. The studio comes from `X-Tenant-Id` (or `:id` for /tenants/:id/… routes) and is ALWAYS re-validated:
 *  - the studio must exist;
 *  - a signed-in user of a different studio is downgraded to anonymous for this request (public data only).
 * The handler then runs inside a transaction pinned to that tenant (row-level security).
 */
export function tenantRoute<R>(fn: (ctx: Ctx, req: Request, res: Response) => Promise<R>, opts: { status?: number; tenantFrom?: 'header' | 'param' } = {}): RequestHandler {
  return asyncHandler(async (req, res) => {
    const header = req.header('x-tenant-id');
    const tenantId = opts.tenantFrom === 'param' ? req.params.id : header;
    if (opts.tenantFrom === 'param' && header && header !== tenantId) throw badRequest('X-Tenant-Id does not match the studio in the URL.', 'TENANT_MISMATCH');
    if (!isUuid(tenantId)) throw badRequest('A valid X-Tenant-Id header is required.', 'TENANT_REQUIRED');
    if (req.method !== 'GET') await assertNotInMaintenance(req.auth);
 
    const result = await withTenantTx(tenantId, async (db) => {
      const t = await db.query('SELECT 1 FROM tenants WHERE id = $1 AND deleted_at IS NULL', [tenantId]);
      if (!t.rowCount) throw new AppError(404, 'TENANT_NOT_FOUND', 'Studio not found');
      const a = req.auth;
      const crossTenant = !!a && a.role !== 'super_admin' && a.tenantId !== tenantId;
      return fn({ tenantId, principal: crossTenant ? null : a, crossTenant, db, ip: req.ip }, req, res);
    });
    send(res, result, opts.status);
  });
}
 
/** Platform-level route (no tenant context): resolves tenants, super-admin tools, login. Runs with the system RLS scope. */
export function systemRoute<R>(fn: (db: Db, req: Request, res: Response) => Promise<R>, opts: { status?: number; roles?: Role[] } = {}): RequestHandler {
  return asyncHandler(async (req, res) => {
    if (opts.roles) {
      if (!req.auth) throw unauthenticated();
      if (!opts.roles.includes(req.auth.role)) throw forbidden();
    }
    send(res, await withSystemTx((db) => fn(db, req, res)), opts.status);
  });
}