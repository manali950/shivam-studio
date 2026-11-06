import { Router } from 'express';
import { idParam, systemRoute } from '../../lib/handlers.js';
import { platformService as s } from './platform.service.js';
 
const SUPER = { roles: ['super_admin' as const] };
 
export const platformRouter = Router();
platformRouter.get('/stats', systemRoute((db) => s.stats(db), SUPER));
// Plan prices and the platform name are public marketing information; only super admins may change them.
platformRouter.get('/plans', systemRoute((db) => s.plans.list(db)));
platformRouter.post('/plans', systemRoute((db, req) => s.plans.create(db, req.body, req.auth!), { ...SUPER, status: 201 }));
platformRouter.put('/plans/:id', systemRoute((db, req) => s.plans.update(db, idParam(req), req.body, req.auth!), SUPER));
platformRouter.delete('/plans/:id', systemRoute((db, req) => s.plans.remove(db, idParam(req), req.auth!), SUPER));
platformRouter.get('/settings', systemRoute((db) => s.getSettings(db)));
platformRouter.put('/settings', systemRoute((db, req) => s.updateSettings(db, req.body, req.auth!), SUPER));