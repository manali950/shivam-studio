import { idParam, tenantRoute } from '../../lib/handlers.js';
import { galleriesService } from '../galleries/galleries.service.js';
import { eventsService as s } from './events.service.js';
 
export const eventsController = {
  list: tenantRoute((ctx, req) => s.list(ctx, req.query)),
  get: tenantRoute((ctx, req) => s.get(ctx, idParam(req))),
  create: tenantRoute((ctx, req) => s.create(ctx, req.body), { status: 201 }),
  update: tenantRoute((ctx, req) => s.update(ctx, idParam(req), req.body)),
  remove: tenantRoute((ctx, req) => s.remove(ctx, idParam(req))),
  complete: tenantRoute((ctx, req) => s.complete(ctx, idParam(req))),
  progress: tenantRoute((ctx, req) => s.updateProgress(ctx, idParam(req), req.body)),
  assign: tenantRoute((ctx, req) => s.assignPhotographers(ctx, idParam(req), req.body)),
  note: tenantRoute((ctx, req) => s.addNote(ctx, idParam(req), req.body), { status: 201 }),
  delivery: tenantRoute((ctx, req) => s.updateDelivery(ctx, idParam(req), req.body)),
  galleries: tenantRoute((ctx, req) => galleriesService.listByEvent(ctx, idParam(req))),
};