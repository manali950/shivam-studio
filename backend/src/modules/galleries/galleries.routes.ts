import { Router } from 'express';
import { galleriesController as c } from './galleries.controller.js';
 
export const galleriesRouter = Router();
galleriesRouter.get('/', c.list);
galleriesRouter.post('/', c.create);
galleriesRouter.get('/sample-library', c.sampleLibrary);          // before /:id
galleriesRouter.get('/:id', c.get);
galleriesRouter.put('/:id', c.update);
galleriesRouter.delete('/:id', c.remove);
galleriesRouter.post('/:id/photos', c.addPhotos);
galleriesRouter.put('/:id/photos/order', c.reorder);              // before /photos/:photoId
galleriesRouter.patch('/:id/photos/:photoId', c.updatePhoto);
galleriesRouter.delete('/:id/photos/:photoId', c.removePhoto);
galleriesRouter.put('/:id/external-links', c.links);
galleriesRouter.post('/:id/submit-highlights', c.submit);
galleriesRouter.post('/:id/publish', c.publish);
 
/** Mounted at /portfolio */
export const portfolioRouter = Router();
portfolioRouter.get('/', c.portfolio);