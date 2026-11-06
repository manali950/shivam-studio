import { Router } from 'express';
import { eventsController as c } from './events.controller.js';
 
export const eventsRouter = Router();
eventsRouter.get('/', c.list);
eventsRouter.post('/', c.create);
eventsRouter.get('/:id', c.get);
eventsRouter.put('/:id', c.update);
eventsRouter.delete('/:id', c.remove);
eventsRouter.post('/:id/complete', c.complete);
eventsRouter.patch('/:id/progress', c.progress);
eventsRouter.put('/:id/photographers', c.assign);
eventsRouter.post('/:id/notes', c.note);
eventsRouter.patch('/:id/delivery', c.delivery);
eventsRouter.get('/:id/galleries', c.galleries);