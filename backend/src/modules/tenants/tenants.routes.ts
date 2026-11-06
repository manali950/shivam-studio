import { Router } from 'express';
import { publicWriteLimiter } from '../../middleware/rateLimit.js';
import { tenantsController as c } from './tenants.controller.js';
 
export const tenantsRouter = Router();
tenantsRouter.get('/resolve', c.resolve);
tenantsRouter.get('/public', c.listPublic);
tenantsRouter.get('/', c.list);
tenantsRouter.post('/', c.create);
tenantsRouter.get('/:id', c.get);
tenantsRouter.put('/:id', c.update);
tenantsRouter.patch('/:id/status', c.setStatus);
tenantsRouter.get('/:id/config', c.getConfig);
tenantsRouter.put('/:id/config', c.updateConfig);
tenantsRouter.post('/:id/contact', publicWriteLimiter, c.contact);