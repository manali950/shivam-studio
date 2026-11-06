import { idParam, systemRoute, tenantRoute } from '../../lib/handlers.js';
import { galleriesRepository } from './galleries.repository.js';
import { galleriesService as s } from './galleries.service.js';
 
export const galleriesController = {
  list: tenantRoute((ctx, req) => s.list(ctx, req.query)),
  get: tenantRoute((ctx, req) => s.get(ctx, idParam(req))),
  create: tenantRoute((ctx, req) => s.create(ctx, req.body), { status: 201 }),
  update: tenantRoute((ctx, req) => s.update(ctx, idParam(req), req.body)),
  remove: tenantRoute((ctx, req) => s.remove(ctx, idParam(req))),
  addPhotos: tenantRoute((ctx, req) => s.addPhotos(ctx, idParam(req), req.body), { status: 201 }),
  updatePhoto: tenantRoute((ctx, req) => s.updatePhoto(ctx, idParam(req), idParam(req, 'photoId'), req.body)),
  removePhoto: tenantRoute((ctx, req) => s.removePhoto(ctx, idParam(req), idParam(req, 'photoId'))),
  reorder: tenantRoute((ctx, req) => s.reorderPhotos(ctx, idParam(req), req.body)),
  links: tenantRoute((ctx, req) => s.setExternalLinks(ctx, idParam(req), req.body)),
  submit: tenantRoute((ctx, req) => s.submitHighlights(ctx, idParam(req), req.body)),
  publish: tenantRoute((ctx, req) => s.publish(ctx, idParam(req), req.body)),
  portfolio: tenantRoute((ctx, req) => s.portfolio(ctx, req.query)),
  /** Platform-level stock images for the gallery editor — signed-in studio staff / photographers only. */
  sampleLibrary: systemRoute((db) => galleriesRepository.sampleLibrary(db), { roles: ['studio_admin', 'super_admin', 'photographer'] }),
};