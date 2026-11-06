import { idParam, systemRoute, tenantRoute } from '../../lib/handlers.js';
import { tenantsService as s } from './tenants.service.js';
 
const SUPER = { roles: ['super_admin' as const] };
 
export const tenantsController = {
  resolve: systemRoute((db, req) => s.resolve(db, req.query, req.auth)),
  listPublic: systemRoute((db, req) => s.listPublic(db, req.auth)),
  list: systemRoute((db, req) => s.list(db, req.query), SUPER),
  create: systemRoute((db, req) => s.create(db, req.body, req.auth!), { ...SUPER, status: 201 }),
  get: systemRoute((db, req) => s.get(db, idParam(req), req.auth)),
  update: systemRoute((db, req) => s.update(db, idParam(req), req.body, req.auth!), SUPER),
  setStatus: systemRoute((db, req) => s.setStatus(db, idParam(req), req.body, req.auth!), SUPER),
  getConfig: tenantRoute((ctx) => s.getConfig(ctx), { tenantFrom: 'param' }),
  updateConfig: tenantRoute((ctx, req) => s.updateConfig(ctx, req.body), { tenantFrom: 'param' }),
  contact: tenantRoute((ctx, req) => s.submitContact(ctx, req.body), { tenantFrom: 'param' }),
};