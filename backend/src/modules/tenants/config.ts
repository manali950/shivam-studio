/** Studio website content + business settings (tenant_configs). Shapes mirror frontend TenantConfig. */
import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { email, longText, mediaUrl, slugify, text } from '../../lib/validation.js';
 
const hex = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const link = z.union([z.literal(''), z.string().trim().max(500).url().refine((s) => /^https?:\/\//i.test(s), 'Must start with https://')]);
const tz = z.string().trim().max(60).refine((s) => { try { new Intl.DateTimeFormat('en', { timeZone: s }); return true; } catch { return false; } }, 'Unknown time zone');
 
export const configSchemas = {
  branding: z.object({ logoUrl: mediaUrl, faviconUrl: mediaUrl, primaryColor: hex, secondaryColor: hex, heroImageUrl: mediaUrl, tagline: text(160) }),
  home: z.object({ headline: text(200), subheadline: text(400), heroCtaLabel: text(40), featuredPhotoUrls: z.array(mediaUrl.refine((s) => s !== '', 'Empty URL')).max(20) }),
  about: z.object({
    title: text(160), intro: longText(2000), history: longText(4000), philosophy: longText(4000),
    achievements: z.array(z.object({ label: text(80), value: text(40) })).max(12), milestones: z.array(z.object({ year: text(10), text: text(300) })).max(20),
  }),
  contact: z.object({ email: z.union([z.literal(''), email]), phone: text(40), whatsapp: text(40), address: text(300), city: text(100), mapUrl: link, hours: text(160) }),
  social: z.object({ instagram: link.optional(), facebook: link.optional(), youtube: link.optional(), twitter: link.optional(), pinterest: link.optional() }),
  footer: z.object({ text: text(300), copyright: text(200) }),
  settings: z.object({
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']), locale: text(20), deliveryTargetHours: z.number().int().min(1).max(720),
    booking: z.object({ enquiryEnabled: z.boolean(), autoConfirm: z.boolean(), requireDeposit: z.boolean(), depositPercent: z.number().min(0).max(100), minLeadDays: z.number().int().min(0).max(365) }),
    notifications: z.object({ emailOnNewBooking: z.boolean(), emailOnDelivery: z.boolean(), smsReminders: z.boolean(), reminderDaysBefore: z.number().int().min(0).max(30) }),
    business: z.object({ legalName: text(160), taxId: text(40), invoicePrefix: text(8), timezone: tz }),
  }),
};
export const SECTIONS = Object.keys(configSchemas) as (keyof typeof configSchemas)[];
export type TenantSettings = z.infer<typeof configSchemas.settings>;
 
/** Starting content for a newly created studio (the owner customises it in Studio admin → Website / Settings). */
export function defaultConfig(name: string, city: string, ownerEmail: string): Record<(typeof SECTIONS)[number], unknown> {
  const monogram = name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
  const logo = (bg: string, fg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${bg}"/><text x="32" y="41" text-anchor="middle" font-family="Georgia,serif" font-size="26" font-weight="700" fill="${fg}">${monogram.replace(/[<>&]/g, '')}</text></svg>`)}`;
  return {
    branding: { logoUrl: logo('#1d1b19', '#b08d57'), faviconUrl: logo('#1d1b19', '#b08d57'), primaryColor: '#B08D57', secondaryColor: '#1D1B19', tagline: 'Stories worth keeping',
      heroImageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=2000&q=70' },
    home: { headline: 'Photographs that feel like your story.', subheadline: `${name} — premium photography from ${city || 'your city'}.`, heroCtaLabel: 'Book a session', featuredPhotoUrls: [] },
    about: { title: `About ${name}`, intro: 'Tell your studio story here.', history: '', philosophy: '', achievements: [], milestones: [] },
    contact: { email: ownerEmail, phone: '', whatsapp: '', address: '', city, mapUrl: '', hours: 'Mon–Sat · 10:00–18:00' },
    social: {}, footer: { text: '', copyright: `© ${new Date().getFullYear()} ${name}.` },
    settings: {
      currency: 'INR', locale: 'en-IN', deliveryTargetHours: 24,
      booking: { enquiryEnabled: true, autoConfirm: false, requireDeposit: true, depositPercent: 30, minLeadDays: 3 },
      notifications: { emailOnNewBooking: true, emailOnDelivery: true, smsReminders: false, reminderDaysBefore: 3 },
      business: { legalName: name, taxId: '', invoicePrefix: slugify(name).replace(/-/g, '').slice(0, 3).toUpperCase() || 'BK', timezone: 'Asia/Kolkata' },
    },
  };
}
 
const FALLBACK: TenantSettings = defaultConfig('Studio', '', '').settings as TenantSettings;
/** Booking/event services read a studio's settings through here (missing keys fall back to defaults). */
export async function getSettings(db: Db, tenantId: string): Promise<TenantSettings> {
  const row = (await db.query<{ settings: Partial<TenantSettings> }>('SELECT settings FROM tenant_configs WHERE tenant_id = $1', [tenantId])).rows[0]?.settings ?? {};
  return {
    ...FALLBACK, ...row,
    booking: { ...FALLBACK.booking, ...row.booking }, notifications: { ...FALLBACK.notifications, ...row.notifications }, business: { ...FALLBACK.business, ...row.business },
  };
}