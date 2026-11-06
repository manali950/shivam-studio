import { z } from 'zod';
import { category, dateOnly, idList, listQuery, longText, mediaUrl, qbool, reqText, text, timeOfDay, uuid } from '../../lib/validation.js';
 
const nullableId = z.union([uuid, z.literal(''), z.null()]).transform((v) => v || null);
export const EVENT_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export const DELIVERY_STATUSES = ['not_due', 'pending', 'highlights_submitted', 'highlights_published', 'delivered'] as const;
 
const body = z.object({
  title: reqText(200, 'Enter an event title'), type: category, date: dateOnly, startTime: timeOfDay, venue: text(200), city: text(100), description: longText(2000),
  photographerIds: idList, isPublic: z.boolean(), coverUrl: mediaUrl,
  // "completed" is reached only through POST /events/:id/complete so the delivery workflow always starts properly.
  status: z.enum(['scheduled', 'in_progress', 'cancelled']), bookingId: nullableId, clientId: nullableId,
});
export const createEventSchema = body.partial().required({ title: true, type: true, date: true });
export const updateEventSchema = body.partial();
 
export const eventQuery = listQuery.extend({
  status: z.enum(EVENT_STATUSES).optional(), photographerId: uuid.optional(), clientId: uuid.optional(), isPublic: qbool.optional(), upcoming: qbool.optional(),
  delivery: z.enum(DELIVERY_STATUSES).optional(),
});
export const progressSchema = z.object({ progress: z.enum(['planned', 'shooting', 'wrapped', 'editing', 'delivered']) });
export const assignSchema = z.object({ photographerIds: idList });
export const noteSchema = z.object({ text: z.string().trim().min(1, 'Note cannot be empty.').max(2000) });
export const deliverySchema = z.object({
  targetHours: z.number().int().min(1, 'Delivery target must be between 1 and 720 hours.').max(720, 'Delivery target must be between 1 and 720 hours.').optional(),
  notes: z.string().trim().max(1000).optional(),
});