import { idParam, tenantRoute } from '../../lib/handlers.js';
import { bookingsService as s } from './bookings.service.js';
 
export const bookingsController = {
  list: tenantRoute((ctx, req) => s.list(ctx, req.query)),
  get: tenantRoute((ctx, req) => s.get(ctx, idParam(req))),
  create: tenantRoute((ctx, req) => s.create(ctx, req.body), { status: 201 }),
  update: tenantRoute((ctx, req) => s.update(ctx, idParam(req), req.body)),
  remove: tenantRoute((ctx, req) => s.remove(ctx, idParam(req))),
  setStatus: tenantRoute((ctx, req) => s.setStatus(ctx, idParam(req), req.body)),
  assign: tenantRoute((ctx, req) => s.assignPhotographers(ctx, idParam(req), req.body)),
  note: tenantRoute((ctx, req) => s.addNote(ctx, idParam(req), req.body), { status: 201 }),
};