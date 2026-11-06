#!/usr/bin/env node
/**
 * Generates backend/database/seed.sql from the frontend's mock JSON (the single source of demo data), so the PostgreSQL
 * demo and the mock-mode demo always match.
 *
 *  - IDs: readable mock ids ("ph_royal_1") → deterministic UUID v5, so re-running never duplicates rows and foreign keys line up.
 *  - Idempotent: every row is INSERT … ON CONFLICT (id) DO UPDATE. Re-running resets those demo rows (rows you created are untouched).
 *  - Dates: like the mock provider, the seed is anchored to 2026-11-06 and shifted to "today" when the SQL runs; timestamps never land in the future.
 *  - Passwords: only a scrypt hash of the shared demo password is written (no plain text). Demo logins are listed in README.md.
 *
 * Usage: node tools/generate-seed.mjs        (or: npm run db:seed:generate  inside backend/)
 */
import { createHash, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
 
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOCK = join(ROOT, 'frontend/src/data/mock');
const OUT = join(ROOT, 'backend/database/seed.sql');
const load = (f) => JSON.parse(readFileSync(join(MOCK, f), 'utf8'));
 
const SEED_ANCHOR = '2026-11-06';
const DEMO_PASSWORD = 'Demo@12345';
const NAMESPACE = '6f1b0c2e-9d1a-4d58-8f55-5a1c3f0e7a11';
 
/* ----------------------------------------------------------------------------------------------- helpers */
function uuid5(name) {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');
  const h = createHash('sha1').update(ns).update(name).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const id = (x) => (x == null ? null : uuid5(String(x)));
 
// Must match backend/src/lib/password.ts: scrypt$N$r$p$saltB64$hashB64
function hashPassword(pw) {
  const N = 16384, r = 8, p = 1, salt = createHash('sha256').update('shivamstudio-demo-salt').digest().subarray(0, 16);
  const hash = scryptSync(pw, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}
 
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const T = {
  uuid: (v) => (v == null ? 'NULL' : `${q(v)}::uuid`),
  text: (v) => (v == null ? 'NULL' : q(v)),
  int: (v) => (v == null ? 'NULL' : String(Math.round(Number(v)))),
  num: (v) => (v == null ? 'NULL' : String(Number(v))),
  bool: (v) => (v ? 'true' : 'false'),
  date: (v) => (v == null ? 'NULL' : `pg_temp.sd(${q(v.slice(0, 10))})`),
  ts: (v) => (v == null ? 'NULL' : `pg_temp.st(${q(v)})`),
  json: (v) => `${q(JSON.stringify(v))}::jsonb`,
  arr: (v) => (v?.length ? `ARRAY[${v.map(q).join(',')}]::text[]` : `'{}'::text[]`),
  raw: (v) => v,
};
 
const out = [];
const emit = (s) => out.push(s);
 
/** rows: array of objects; cols: [dbColumn, type, (row)=>value]. Upsert on `key`; `skipUpdate` columns are insert-only. */
function upsert(table, cols, rows, { key = 'id', skipUpdate = [] } = {}) {
  if (!rows.length) return;
  emit(`\n-- ${table} (${rows.length})`);
  const names = cols.map((c) => c[0]);
  const keys = Array.isArray(key) ? key : [key];
  const upd = names.filter((n) => !keys.includes(n) && !skipUpdate.includes(n)).map((n) => `${n} = EXCLUDED.${n}`).join(', ');
  const values = rows.map((r) => `  (${cols.map(([, t, f]) => T[t](f(r))).join(', ')})`).join(',\n');
  emit(`INSERT INTO ${table} (${names.join(', ')}) VALUES\n${values}\nON CONFLICT (${keys.join(', ')}) DO ${upd ? `UPDATE SET ${upd}` : 'NOTHING'};`);
}
const g = (k) => (r) => r[k];
const gid = (k) => (r) => id(r[k]);
 
/* ----------------------------------------------------------------------------------------------- data */
const plans = load('plans.json'), settings = load('platform-settings.json'), tenants = load('tenants.json'), configs = load('tenant-config.json');
const users = load('users.json'), photographers = load('photographers.json'), clients = load('clients.json'), services = load('services.json');
const packages = load('packages.json'), bookings = load('bookings.json'), events = load('events.json'), galleries = load('galleries.json');
const videos = load('videos.json'), drive = load('drive-links.json'), testimonials = load('testimonials.json'), blog = load('blog-posts.json');
const notifications = load('notifications.json');
 
// Fail loudly if the mock data ever drifts from what the schema can represent.
const known = new Set([...plans, ...tenants, ...users, ...photographers, ...clients, ...services, ...packages, ...bookings, ...events, ...galleries].map((r) => r.id));
const must = (ref, from) => { if (ref != null && !known.has(ref)) throw new Error(`Dangling reference ${ref} in ${from}`); };
bookings.forEach((b) => { must(b.clientId, b.id); must(b.serviceId, b.id); must(b.packageId, b.id); b.assignedPhotographerIds.forEach((p) => must(p, b.id)); });
events.forEach((e) => { must(e.bookingId, e.id); must(e.clientId, e.id); e.photographerIds.forEach((p) => must(p, e.id)); });
galleries.forEach((x) => { must(x.eventId, x.id); must(x.clientId, x.id); });
notifications.forEach((n) => must(n.userId, n.id));
 
/* ----------------------------------------------------------------------------------------------- output */
emit(`-- seed.sql — GENERATED by tools/generate-seed.mjs from frontend/src/data/mock/*.json. Do not edit by hand.
-- Idempotent demo data: 4 studios, users for every role, catalogue, bookings, events, galleries, videos, Drive links, notifications.
-- Demo password for every seeded login: ${DEMO_PASSWORD}  (stored only as a scrypt hash). NEVER load this seed in production.
-- Run:  npm run db:seed   (as the owner role; the script enables app.system so row-level security allows platform-wide inserts)
BEGIN;
SELECT set_config('app.system', 'on', true);
SELECT set_config('seed.days', (CURRENT_DATE - DATE '${SEED_ANCHOR}')::text, true);
CREATE FUNCTION pg_temp.sd(d date) RETURNS date LANGUAGE sql AS $$ SELECT d + current_setting('seed.days')::int $$;
CREATE FUNCTION pg_temp.st(t timestamptz) RETURNS timestamptz LANGUAGE sql AS
  $$ SELECT LEAST(t + (current_setting('seed.days')::int * interval '1 day'), now() - interval '10 minutes') $$;`);
 
upsert('plans', [
  ['id', 'uuid', gid('id')], ['name', 'text', g('name')], ['price_monthly', 'num', g('priceMonthly')], ['currency', 'text', g('currency')],
  ['max_photographers', 'int', g('maxPhotographers')], ['max_storage_gb', 'int', g('maxStorageGb')], ['max_bookings_per_month', 'int', g('maxBookingsPerMonth')],
  ['features', 'arr', g('features')], ['status', 'text', g('status')],
], plans);
 
emit(`\n-- platform_settings (1)
INSERT INTO platform_settings (singleton, platform_name, support_email, base_domain, default_plan_id, trial_days, allow_self_signup, maintenance_mode, default_delivery_target_hours)
VALUES (true, ${q(settings.platformName)}, ${q(settings.supportEmail)}, ${q(settings.baseDomain)}, ${T.uuid(id(settings.defaultPlanId))}, ${settings.trialDays}, ${T.bool(settings.allowSelfSignup)}, ${T.bool(settings.maintenanceMode)}, ${settings.defaultDeliveryTargetHours})
ON CONFLICT (singleton) DO UPDATE SET platform_name = EXCLUDED.platform_name, support_email = EXCLUDED.support_email, base_domain = EXCLUDED.base_domain,
  default_plan_id = EXCLUDED.default_plan_id, trial_days = EXCLUDED.trial_days, allow_self_signup = EXCLUDED.allow_self_signup,
  maintenance_mode = EXCLUDED.maintenance_mode, default_delivery_target_hours = EXCLUDED.default_delivery_target_hours;`);
 
upsert('tenants', [
  ['id', 'uuid', gid('id')], ['slug', 'text', g('slug')], ['name', 'text', g('name')], ['status', 'text', g('status')], ['plan_id', 'uuid', gid('planId')],
  ['subscription_status', 'text', g('subscriptionStatus')], ['renews_at', 'date', g('renewsAt')], ['subdomain', 'text', g('subdomain')],
  ['custom_domain', 'text', (r) => r.customDomain?.toLowerCase() ?? null], ['owner_name', 'text', g('ownerName')], ['owner_email', 'text', g('ownerEmail')],
  ['city', 'text', g('city')], ['created_at', 'ts', g('createdAt')],
], tenants, { skipUpdate: ['created_at'] });
 
upsert('tenant_configs', ['branding', 'home', 'about', 'contact', 'social', 'footer', 'settings'].map((k) => [k, 'json', g(k)])
  .reduce((a, c) => [...a, c], [['tenant_id', 'uuid', gid('tenantId')]]), configs, { key: 'tenant_id' });
 
const hash = hashPassword(DEMO_PASSWORD);
upsert('users', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['role', 'text', g('role')], ['name', 'text', g('name')], ['email', 'text', g('email')],
  ['phone', 'text', (r) => r.phone ?? ''], ['avatar_url', 'text', (r) => r.avatarUrl ?? ''], ['password_hash', 'text', () => hash], ['status', 'text', g('status')],
], users, { skipUpdate: [] });
 
upsert('photographers', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['user_id', 'uuid', gid('userId')], ['name', 'text', g('name')], ['slug', 'text', g('slug')],
  ['title', 'text', g('title')], ['bio', 'text', g('bio')], ['avatar_url', 'text', g('avatarUrl')], ['email', 'text', g('email')], ['phone', 'text', g('phone')],
  ['experience_years', 'int', g('experienceYears')], ['rating', 'num', g('rating')], ['specialties', 'arr', g('specialties')], ['skills', 'arr', g('skills')],
  ['equipment', 'arr', g('equipment')], ['portfolio', 'arr', g('portfolio')], ['status', 'text', g('status')], ['featured', 'bool', g('featured')],
  ['availability', 'raw', (r) => {
    const a = r.availability;
    const blocked = a.blockedDates.length ? `(SELECT coalesce(jsonb_agg(pg_temp.sd(d::date)), '[]'::jsonb) FROM unnest(ARRAY[${a.blockedDates.map(q).join(',')}]) AS d)` : `'[]'::jsonb`;
    return `jsonb_build_object('weekdays', ${q(JSON.stringify(a.weekdays))}::jsonb, 'blockedDates', ${blocked}, 'note', ${q(a.note ?? '')})`;
  }],
  ['created_at', 'ts', g('createdAt')],
], photographers, { skipUpdate: ['created_at'] });
 
upsert('clients', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['user_id', 'uuid', gid('userId')], ['name', 'text', g('name')], ['email', 'text', g('email')],
  ['phone', 'text', g('phone')], ['city', 'text', g('city')], ['notes', 'text', g('notes')], ['source', 'text', g('source')], ['created_at', 'ts', g('createdAt')],
], clients, { skipUpdate: ['created_at'] });
 
upsert('services', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['name', 'text', g('name')], ['slug', 'text', g('slug')], ['category', 'text', g('category')],
  ['description', 'text', g('description')], ['starting_price', 'num', g('startingPrice')], ['image_url', 'text', g('imageUrl')], ['status', 'text', g('status')],
  ['featured', 'bool', g('featured')], ['sort_order', 'int', g('sortOrder')],
], services);
 
upsert('packages', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['service_id', 'uuid', gid('serviceId')], ['name', 'text', g('name')], ['description', 'text', g('description')],
  ['price', 'num', g('price')], ['duration_hours', 'int', g('durationHours')], ['photographer_count', 'int', g('photographerCount')], ['deliverables', 'arr', g('deliverables')],
  ['features', 'arr', g('features')], ['popular', 'bool', g('popular')], ['status', 'text', g('status')], ['sort_order', 'int', g('sortOrder')],
], packages);
 
upsert('bookings', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['reference', 'text', g('reference')], ['client_id', 'uuid', gid('clientId')],
  ['customer_name', 'text', (r) => r.customer.name], ['customer_email', 'text', (r) => r.customer.email], ['customer_phone', 'text', (r) => r.customer.phone],
  ['service_id', 'uuid', gid('serviceId')], ['package_id', 'uuid', gid('packageId')], ['event_date', 'date', g('eventDate')], ['location', 'text', g('location')],
  ['guest_count', 'int', g('guestCount')], ['requirements', 'text', g('requirements')], ['status', 'text', g('status')], ['payment_status', 'text', g('paymentStatus')],
  ['amount', 'num', g('amount')], ['paid_amount', 'num', g('paidAmount')], ['source', 'text', g('source')], ['created_at', 'ts', g('createdAt')], ['updated_at', 'ts', g('updatedAt')],
], bookings, { skipUpdate: ['created_at'] });
 
const junction = (rows, owner, ownerCol) => rows.flatMap((r) => r.photographerIds.map((p, i) => ({ tenantId: r.tenantId, [ownerCol]: r.id, ph: p, pos: i })));
upsert('booking_photographers', [
  ['tenant_id', 'uuid', gid('tenantId')], ['booking_id', 'uuid', gid('booking_id')], ['photographer_id', 'uuid', gid('ph')], ['position', 'int', g('pos')],
], bookings.flatMap((b) => b.assignedPhotographerIds.map((p, i) => ({ tenantId: b.tenantId, booking_id: b.id, ph: p, pos: i }))), { key: ['booking_id', 'photographer_id'] });
 
upsert('booking_notes', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['booking_id', 'uuid', gid('booking_id')], ['author_name', 'text', g('authorName')], ['text', 'text', g('text')], ['created_at', 'ts', g('createdAt')],
], bookings.flatMap((b) => b.notes.map((n) => ({ ...n, tenantId: b.tenantId, booking_id: b.id }))), { skipUpdate: ['created_at'] });
 
upsert('events', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['booking_id', 'uuid', gid('bookingId')], ['client_id', 'uuid', gid('clientId')], ['title', 'text', g('title')],
  ['type', 'text', g('type')], ['date', 'date', g('date')], ['start_time', 'text', g('startTime')], ['venue', 'text', g('venue')], ['city', 'text', g('city')],
  ['description', 'text', g('description')], ['status', 'text', g('status')], ['progress', 'text', g('progress')], ['is_public', 'bool', g('isPublic')], ['cover_url', 'text', g('coverUrl')],
  ['delivery_target_hours', 'int', (r) => r.delivery.targetHours], ['delivery_completed_at', 'ts', (r) => r.delivery.completedAt],
  ['delivery_highlights_submitted_at', 'ts', (r) => r.delivery.highlightsSubmittedAt], ['delivery_highlights_published_at', 'ts', (r) => r.delivery.highlightsPublishedAt],
  ['delivery_gallery_published_at', 'ts', (r) => r.delivery.galleryPublishedAt], ['delivery_notes', 'text', (r) => r.delivery.notes], ['created_at', 'ts', g('createdAt')],
], events, { skipUpdate: ['created_at'] });
 
upsert('event_photographers', [
  ['tenant_id', 'uuid', gid('tenantId')], ['event_id', 'uuid', gid('event_id')], ['photographer_id', 'uuid', gid('ph')], ['position', 'int', g('pos')],
], events.flatMap((e) => e.photographerIds.map((p, i) => ({ tenantId: e.tenantId, event_id: e.id, ph: p, pos: i }))), { key: ['event_id', 'photographer_id'] });
 
upsert('event_notes', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['event_id', 'uuid', gid('event_id')], ['author_name', 'text', g('authorName')], ['author_role', 'text', g('authorRole')],
  ['text', 'text', g('text')], ['created_at', 'ts', g('createdAt')],
], events.flatMap((e) => e.notes.map((n) => ({ ...n, tenantId: e.tenantId, event_id: e.id }))), { skipUpdate: ['created_at'] });
 
upsert('galleries', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['event_id', 'uuid', gid('eventId')], ['client_id', 'uuid', gid('clientId')], ['title', 'text', g('title')],
  ['description', 'text', g('description')], ['cover_url', 'text', g('coverUrl')], ['visibility', 'text', g('visibility')],
  ['highlights_submitted_at', 'ts', g('highlightsSubmittedAt')], ['highlights_published_at', 'ts', g('highlightsPublishedAt')], ['complete_published_at', 'ts', g('completePublishedAt')],
  ['created_at', 'ts', g('createdAt')], ['updated_at', 'ts', g('updatedAt')],
], galleries, { skipUpdate: ['created_at'] });
 
upsert('gallery_external_links', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['gallery_id', 'uuid', gid('gallery_id')], ['label', 'text', g('label')], ['url', 'text', g('url')], ['sort_order', 'int', g('sort')],
], galleries.flatMap((x) => x.externalLinks.map((l, i) => ({ ...l, tenantId: x.tenantId, gallery_id: x.id, sort: i }))));
 
const photos = galleries.flatMap((x) => x.photos.map((p) => ({ ...p, tenantId: x.tenantId, gallery_id: x.id })));
upsert('gallery_photos', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['gallery_id', 'uuid', gid('gallery_id')], ['url', 'text', g('url')], ['title', 'text', g('title')],
  ['description', 'text', g('description')], ['category', 'text', g('category')], ['is_highlight', 'bool', g('isHighlight')], ['featured', 'bool', (r) => !!r.featured],
  ['sort_order', 'int', g('order')], ['width', 'int', g('width')], ['height', 'int', g('height')], ['camera', 'text', (r) => r.camera ?? null], ['lens', 'text', (r) => r.lens ?? null],
  ['exposure', 'text', (r) => r.exposure ?? null],
], photos);
 
upsert('videos', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['title', 'text', g('title')], ['description', 'text', g('description')], ['youtube_url', 'text', g('youtubeUrl')],
  ['youtube_id', 'text', g('youtubeId')], ['category', 'text', g('category')], ['thumbnail_url', 'text', g('thumbnailUrl')], ['featured', 'bool', g('featured')], ['enabled', 'bool', g('enabled')],
  ['visibility', 'text', g('visibility')], ['event_id', 'uuid', gid('eventId')], ['client_id', 'uuid', gid('clientId')], ['created_at', 'ts', g('createdAt')],
], videos, { skipUpdate: ['created_at'] });
 
upsert('drive_links', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['title', 'text', g('title')], ['url', 'text', g('url')], ['folder_id', 'text', g('folderId')],
  ['description', 'text', g('description')], ['event_id', 'uuid', gid('eventId')], ['client_id', 'uuid', gid('clientId')], ['visibility', 'text', g('visibility')], ['created_at', 'ts', g('createdAt')],
], drive, { skipUpdate: ['created_at'] });
 
upsert('testimonials', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['client_name', 'text', g('clientName')], ['role', 'text', g('role')], ['event_type', 'text', g('eventType')],
  ['rating', 'int', g('rating')], ['quote', 'text', g('quote')], ['avatar_url', 'text', g('avatarUrl')], ['featured', 'bool', g('featured')], ['created_at', 'ts', g('createdAt')],
], testimonials, { skipUpdate: ['created_at'] });
 
upsert('blog_posts', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['slug', 'text', g('slug')], ['title', 'text', g('title')], ['excerpt', 'text', g('excerpt')], ['body', 'text', g('body')],
  ['cover_url', 'text', g('coverUrl')], ['category', 'text', g('category')], ['author_name', 'text', g('authorName')], ['read_minutes', 'int', g('readMinutes')],
  ['published_at', 'ts', g('publishedAt')], ['status', 'text', g('status')],
], blog);
 
upsert('notifications', [
  ['id', 'uuid', gid('id')], ['tenant_id', 'uuid', gid('tenantId')], ['user_id', 'uuid', gid('userId')], ['type', 'text', g('type')], ['title', 'text', g('title')], ['body', 'text', g('body')],
  ['link', 'text', g('link')], ['read', 'bool', g('read')], ['created_at', 'ts', g('createdAt')],
], notifications, { skipUpdate: ['created_at'] });
 
const seen = new Set();
upsert('sample_photos', [
  ['id', 'uuid', (r) => id(`sample:${r.url}`)], ['url', 'text', g('url')], ['title', 'text', g('title')], ['category', 'text', g('category')], ['width', 'int', g('width')], ['height', 'int', g('height')],
], photos.filter((p) => !seen.has(p.url) && seen.add(p.url)));
 
emit('\nCOMMIT;\n');
writeFileSync(OUT, out.join('\n'));
console.log(`seed.sql written (${(out.join('\n').length / 1024).toFixed(0)} KB, ${tenants.length} tenants, ${users.length} users, ${bookings.length} bookings, ${events.length} events, ${photos.length} photos)`);