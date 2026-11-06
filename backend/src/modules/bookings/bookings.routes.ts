import { Router } from 'express';
import { publicWriteLimiter } from '../../middleware/rateLimit.js';
import { bookingsController as c } from './bookings.controller.js';
 
export const bookingsRouter = Router();
bookingsRouter.get('/', c.list);
bookingsRouter.post('/', publicWriteLimiter, c.create);      // anonymous visitors may submit enquiries → rate limited
bookingsRouter.get('/:id', c.get);
bookingsRouter.put('/:id', c.update);
bookingsRouter.delete('/:id', c.remove);
bookingsRouter.patch('/:id/status', c.setStatus);
bookingsRouter.put('/:id/photographers', c.assign);
bookingsRouter.post('/:id/notes', c.note);