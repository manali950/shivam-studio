import { z } from 'zod';
 
export const CATEGORIES = ['wedding', 'pre-wedding', 'engagement', 'birthday', 'corporate', 'fashion', 'product', 'event', 'portrait'] as const;
export const category = z.enum(CATEGORIES);
 
export const uuid = z.string().uuid();
export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'Invalid date');
export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 hour)');
 
export const text = (max = 200) => z.string().trim().max(max);
export const reqText = (max = 200, msg = 'This field is required') => z.string().trim().min(1, msg).max(max);
export const longText = (max = 5000) => z.string().trim().max(max);
export const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
export const phone = z.string().trim().max(40).regex(/^[0-9+()\-.\s]*$/, 'Enter a valid phone number');
export const stringList = (maxItems = 50, maxLen = 200) => z.array(z.string().trim().min(1).max(maxLen)).max(maxItems);
 
/** Image / asset reference: '' (none), https?:// URL, an app-relative path, or an inline raster/svg data URL. Never javascript: etc. */
export const mediaUrl = z.string().trim().max(4000).refine(
  (s) => s === '' || /^https?:\/\/[^\s]+$/i.test(s) || /^\/(?!\/)[^\s]*$/.test(s) || /^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(s),
  'Enter a valid image URL (https://…)');
export const httpUrl = z.string().trim().max(2000).url('Enter a valid URL').refine((s) => /^https?:\/\//i.test(s), 'URL must start with http:// or https://');
export const httpsUrl = z.string().trim().max(2000).url('Enter a valid URL').refine((s) => /^https:\/\//i.test(s), 'Links must start with https://');
 
/** `?featured=true` → boolean */
export const qbool = z.enum(['true', 'false']).transform((v) => v === 'true');
 
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(1000),
  search: z.string().trim().max(100).optional(),
  sort: z.string().max(40).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});
export type ListQuery = z.infer<typeof listQuery>;
 
export const idList = z.array(uuid).max(50).refine((a) => new Set(a).size === a.length, 'Duplicate ids');
 
/** "slug-ish" text: lower-case ASCII words joined by hyphens. */
export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
 
export const todayIn = (tz = 'UTC'): string => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
};