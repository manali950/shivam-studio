/**
 * Mock implementation of DataProvider. Behaves like the real backend: tenant scoping, role-based row
 * visibility, validation, notifications and the next-day delivery workflow all happen here — so React
 * components never need to know whether they are talking to JSON or to Node.js + PostgreSQL.
 */
import type {
  Booking, BookingStatus, Client, DeliveryInfo, DriveLink, Gallery, GalleryPhoto, GallerySummary, ID, Package, Photographer,
  PlatformStats, PortfolioPhoto, Service, StudioDashboard, StudioEvent, Tenant, TenantConfig, Testimonial, User, Video,
} from '@/types';
import { matchesSearch, slugify, todayISO, uid } from '@/lib/utils';
import { parseDrive, parseYouTube } from '@/lib/media';
import { ApiError } from '../errors';
import type {
  AnalyticsService, AuthService, BookingService, DataProvider, DeepPartial, EventService, GalleryService, NotificationService,
  PlatformService, TenantService, ClientService, BlogService,
} from './types';
import { actor, checkPassword, getDb, hashPassword, readSession, scoped, resetDb, save, stripPassword, writeSession } from './mock/db';
import {
  adminIds, assertTenantAccess, clientUserId, clone, crud, delay, isStaff, notFound, notify, now, paginate, requireRole, sortItems,
} from './mock/helpers';
 
const role = () => actor()?.role ?? 'anon';
const cfgOf = (tenantId: ID) => getDb().configs.find((c) => c.tenantId === tenantId) ?? notFound('Tenant configuration');
const tenantOf = (id: ID) => getDb().tenants.find((t) => t.id === id) ?? notFound('Studio');
const noDelivery = (hrs: number): DeliveryInfo => ({ targetHours: hrs, completedAt: null, highlightsSubmittedAt: null, highlightsPublishedAt: null, galleryPublishedAt: null, status: 'not_due', notes: '' });
const invalid = (msg: string, details?: unknown): never => { throw new ApiError(422, 'VALIDATION_ERROR', msg, details); };
const conflict = (msg: string): never => { throw new ApiError(409, 'CONFLICT', msg); };
 
/* ================================================================ tenants */
function deepMerge<T>(target: T, patch: DeepPartial<T>): T {
  for (const [k, v] of Object.entries(patch as object)) {
    const t = target as any;
    if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object') deepMerge(t[k], v as any);
    else if (v !== undefined) t[k] = v;
  }
  return target;
}
function defaultConfig(tenantId: ID, name: string, city: string, email: string): TenantConfig {
  const monogram = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const svg = (bg: string, fg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${bg}"/><text x="32" y="41" text-anchor="middle" font-family="Georgia,serif" font-size="26" font-weight="700" fill="${fg}">${monogram}</text></svg>`)}`;
  return {
    tenantId,
    branding: { logoUrl: svg('#1d1b19', '#b08d57'), faviconUrl: svg('#1d1b19', '#b08d57'), primaryColor: '#B08D57', secondaryColor: '#1d1b19', tagline: 'Stories worth keeping',
      heroImageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=2000&q=70' },
    home: { headline: 'Photographs that feel like your story.', subheadline: `${name} — premium photography from ${city || 'your city'}.`, heroCtaLabel: 'Book a session', featuredPhotoUrls: [] },
    about: { title: `About ${name}`, intro: 'Tell your studio story here.', history: '', philosophy: '', achievements: [], milestones: [] },
    contact: { email, phone: '', whatsapp: '', address: '', city, mapUrl: '', hours: 'Mon–Sat · 10:00–18:00' },
    social: {}, footer: { text: '', copyright: `© ${new Date().getFullYear()} ${name}.` },
    settings: { currency: 'INR', locale: 'en-IN', deliveryTargetHours: 24,
      booking: { enquiryEnabled: true, autoConfirm: false, requireDeposit: true, depositPercent: 30, minLeadDays: 3 },
      notifications: { emailOnNewBooking: true, emailOnDelivery: true, smsReminders: false, reminderDaysBefore: 3 },
      business: { legalName: name, taxId: '', invoicePrefix: slugify(name).slice(0, 3).toUpperCase(), timezone: 'Asia/Kolkata' } },
  };
}
 
const tenants: TenantService = {
  async resolve({ host, slug }) {
    await delay(60);
    const ts = getDb().tenants;
    if (slug) return clone(ts.find((t) => t.slug === slug.toLowerCase()) ?? null);
    if (host) {
      const h = host.toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
      const base = (import.meta.env.VITE_BASE_DOMAIN as string | undefined)?.toLowerCase();
      const sub = base && h.endsWith(`.${base}`) ? h.slice(0, -base.length - 1) : h.endsWith('.localhost') ? h.replace('.localhost', '') : null;
      return clone(ts.find((t) => t.customDomain?.toLowerCase() === h || (sub && t.subdomain === sub)) ?? null);
    }
    return null;
  },
  async listPublic() { await delay(40); return clone(getDb().tenants); },
  async list(params = {}) {
    await delay();
    requireRole('super_admin');
    let rows = getDb().tenants.filter((t) => (!params.status || t.status === params.status) && matchesSearch([t.name, t.slug, t.city, t.ownerName], params.search));
    rows = sortItems(rows, params.sort ?? 'createdAt', params.order ?? 'desc');
    return paginate(rows, params);
  },
  async get(id) { await delay(40); return clone(tenantOf(id)); },
  async create(input) {
    await delay(300);
    requireRole('super_admin');
    const db = getDb();
    const slug = slugify(input.slug);
    if (!slug || ['platform', 'api', 'admin', 'www'].includes(slug)) invalid('This slug is reserved or empty.');
    if (db.tenants.some((t) => t.slug === slug)) conflict('A studio with this slug already exists.');
    if (db.users.some((u) => u.email.toLowerCase() === input.ownerEmail.toLowerCase())) conflict('That owner email is already registered.');
    const t: Tenant = {
      id: uid('t'), slug, name: input.name, status: input.status ?? 'trial', planId: input.planId ?? db.settings.defaultPlanId,
      subscriptionStatus: 'trialing', renewsAt: new Date(Date.now() + db.settings.trialDays * 86400000).toISOString().slice(0, 10),
      subdomain: input.subdomain || slug, customDomain: input.customDomain || null, ownerName: input.ownerName, ownerEmail: input.ownerEmail,
      city: input.city ?? '', createdAt: now(),
    };
    db.tenants.push(t);
    db.configs.push(defaultConfig(t.id, t.name, t.city, t.ownerEmail));
    db.users.push({ id: uid('u'), tenantId: t.id, role: 'studio_admin', name: t.ownerName, email: t.ownerEmail, phone: '', avatarUrl: '', status: 'active', password: 'Demo@12345' });
    save();
    return { ...clone(t), ownerTemporaryPassword: 'Demo@12345' };   // mock: the shared public demo password
  },
  async update(id, input) {
    await delay();
    requireRole('super_admin');
    const t = tenantOf(id);
    if (input.slug && input.slug !== t.slug && getDb().tenants.some((x) => x.slug === input.slug)) conflict('A studio with this slug already exists.');
    Object.assign(t, input, { id }); save();
    return clone(t);
  },
  async setStatus(id, status) {
    await delay();
    requireRole('super_admin');
    const t = tenantOf(id); t.status = status;
    if (status === 'active' && t.subscriptionStatus !== 'active') t.subscriptionStatus = 'active';
    save(); return clone(t);
  },
  async getConfig(tenantId) { await delay(40); return clone(cfgOf(tenantId)); },
  async submitContact(tenantId, input) {
    await delay(300);
    if (tenantOf(tenantId).status === 'inactive') throw new ApiError(403, 'TENANT_INACTIVE', 'This studio is not accepting messages.');
    if (!input.message.trim() || !input.email.includes('@')) invalid('Please provide a valid email and message.');
    notify(tenantId, adminIds(tenantId), { type: 'new_enquiry', title: `Message from ${input.name}`, body: input.message.slice(0, 140), link: '/admin/bookings' });
    save();
  },
  async updateConfig(tenantId, patch) {
    await delay();
    assertTenantAccess(tenantId); requireRole('studio_admin', 'super_admin');
    const c = deepMerge(cfgOf(tenantId), patch); save();
    return clone(c);
  },
};
 
/* ================================================================ auth (mock — not production security) */
const sessionOf = (u: typeof getDb extends () => infer D ? D extends { users: (infer U)[] } ? U : never : never) =>
  ({ user: stripPassword(u), token: `mock.${u.id}.${Date.now().toString(36)}` });
 
const auth: AuthService = {
  async login({ email, password, tenantId }) {
    await delay(350);
    const found = getDb().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && (tenantId ? x.tenantId === tenantId : x.tenantId === null));
    const u = found && (await checkPassword(found, password)) ? found : undefined;
    if (!u)
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    if (u.status !== 'active') throw new ApiError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
    if (u.tenantId && tenantOf(u.tenantId).status === 'inactive') throw new ApiError(403, 'TENANT_INACTIVE', 'This studio is currently inactive.');
    const s = sessionOf(u); writeSession({ userId: u.id, token: s.token });
    return s;
  },
  async register({ name, email, phone, password, tenantId }) {
    await delay(400);
    const db = getDb();
    if (tenantOf(tenantId).status === 'inactive') throw new ApiError(403, 'TENANT_INACTIVE', 'This studio is not accepting sign-ups.');
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) conflict('An account with this email already exists.');
    const existing = db.clients.find((c) => c.tenantId === tenantId && c.email.toLowerCase() === email.toLowerCase());
    const userId = uid('u');
    const client: Client = existing ?? { id: uid('cl'), tenantId, userId, name, email, phone, city: '', notes: '', source: 'website', createdAt: now() };
    client.userId = userId; if (!existing) db.clients.push(client);
    const u = { id: userId, tenantId, role: 'client' as const, name, email, phone, avatarUrl: '', clientId: client.id, status: 'active' as const, passwordHash: await hashPassword(password) };
    db.users.push(u); save();
    const s = sessionOf(u); writeSession({ userId, token: s.token });
    return s;
  },
  async logout() { await delay(40); writeSession(null); },
  async demoAccounts(tenantId) {
    return getDb().users.filter((u) => u.tenantId === tenantId && u.password !== undefined).map((u) => ({ role: u.role, name: u.name, email: u.email, password: u.password! }));
  },
  async me() {
    const s = readSession(); const u = actor();
    return s && u ? { user: stripPassword(u), token: s.token } : null;
  },
  async updateProfile(patch) {
    await delay();
    const u = actor() ?? notFound('Session');
    Object.assign(u, patch);
    const db = getDb();
    const linked = db.clients.find((c) => c.id === u.clientId) ?? db.photographers.find((p) => p.id === u.photographerId);
    if (linked) Object.assign(linked, { name: u.name, phone: u.phone });
    save(); return stripPassword(u);
  },
  async changePassword({ current, next }) {
    await delay(300);
    const u = actor() ?? notFound('Session');
    if (!(await checkPassword(u, current))) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
    if (next.length < 8) invalid('New password must be at least 8 characters.');
    u.passwordHash = await hashPassword(next); delete u.password; save();
  },
};
 
/* ================================================================ simple catalogue collections */
const photographers = crud<Photographer, Partial<Photographer>, Partial<Photographer>, any>({
  key: 'photographers', prefix: 'ph', label: 'Photographer', sort: 'name',
  search: (p) => [p.name, p.title, ...p.specialties],
  filter: (p, f) => (!f.status || p.status === f.status) && (!f.specialty || p.specialties.includes(f.specialty)) && (f.featured === undefined || p.featured === f.featured),
  scope: (rows) => (isStaff() ? rows : rows.filter((r) => r.status !== 'inactive')),
  defaults: () => ({ status: 'active', featured: false, rating: 5, specialties: [], skills: [], equipment: [], portfolio: [], avatarUrl: '', experienceYears: 1, availability: { weekdays: [1, 2, 3, 4, 5, 6], blockedDates: [], note: '' } }),
  beforeSave: (p) => { p.slug = slugify(p.name); },
  afterRemove: (p) => {
    const db = getDb();
    db.events.forEach((e) => { e.photographerIds = e.photographerIds.filter((i) => i !== p.id); });
    db.bookings.forEach((b) => { b.assignedPhotographerIds = b.assignedPhotographerIds.filter((i) => i !== p.id); });
  },
});
 
const services = crud<Service, Partial<Service>, Partial<Service>, any>({
  key: 'services', prefix: 'svc', label: 'Service', sort: 'sortOrder',
  search: (s) => [s.name, s.category, s.description],
  filter: (s, f) => (!f.status || s.status === f.status) && (!f.category || s.category === f.category),
  scope: (rows) => (isStaff() ? rows : rows.filter((r) => r.status === 'active')),
  defaults: (tid) => ({ status: 'active', featured: false, imageUrl: '', sortOrder: getDb().services.filter((s) => s.tenantId === tid).length + 1, startingPrice: 0 }),
  beforeSave: (s) => { s.slug = slugify(s.name); },
  afterRemove: (s) => { if (getDb().packages.some((p) => p.serviceId === s.id)) { getDb().services.push(s); conflict('Remove or move this service’s packages first.'); } },
});
 
const packages = crud<Package, Partial<Package>, Partial<Package>, any>({
  key: 'packages', prefix: 'pkg', label: 'Package', sort: 'sortOrder',
  search: (p) => [p.name, p.description],
  filter: (p, f) => (!f.status || p.status === f.status) && (!f.serviceId || p.serviceId === f.serviceId),
  scope: (rows) => (isStaff() ? rows : rows.filter((r) => r.status === 'active')),
  defaults: (tid) => ({ status: 'active', popular: false, deliverables: [], features: [], description: '', sortOrder: getDb().packages.filter((p) => p.tenantId === tid).length + 1 }),
  beforeSave: (p) => {
    const svc = getDb().services.find((s) => s.id === p.serviceId && s.tenantId === p.tenantId);
    if (!svc) invalid('Choose a valid service for this package.');
  },
});
  
const testimonials = crud<Testimonial, Partial<Testimonial>, Partial<Testimonial>, any>({
  key: 'testimonials', prefix: 'tst', label: 'Testimonial', sort: 'createdAt', order: 'desc',
  search: (t) => [t.clientName, t.quote],
  filter: (t, f) => f.featured === undefined || t.featured === f.featured,
  defaults: () => ({ featured: false, rating: 5, avatarUrl: '', role: '' }),
});
 
const blogCrud = crud<any, any, any, any>({
  key: 'blog', prefix: 'blg', label: 'Blog post', sort: 'publishedAt', order: 'desc',
  search: (b) => [b.title, b.excerpt],
  filter: (b, f) => (!f.status || b.status === f.status) && (!f.category || b.category === f.category),
  scope: (rows) => (isStaff() ? rows : rows.filter((r) => r.status === 'published')),
});
const blog: BlogService = {
  ...(blogCrud as unknown as BlogService),
  async getBySlug(tenantId, slug) {
    await delay(50);
    return scoped(tenantId, () => {
      const b = getDb().blog.find((x) => x.tenantId === tenantId && x.slug === slug && (isStaff() || x.status === 'published'));
      return b ? clone(b) : notFound('Article');
    });
  },
};
 
const videos = crud<Video, Partial<Video>, Partial<Video>, any>({
  key: 'videos', prefix: 'vid', label: 'Video', sort: 'createdAt', order: 'desc',
  search: (v) => [v.title, v.description, v.category],
  filter: (v, f) => (!f.category || v.category === f.category) && (f.featured === undefined || v.featured === f.featured)
    && (f.enabled === undefined || v.enabled === f.enabled) && (!f.visibility || v.visibility === f.visibility)
    && (!f.clientId || v.clientId === f.clientId) && (!f.eventId || v.eventId === f.eventId),
  scope: (rows) => {
    const a = actor();
    if (a && (a.role === 'studio_admin' || a.role === 'super_admin')) return rows;
    return rows.filter((v) => v.enabled && (v.visibility === 'public' || (a?.role === 'client' && v.clientId === a.clientId)));
  },
  defaults: () => ({ featured: false, enabled: true, visibility: 'public', eventId: null, clientId: null, description: '', category: 'showcase', thumbnailUrl: '' }),
  beforeSave: (v) => {
    const info = parseYouTube(v.youtubeUrl ?? '');
    if (!info) invalid('Enter a valid YouTube link (watch, youtu.be, embed or shorts).', { youtubeUrl: 'Unsupported YouTube URL' });
    v.youtubeId = info!.id; v.youtubeUrl = info!.watchUrl;
    if (!v.thumbnailUrl) v.thumbnailUrl = info!.thumbnail;
  },
});
 
const drive = crud<DriveLink, Partial<DriveLink>, Partial<DriveLink>, any>({
  key: 'drive', prefix: 'drv', label: 'Drive link', sort: 'createdAt', order: 'desc',
  search: (l) => [l.title, l.description],
  filter: (l, f) => (!f.clientId || l.clientId === f.clientId) && (!f.eventId || l.eventId === f.eventId) && (!f.visibility || l.visibility === f.visibility),
  scope: (rows) => {
    const a = actor();
    if (a && (a.role === 'studio_admin' || a.role === 'super_admin')) return rows;
    return a?.role === 'client' ? rows.filter((l) => l.visibility === 'client' && l.clientId === a.clientId) : [];
  },
  defaults: () => ({ visibility: 'client', eventId: null, clientId: null, description: '' }),
  beforeSave: (l) => {
    const info = parseDrive(l.url ?? '');
    if (!info) invalid('Enter a valid Google Drive folder or file link (https://drive.google.com/…).', { url: 'Unsupported Drive URL' });
    l.folderId = info!.id;
  },
});
 
/* ================================================================ clients */
const clientsCrud = crud<Client, Partial<Client>, Partial<Client>, any>({
  key: 'clients', prefix: 'cl', label: 'Client', sort: 'createdAt', order: 'desc',
  search: (c) => [c.name, c.email, c.phone, c.city],
  scope: (rows) => (isStaff() ? rows : []),
  defaults: () => ({ phone: '', city: '', notes: '', source: 'walk-in', userId: null }),
  beforeSave: (c) => {
    const dup = getDb().clients.find((x) => x.tenantId === c.tenantId && x.id !== c.id && x.email.toLowerCase() === c.email?.toLowerCase());
    if (dup) conflict('A customer with this email already exists.');
  },
});
const clients: ClientService = {
  ...clientsCrud,
  async profile(tenantId, id) {
    await delay();
    assertTenantAccess(tenantId); requireRole('studio_admin', 'super_admin');
    const db = getDb();
    const client = db.clients.find((c) => c.id === id && c.tenantId === tenantId) ?? notFound('Customer');
    return clone({
      client,
      bookings: db.bookings.filter((b) => b.tenantId === tenantId && b.clientId === id).sort((a, b) => b.eventDate.localeCompare(a.eventDate)),
      events: db.events.filter((e) => e.tenantId === tenantId && e.clientId === id).sort((a, b) => b.date.localeCompare(a.date)),
    });
  },
};
 
/* ================================================================ bookings */
function ensureClient(b: Booking) {
  const db = getDb();
  if (b.clientId) return db.clients.find((c) => c.id === b.clientId)!;
  const found = db.clients.find((c) => c.tenantId === b.tenantId && c.email.toLowerCase() === b.customer.email.toLowerCase());
  const c: Client = found ?? { id: uid('cl'), tenantId: b.tenantId, userId: null, name: b.customer.name, email: b.customer.email, phone: b.customer.phone, city: '', notes: '', source: b.source === 'manual' ? 'walk-in' : (b.source as Client['source']), createdAt: now() };
  if (!found) db.clients.push(c);
  b.clientId = c.id;
  return c;
}
function ensureEvent(b: Booking) {
  const db = getDb();
  if (b.eventId && db.events.some((e) => e.id === b.eventId)) return;
  const svc = db.services.find((s) => s.id === b.serviceId);
  const e: StudioEvent = {
    id: uid('ev'), tenantId: b.tenantId, bookingId: b.id, clientId: b.clientId, title: `${b.customer.name} — ${svc?.name ?? 'Photography'}`,
    type: svc?.category ?? 'event', date: b.eventDate, startTime: '10:00', venue: b.location, city: '', description: b.requirements,
    status: 'scheduled', progress: 'planned', photographerIds: [...b.assignedPhotographerIds], isPublic: false, coverUrl: svc?.imageUrl ?? '', notes: [],
    delivery: noDelivery(cfgOf(b.tenantId).settings.deliveryTargetHours), createdAt: now(),
  };
  db.events.push(e); b.eventId = e.id;
}
const derivePayment = (b: Booking) => { if (b.paymentStatus === 'refunded') return; b.paymentStatus = b.paidAmount <= 0 ? 'unpaid' : b.paidAmount >= b.amount ? 'paid' : 'partial'; };
 
const bookingsCrud = crud<Booking, any, Partial<Booking>, any>({
  key: 'bookings', prefix: 'bk', label: 'Booking', sort: 'createdAt', order: 'desc',
  search: (b) => [b.reference, b.customer.name, b.customer.email, b.location],
  filter: (b, f) => (!f.status || b.status === f.status) && (!f.clientId || b.clientId === f.clientId) && (!f.paymentStatus || b.paymentStatus === f.paymentStatus)
    && (!f.photographerId || b.assignedPhotographerIds.includes(f.photographerId)) && (!f.from || b.eventDate >= f.from) && (!f.to || b.eventDate <= f.to),
  scope: (rows) => {
    const a = actor();
    if (!a) return [];
    if (a.role === 'client') return rows.filter((b) => b.clientId === a.clientId);
    if (a.role === 'photographer') return rows.filter((b) => !!a.photographerId && b.assignedPhotographerIds.includes(a.photographerId));
    return rows;
  },
  beforeSave: (b, input, mode) => {
    if ('paidAmount' in (input as object) && !('paymentStatus' in (input as object))) derivePayment(b);
    if (mode === 'update') b.updatedAt = now();
  },
});
const bookings: BookingService = {
  ...(bookingsCrud as unknown as BookingService),
  async create(tenantId, input) {
    await delay(280);
    assertTenantAccess(tenantId);                       // anonymous visitors may submit enquiries to an active studio
    const db = getDb(); const a = actor(); const tenant = tenantOf(tenantId); const cfg = cfgOf(tenantId);
    if (tenant.status === 'inactive') throw new ApiError(403, 'TENANT_INACTIVE', 'This studio is not accepting bookings.');
    const staff = isStaff();
    if (!cfg.settings.booking.enquiryEnabled && !staff) throw new ApiError(403, 'ENQUIRIES_CLOSED', 'Online enquiries are currently closed.');
    const svc = db.services.find((s) => s.id === input.serviceId && s.tenantId === tenantId && (staff || s.status === 'active')) ?? invalid('Please choose a valid service.');
    const pkg = input.packageId ? db.packages.find((p) => p.id === input.packageId && p.tenantId === tenantId && p.serviceId === svc.id) ?? invalid('That package does not belong to the selected service.') : null;
    if (!staff && (input.eventDate < todayISO())) invalid('Event date must be in the future.', { eventDate: 'Choose a future date' });
    const client = a?.role === 'client' ? db.clients.find((c) => c.id === a.clientId) : db.clients.find((c) => c.tenantId === tenantId && c.email.toLowerCase() === input.customer.email.toLowerCase());
    const n = db.bookings.filter((b) => b.tenantId === tenantId).length + 1;
    const b: Booking = {
      id: uid('bk'), tenantId, reference: `${cfg.settings.business.invoicePrefix || 'BK'}-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`,
      clientId: client?.id ?? null, customer: client ? { name: client.name, email: client.email, phone: client.phone } : input.customer,
      serviceId: svc.id, packageId: pkg?.id ?? null, eventDate: input.eventDate, location: input.location, guestCount: input.guestCount ?? null,
      requirements: input.requirements ?? '', status: staff ? input.status ?? 'enquiry' : 'enquiry', paymentStatus: 'unpaid',
      amount: input.amount ?? pkg?.price ?? svc.startingPrice, paidAmount: 0, assignedPhotographerIds: [], notes: [], eventId: null,
      source: staff ? input.source ?? 'manual' : 'website', createdAt: now(), updatedAt: now(),
    };
    db.bookings.push(b);
    notify(tenantId, adminIds(tenantId), { type: 'new_enquiry', title: `New enquiry — ${b.customer.name}`, body: `${svc.name} · ${b.location} · ${b.eventDate}`, link: '/admin/bookings' });
    save(); return clone(b);
  },
  async setStatus(tenantId, id, status, note) {
    await delay();
    assertTenantAccess(tenantId); const me = requireRole('studio_admin', 'super_admin');
    const db = getDb();
    const b = db.bookings.find((x) => x.id === id && x.tenantId === tenantId) ?? notFound('Booking');
    if (b.status === 'completed' && status !== 'completed') conflict('Completed bookings cannot be changed.');
    b.status = status; b.updatedAt = now();
    if (status === 'confirmed') { ensureClient(b); ensureEvent(b); }
    if (note) b.notes.push({ id: uid('bn'), authorName: me.name, text: note, createdAt: now() });
    const msg: Partial<Record<BookingStatus, [string, string]>> = {
      confirmed: ['Booking confirmed 🎉', `Your booking ${b.reference} is confirmed for ${b.eventDate}.`],
      rejected: ['Booking update', `Unfortunately we cannot take booking ${b.reference}. ${note ?? ''}`],
      cancelled: ['Booking cancelled', `Booking ${b.reference} has been cancelled.`],
      pending: ['Booking under review', `We are reviewing booking ${b.reference} and will confirm shortly.`],
    };
    if (msg[status]) notify(tenantId, [clientUserId(b.clientId)], { type: status === 'confirmed' ? 'booking_confirmed' : 'booking_update', title: msg[status]![0], body: msg[status]![1], link: '/portal/bookings' });
    save(); return clone(b);
  },
  async assignPhotographers(tenantId, id, photographerIds) {
    await delay();
    assertTenantAccess(tenantId); requireRole('studio_admin', 'super_admin');
    const db = getDb();
    const b = db.bookings.find((x) => x.id === id && x.tenantId === tenantId) ?? notFound('Booking');
    if (photographerIds.some((pid) => !db.photographers.some((p) => p.id === pid && p.tenantId === tenantId))) invalid('One or more photographers do not belong to this studio.');
    const added = photographerIds.filter((pid) => !b.assignedPhotographerIds.includes(pid));
    b.assignedPhotographerIds = photographerIds; b.updatedAt = now();
    const ev = db.events.find((e) => e.id === b.eventId); if (ev) ev.photographerIds = [...photographerIds];
    notify(tenantId, added.map((pid) => db.photographers.find((p) => p.id === pid)?.userId), { type: 'booking_update', title: `You were assigned to ${b.customer.name}`, body: `${b.eventDate} · ${b.location}`, link: '/photographer/events' });
    save(); return clone(b);
  },
  async addNote(tenantId, id, text) {
    await delay(80);
    assertTenantAccess(tenantId); const me = requireRole('studio_admin', 'super_admin');
    const b = getDb().bookings.find((x) => x.id === id && x.tenantId === tenantId) ?? notFound('Booking');
    if (!text.trim()) invalid('Note cannot be empty.');
    const n = { id: uid('bn'), authorName: me.name, text: text.trim(), createdAt: now() };
    b.notes.push(n); save(); return clone(n);
  },
};
 
/* ================================================================ events + delivery workflow */
const eventsCrud = crud<StudioEvent, Partial<StudioEvent>, Partial<StudioEvent>, any>({
  key: 'events', prefix: 'ev', label: 'Event', sort: 'date', order: 'desc',
  search: (e) => [e.title, e.venue, e.city, e.type],
  filter: (e, f) => (!f.status || e.status === f.status) && (!f.clientId || e.clientId === f.clientId) && (f.isPublic === undefined || e.isPublic === f.isPublic)
    && (!f.photographerId || e.photographerIds.includes(f.photographerId)) && (!f.delivery || e.delivery.status === f.delivery)
    && (!f.upcoming || (e.date >= todayISO() && (e.status === 'scheduled' || e.status === 'in_progress'))),
  scope: (rows) => {
    const a = actor();
    if (!a) return rows.filter((e) => e.isPublic && e.status === 'completed');
    if (a.role === 'client') return rows.filter((e) => e.clientId === a.clientId);
    if (a.role === 'photographer') return rows.filter((e) => !!a.photographerId && e.photographerIds.includes(a.photographerId));
    return rows;
  },
  writeRoles: ['studio_admin', 'super_admin'],
  defaults: (tid) => ({ status: 'scheduled', progress: 'planned', photographerIds: [], notes: [], isPublic: false, coverUrl: '', startTime: '10:00', city: '', description: '', bookingId: null, clientId: null, delivery: noDelivery(cfgOf(tid).settings.deliveryTargetHours) }),
});
function ev(tenantId: ID, id: ID): StudioEvent {
  assertTenantAccess(tenantId);
  return getDb().events.find((e) => e.id === id && e.tenantId === tenantId) ?? notFound('Event');
}
function completeEvent(e: StudioEvent) {
  if (e.delivery.completedAt) return;
  e.status = 'completed'; e.delivery.completedAt = now(); e.delivery.status = 'pending';
  if (e.progress === 'planned' || e.progress === 'shooting') e.progress = 'wrapped';
  notify(e.tenantId, [clientUserId(e.clientId)], { type: 'booking_update', title: 'Your event has been photographed', body: `${e.title} — your highlights will be ready within ${e.delivery.targetHours} hours.`, link: '/portal/events' });
}
const events: EventService = {
  ...(eventsCrud as unknown as EventService),
  async markCompleted(tenantId, id) {
    await delay(); requireRole('studio_admin', 'super_admin', 'photographer');
    const e = ev(tenantId, id); completeEvent(e); save(); return clone(e);
  },
  async updateProgress(tenantId, id, progress) {
    await delay(); const a = requireRole('studio_admin', 'super_admin', 'photographer');
    const e = ev(tenantId, id);
    if (a.role === 'photographer' && !e.photographerIds.includes(a.photographerId ?? '')) throw new ApiError(403, 'FORBIDDEN', 'You are not assigned to this event.');
    if (progress === 'delivered') invalid('“Delivered” is set automatically when the complete gallery is published.');
    e.progress = progress;
    if (progress === 'shooting') e.status = 'in_progress';
    if (progress === 'wrapped' || progress === 'editing') completeEvent(e);
    save(); return clone(e);
  },
  async assignPhotographers(tenantId, id, photographerIds) {
    await delay(); requireRole('studio_admin', 'super_admin');
    const db = getDb(); const e = ev(tenantId, id);
    if (photographerIds.some((pid) => !db.photographers.some((p) => p.id === pid && p.tenantId === tenantId))) invalid('One or more photographers do not belong to this studio.');
    const added = photographerIds.filter((pid) => !e.photographerIds.includes(pid));
    e.photographerIds = photographerIds;
    const b = db.bookings.find((x) => x.id === e.bookingId); if (b) b.assignedPhotographerIds = [...photographerIds];
    notify(tenantId, added.map((pid) => db.photographers.find((p) => p.id === pid)?.userId), { type: 'booking_update', title: `You were assigned to ${e.title}`, body: `${e.date} · ${e.venue}`, link: '/photographer/events' });
    save(); return clone(e);
  },
  async addNote(tenantId, id, text) {
    await delay(80); const a = requireRole('studio_admin', 'super_admin', 'photographer');
    const e = ev(tenantId, id);
    if (a.role === 'photographer' && !e.photographerIds.includes(a.photographerId ?? '')) throw new ApiError(403, 'FORBIDDEN', 'You are not assigned to this event.');
    if (!text.trim()) invalid('Note cannot be empty.');
    const n = { id: uid('en'), authorName: a.name, authorRole: a.role, text: text.trim(), createdAt: now() };
    e.notes.push(n); save(); return clone(n);
  },
  async updateDelivery(tenantId, id, patch) {
    await delay(); requireRole('studio_admin', 'super_admin', 'photographer');
    const e = ev(tenantId, id);
    if (patch.targetHours !== undefined) { if (patch.targetHours < 1 || patch.targetHours > 720) invalid('Delivery target must be between 1 and 720 hours.'); e.delivery.targetHours = patch.targetHours; }
    if (patch.notes !== undefined) e.delivery.notes = patch.notes;
    save(); return clone(e);
  },
};
 
/* ================================================================ galleries */
const visiblePhotos = (g: Gallery): GalleryPhoto[] => {
  const r = role(); const sorted = [...g.photos].sort((a, b) => a.order - b.order);
  if (r === 'studio_admin' || r === 'super_admin' || r === 'photographer') return sorted;
  if (g.completePublishedAt) return sorted;
  if (g.highlightsPublishedAt) return sorted.filter((p) => p.isHighlight);
  return [];
};
const canSee = (g: Gallery) => {
  const a = actor();
  if (!a) return g.visibility === 'public';
  if (a.role === 'studio_admin' || a.role === 'super_admin') return true;
  if (a.role === 'photographer') return !!g.eventId && !!getDb().events.find((e) => e.id === g.eventId)?.photographerIds.includes(a.photographerId ?? '');
  return g.visibility === 'public' || (g.clientId === a.clientId && g.visibility !== 'private');
};
const toSummary = ({ photos: _p, ...g }: Gallery & { photos?: GalleryPhoto[] }, vis: GalleryPhoto[]): GallerySummary => {
  const hl = vis.filter((p) => p.isHighlight);
  return { ...g, photoCount: vis.length, highlightCount: hl.length, previewUrls: (hl.length ? hl : vis).slice(0, 4).map((p) => p.url) } as GallerySummary;
};
const galleryOf = (tenantId: ID, id: ID) => {
  assertTenantAccess(tenantId);
  const g = getDb().galleries.find((x) => x.id === id && x.tenantId === tenantId);
  return g && canSee(g) ? g : notFound('Gallery');
};
const staffOnly = () => requireRole('studio_admin', 'super_admin');
const full = (g: Gallery): Gallery => ({ ...toSummary(g, visiblePhotos(g)), photos: clone(visiblePhotos(g)) });
 
const galleries: GalleryService = {
  async list(tenantId, params = {}) {
    await delay();
    return scoped(tenantId, () => {
      let rows = getDb().galleries.filter((g) => g.tenantId === tenantId && canSee(g));
      rows = rows.filter((g) => (!params.eventId || g.eventId === params.eventId) && (!params.clientId || g.clientId === params.clientId) && (!params.visibility || g.visibility === params.visibility)
        && matchesSearch([g.title, g.description], params.search)
        && (!params.status || (params.status === 'highlights_pending' ? !g.highlightsPublishedAt : params.status === 'highlights_published' ? !!g.highlightsPublishedAt && !g.completePublishedAt : !!g.completePublishedAt)));
      rows = sortItems(rows, params.sort ?? 'updatedAt', params.order ?? 'desc');
      const page = paginate(rows, params);
      return { ...page, items: page.items.map((g) => toSummary(g as Gallery, visiblePhotos(g as Gallery))) };
    });
  },
  async get(tenantId, id) { await delay(60); return scoped(tenantId, () => full(galleryOf(tenantId, id))); },
  async listByEvent(tenantId, eventId) {
    await delay(60);
    return scoped(tenantId, () => getDb().galleries.filter((g) => g.tenantId === tenantId && g.eventId === eventId && canSee(g)).map((g) => toSummary(g, visiblePhotos(g))));
  },
  async create(tenantId, input) {
    await delay(); assertTenantAccess(tenantId); const a = requireRole('studio_admin', 'super_admin', 'photographer');
    if (!input.title?.trim()) invalid('Gallery title is required.');
    const db = getDb();
    const e = input.eventId ? db.events.find((x) => x.id === input.eventId && x.tenantId === tenantId) ?? invalid('Event not found in this studio.') : null;
    if (a.role === 'photographer' && !(e && e.photographerIds.includes(a.photographerId ?? ''))) throw new ApiError(403, 'FORBIDDEN', 'You can only create galleries for events you are assigned to.');
    const g: Gallery = { id: uid('gal'), tenantId, eventId: e?.id ?? null, clientId: input.clientId ?? e?.clientId ?? null, title: input.title!, description: input.description ?? '', coverUrl: input.coverUrl ?? '', visibility: input.visibility ?? 'client', externalLinks: input.externalLinks ?? [], highlightsSubmittedAt: null, highlightsPublishedAt: null, completePublishedAt: null, photoCount: 0, highlightCount: 0, previewUrls: [], photos: [], createdAt: now(), updatedAt: now() };
    db.galleries.push(g); save(); return full(g);
  },
  async update(tenantId, id, input) {
    await delay(); staffOnly(); const g = galleryOf(tenantId, id);
    Object.assign(g, input, { id, tenantId, updatedAt: now() }); save(); return full(g);
  },
  async remove(tenantId, id) {
    await delay(); staffOnly(); galleryOf(tenantId, id);
    const arr = getDb().galleries; arr.splice(arr.findIndex((g) => g.id === id), 1); save();
  },
  async addPhotos(tenantId, id, photos) {
    await delay(200); const a = requireRole('studio_admin', 'super_admin', 'photographer'); const g = galleryOf(tenantId, id);
    if (a.role === 'photographer' && g.completePublishedAt) throw new ApiError(403, 'FORBIDDEN', 'This gallery is already delivered.');
    let order = Math.max(0, ...g.photos.map((p) => p.order));
    photos.forEach((p) => {
      if (!p.url || !/^https?:\/\//.test(p.url)) invalid('Each photo needs a valid image URL.');
      g.photos.push({ id: uid('pic'), url: p.url!, title: p.title ?? 'Untitled', description: p.description ?? '', category: p.category ?? 'wedding', isHighlight: false, featured: false, order: ++order, width: p.width ?? 1200, height: p.height ?? 800, camera: p.camera, lens: p.lens, exposure: p.exposure });
    });
    if (!g.coverUrl && g.photos[0]) g.coverUrl = g.photos[0].url;
    g.updatedAt = now(); save(); return full(g);
  },
  async updatePhoto(tenantId, id, photoId, patch) {
    await delay(60); staffOnly(); const g = galleryOf(tenantId, id);
    const p = g.photos.find((x) => x.id === photoId) ?? notFound('Photo');
    Object.assign(p, patch, { id: photoId }); g.updatedAt = now(); save(); return full(g);
  },
  async removePhoto(tenantId, id, photoId) {
    await delay(60); staffOnly(); const g = galleryOf(tenantId, id);
    g.photos = g.photos.filter((p) => p.id !== photoId); g.updatedAt = now(); save(); return full(g);
  },
  async reorderPhotos(tenantId, id, photoIds) {
    await delay(60); staffOnly(); const g = galleryOf(tenantId, id);
    photoIds.forEach((pid, i) => { const p = g.photos.find((x) => x.id === pid); if (p) p.order = i + 1; });
    save(); return full(g);
  },
  async setExternalLinks(tenantId, id, links) {
    await delay(); const a = requireRole('studio_admin', 'super_admin', 'photographer'); const g = galleryOf(tenantId, id);
    if (a.role === 'photographer' && g.completePublishedAt) throw new ApiError(403, 'FORBIDDEN', 'This gallery is already delivered.');
    if (links.some((l) => !/^https:\/\//.test(l.url))) invalid('Links must start with https://');
    g.externalLinks = links.map((l) => ({ ...l, id: l.id || uid('xl') })); g.updatedAt = now(); save(); return full(g);
  },
  /** Step 2 of the workflow: photographer (or admin) submits chosen highlight photographs for review. */
  async submitHighlights(tenantId, id, photoIds, note) {
    await delay(250); requireRole('studio_admin', 'super_admin', 'photographer');
    const g = galleryOf(tenantId, id); const e = g.eventId ? ev(tenantId, g.eventId) : null;
    if (!e) conflict('This gallery is not linked to an event.');
    if (!e!.delivery.completedAt) conflict('Mark the event completed before submitting highlights.');
    if (g.highlightsPublishedAt) conflict('Highlights are already published. Publish the complete gallery next.');
    if (photoIds.length === 0) invalid('Select at least one highlight photograph.');
    if (photoIds.some((pid) => !g.photos.some((p) => p.id === pid))) invalid('Some selected photos do not belong to this gallery.');
    g.photos.forEach((p) => { p.isHighlight = photoIds.includes(p.id); });
    g.highlightsSubmittedAt = now(); g.updatedAt = now();
    e!.delivery.highlightsSubmittedAt = g.highlightsSubmittedAt; e!.delivery.status = 'highlights_submitted';
    if (note !== undefined) e!.delivery.notes = note;
    if (e!.progress !== 'editing') e!.progress = 'editing';
    notify(tenantId, adminIds(tenantId), { type: 'system', title: 'Highlights ready for review', body: `${e!.title}: ${photoIds.length} highlight photographs submitted.`, link: '/admin/delivery' });
    save(); return full(g);
  },
  /** Step 3–5: admin reviews and publishes highlights; the client is notified in-app. */
  async publishHighlights(tenantId, id) {
    await delay(250); staffOnly();
    const g = galleryOf(tenantId, id); const e = g.eventId ? ev(tenantId, g.eventId) : null;
    if (!e) conflict('This gallery is not linked to an event.');
    if (!g.highlightsSubmittedAt) conflict('Highlights must be submitted by the photographer first.');
    if (!g.photos.some((p) => p.isHighlight)) invalid('Mark at least one photograph as a highlight.');
    g.highlightsPublishedAt = now(); if (g.visibility === 'private') g.visibility = 'client'; g.updatedAt = now();
    e!.delivery.highlightsPublishedAt = g.highlightsPublishedAt; e!.delivery.status = 'highlights_published';
    const n = g.photos.filter((p) => p.isHighlight).length;
    notify(tenantId, [clientUserId(g.clientId ?? e!.clientId)], { type: 'highlights_published', title: 'Your highlights are ready', body: `${n} highlight photographs from “${e!.title}” are now available.`, link: '/portal/photos' });
    save(); return full(g);
  },
  async publishComplete(tenantId, id) {
    await delay(250); staffOnly();
    const g = galleryOf(tenantId, id); const e = g.eventId ? ev(tenantId, g.eventId) : null;
    if (!e) conflict('This gallery is not linked to an event.');
    if (g.photos.length === 0) invalid('Add photographs before publishing the complete gallery.');
    g.completePublishedAt = now(); if (g.visibility === 'private') g.visibility = 'client'; g.updatedAt = now();
    e!.delivery.galleryPublishedAt = g.completePublishedAt; e!.delivery.status = 'delivered'; e!.progress = 'delivered';
    notify(tenantId, [clientUserId(g.clientId ?? e!.clientId)], { type: 'gallery_published', title: 'Your complete gallery is live', body: `All ${g.photos.length} photographs from “${e!.title}” are available to view and download.`, link: '/portal/photos' });
    save(); return full(g);
  },
  async portfolio(tenantId, params = {}) {
    await delay();
    const items: PortfolioPhoto[] = getDb().galleries.filter((g) => g.tenantId === tenantId && g.visibility === 'public')
      .flatMap((g) => {
        const vis = g.completePublishedAt ? g.photos : g.highlightsPublishedAt ? g.photos.filter((p) => p.isHighlight) : [];
        return vis.map((p) => ({ ...p, galleryId: g.id, galleryTitle: g.title }));
      })
      .filter((p) => (!params.category || p.category === params.category) && (params.featured === undefined || !!p.featured === params.featured) && matchesSearch([p.title, p.galleryTitle], params.search))
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured));
    return paginate(items, params);
  },
  async sampleLibrary() {
    await delay(60);
    const seen = new Set<string>();
    return getDb().galleries.flatMap((g) => g.photos).filter((p) => !seen.has(p.url) && seen.add(p.url))
      .map(({ url, title, category, width, height }) => ({ url, title, category, width, height }));
  },
};
 
/* ================================================================ notifications */
const notifications: NotificationService = {
  async list(tenantId, userId, params = {}) {
    await delay(60); assertTenantAccess(tenantId);
    const a = actor(); if (a && a.id !== userId && a.role !== 'super_admin') throw new ApiError(403, 'FORBIDDEN', 'You can only read your own notifications.');
    const rows = getDb().notifications.filter((n) => n.tenantId === tenantId && n.userId === userId && (!params.unread || !n.read)).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    return paginate(rows, params);
  },
  async markRead(tenantId, id) {
    await delay(40); assertTenantAccess(tenantId); const a = requireRole('studio_admin', 'super_admin', 'photographer', 'client');
    const n = getDb().notifications.find((x) => x.id === id && x.tenantId === tenantId) ?? notFound('Notification');
    if (n.userId !== a.id) throw new ApiError(403, 'FORBIDDEN', 'Not your notification.');
    n.read = true; save(); return clone(n);
  },
  async markAllRead(tenantId, userId) {
    await delay(60); assertTenantAccess(tenantId); const a = requireRole('studio_admin', 'super_admin', 'photographer', 'client');
    if (a.id !== userId && a.role !== 'super_admin') throw new ApiError(403, 'FORBIDDEN', 'You can only update your own notifications.');
    getDb().notifications.forEach((n) => { if (n.tenantId === tenantId && n.userId === userId) n.read = true; }); save();
  },
};
 
/* ================================================================ analytics & platform */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function lastMonths(n: number) {
  const d = new Date(); d.setDate(1);
  return Array.from({ length: n }, (_, i) => { const x = new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1); return { key: `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`, label: MONTHS[x.getMonth()] }; });
}
const analytics: AnalyticsService = {
  async studioDashboard(tenantId): Promise<StudioDashboard> {
    await delay(150); assertTenantAccess(tenantId); staffOnly();
    const db = getDb(); const today = todayISO();
    const bk = db.bookings.filter((b) => b.tenantId === tenantId); const evs = db.events.filter((e) => e.tenantId === tenantId);
    const live = bk.filter((b) => b.status !== 'cancelled' && b.status !== 'rejected');
    const completed = evs.filter((e) => e.status === 'completed');
    const phs = db.photographers.filter((p) => p.tenantId === tenantId);
    return {
      totals: {
        bookings: bk.length, pendingEnquiries: bk.filter((b) => b.status === 'enquiry' || b.status === 'pending').length,
        upcomingEvents: evs.filter((e) => e.date >= today && (e.status === 'scheduled' || e.status === 'in_progress')).length, completedEvents: completed.length,
        clients: db.clients.filter((c) => c.tenantId === tenantId).length, photographers: phs.filter((p) => p.status !== 'inactive').length,
        revenue: bk.reduce((s, b) => s + b.paidAmount, 0), outstanding: live.filter((b) => b.status === 'confirmed' || b.status === 'completed').reduce((s, b) => s + Math.max(0, b.amount - b.paidAmount), 0),
        pendingDeliveries: completed.filter((e) => e.delivery.status !== 'delivered').length,
      },
      revenueByMonth: lastMonths(7).map((m) => { const rows = bk.filter((b) => b.createdAt.startsWith(m.key)); return { month: m.label, revenue: rows.reduce((s, b) => s + b.paidAmount, 0), bookings: rows.length }; }),
      bookingsByStatus: (['enquiry', 'pending', 'confirmed', 'completed', 'cancelled', 'rejected'] as BookingStatus[]).map((status) => ({ status, count: bk.filter((b) => b.status === status).length })),
      bookingsByService: db.services.filter((s) => s.tenantId === tenantId).map((s) => { const rows = live.filter((b) => b.serviceId === s.id); return { name: s.name, count: rows.length, revenue: rows.reduce((t, b) => t + b.paidAmount, 0) }; }).filter((r) => r.count).sort((a, b) => b.count - a.count),
      deliveryFunnel: [
        { label: 'Events completed', count: completed.length },
        { label: 'Highlights submitted', count: completed.filter((e) => e.delivery.highlightsSubmittedAt).length },
        { label: 'Highlights published', count: completed.filter((e) => e.delivery.highlightsPublishedAt).length },
        { label: 'Fully delivered', count: completed.filter((e) => e.delivery.status === 'delivered').length },
      ],
      photographerLoad: phs.map((p) => ({ photographerId: p.id, name: p.name, upcoming: evs.filter((e) => e.photographerIds.includes(p.id) && e.date >= today && e.status !== 'completed' && e.status !== 'cancelled').length, completed: evs.filter((e) => e.photographerIds.includes(p.id) && e.status === 'completed').length })),
    };
  },
};
 
const platform: PlatformService = {
  async stats(): Promise<PlatformStats> {
    await delay(150); requireRole('super_admin');
    const db = getDb();
    return {
      totalTenants: db.tenants.length, activeTenants: db.tenants.filter((t) => t.status === 'active').length, inactiveTenants: db.tenants.filter((t) => t.status === 'inactive').length, trialTenants: db.tenants.filter((t) => t.status === 'trial').length,
      totalCustomers: db.clients.length, totalBookings: db.bookings.length, totalPhotographers: db.photographers.length,
      monthlyRecurringRevenue: db.tenants.filter((t) => t.subscriptionStatus === 'active').reduce((s, t) => s + (db.plans.find((p) => p.id === t.planId)?.priceMonthly ?? 0), 0),
      tenantsByPlan: db.plans.map((p) => ({ planId: p.id, planName: p.name, count: db.tenants.filter((t) => t.planId === p.id).length })),
      bookingsByTenant: db.tenants.map((t) => ({ tenantId: t.id, tenantName: t.name, bookings: db.bookings.filter((b) => b.tenantId === t.id).length, customers: db.clients.filter((c) => c.tenantId === t.id).length })),
      signups: lastMonths(6).map((m) => ({ month: m.label, tenants: db.tenants.filter((t) => t.createdAt.startsWith(m.key)).length })),
    };
  },
  plans: {
    async list() { await delay(60); return clone(getDb().plans); },
    async create(i) { await delay(); requireRole('super_admin'); const p = { id: uid('plan'), name: 'New plan', priceMonthly: 0, currency: 'INR' as const, maxPhotographers: 1, maxStorageGb: 5, maxBookingsPerMonth: 10, features: [], status: 'active' as const, ...i }; getDb().plans.push(p); save(); return clone(p); },
    async update(id, i) { await delay(); requireRole('super_admin'); const p = getDb().plans.find((x) => x.id === id) ?? notFound('Plan'); Object.assign(p, i, { id }); save(); return clone(p); },
    async remove(id) {
      await delay(); requireRole('super_admin'); const db = getDb();
      if (db.tenants.some((t) => t.planId === id)) conflict('This plan is assigned to studios. Archive it instead.');
      db.plans = db.plans.filter((p) => p.id !== id); save();
    },
  },
  async getSettings() { await delay(60); return clone(getDb().settings); },
  async updateSettings(patch) { await delay(); requireRole('super_admin'); Object.assign(getDb().settings, patch); save(); return clone(getDb().settings); },
};
 
export const mockProvider: DataProvider = {
  mode: 'mock', tenants, auth, photographers: photographers as any, clients, services: services as any, packages: packages as any,
  bookings, events, galleries, videos: videos as any, drive: drive as any, testimonials: testimonials as any, blog, notifications, analytics, platform,
};
export { resetDb };
export type { User };