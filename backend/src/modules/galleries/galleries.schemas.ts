import { z } from 'zod';
import { category, httpUrl, httpsUrl, listQuery, longText, mediaUrl, qbool, reqText, text, uuid } from '../../lib/validation.js';
 
const nullableId = z.union([uuid, z.literal(''), z.null()]).transform((v) => v || null);
const VISIBILITY = z.enum(['private', 'client', 'public']);
 
/** Links to third-party delivery (Pixieset, WeTransfer, Drive…). https only; the studio is responsible for that service's sharing settings. */
const link = z.object({ id: z.string().max(64).optional(), label: reqText(80, 'Give the link a label'), url: httpsUrl });
export const linksSchema = z.object({ links: z.array(link).max(20) });
 
export const createGallerySchema = z.object({
  title: reqText(200, 'Gallery title is required.'), description: longText(1000).optional(), eventId: nullableId.optional(), clientId: nullableId.optional(),
  visibility: VISIBILITY.optional(), coverUrl: mediaUrl.optional(), externalLinks: z.array(link).max(20).optional(),
});
export const updateGallerySchema = createGallerySchema.partial();
 
export const galleryQuery = listQuery.extend({
  eventId: uuid.optional(), clientId: uuid.optional(), visibility: VISIBILITY.optional(), status: z.enum(['highlights_pending', 'highlights_published', 'complete']).optional(),
});
 
const photoIn = z.object({
  url: httpUrl, title: text(200).optional(), description: longText(500).optional(), category: category.optional(),
  width: z.number().int().min(1).max(30000).optional(), height: z.number().int().min(1).max(30000).optional(), camera: text(100).optional(), lens: text(100).optional(), exposure: text(100).optional(),
});
export const addPhotosSchema = z.object({ photos: z.array(photoIn).min(1, 'Add at least one photo.').max(100, 'Add at most 100 photos at a time.') });
export const updatePhotoSchema = z.object({
  title: text(200), description: longText(500), category, isHighlight: z.boolean(), featured: z.boolean(), order: z.number().int().min(0).max(100000),
  width: z.number().int().min(1).max(30000), height: z.number().int().min(1).max(30000), camera: text(100).nullable(), lens: text(100).nullable(), exposure: text(100).nullable(),
}).partial();
export const reorderSchema = z.object({ photoIds: z.array(uuid).max(5000) });
export const submitSchema = z.object({ photoIds: z.array(uuid).max(5000), note: z.string().trim().max(1000).optional() });
export const publishSchema = z.object({ stage: z.enum(['highlights', 'complete']) });
export const portfolioQuery = listQuery.extend({ category: category.optional(), featured: qbool.optional() });