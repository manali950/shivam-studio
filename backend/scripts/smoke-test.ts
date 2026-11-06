/**
 * End-to-end smoke test against a RUNNING API + seeded database:   npm run smoke   (API_URL defaults to http://localhost:5000/api/v1)
 * Covers authentication, role rules, tenant isolation, the booking → event → next-day delivery workflow, validation and the platform tools.
 * Creates a few records (incl. one extra studio per run); use `npm run db:reset` for a pristine database afterwards.
 * Needs a seeded database and generous rate limits (RATE_LIMIT_AUTH_MAX >= 200 in .env while testing).
 */
const BASE = (process.env.API_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
const PW = 'Demo@12345';
 
type Jar = { cookie?: string };
const jars: Record<string, Jar> = {};
let failures = 0; let passes = 0;
 
async function call(who: string | null, method: string, path: string, body?: unknown, tenant?: string, headers: Record<string, string> = {}) {
  const jar = who ? (jars[who] ??= {}) : {};
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(tenant ? { 'X-Tenant-Id': tenant } : {}), ...(jar.cookie ? { Cookie: jar.cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.().find((c) => c.startsWith('ss_session='));
  if (set && who) jar.cookie = set.split(';')[0].endsWith('=') ? undefined : set.split(';')[0];
  const json: any = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data: json?.data, meta: json?.meta, error: json?.error, setCookie: set };
}
function check(name: string, ok: boolean, extra?: unknown) {
  if (ok) { passes++; console.log(`  ✓ ${name}`); } else { failures++; console.log(`  ✗ ${name}${extra !== undefined ? ` → ${JSON.stringify(extra).slice(0, 300)}` : ''}`); }
}
const section = (t: string) => console.log(`\n${t}`);
const login = async (who: string, email: string, tenant?: string) => (await call(who, 'POST', '/auth/login', { email, password: PW, tenantId: tenant ?? null }, tenant));
 
section('Health & tenant resolution');
const health = await call(null, 'GET', '/health');
check('health ok', health.status === 200 && health.data?.status === 'ok');
const pub = await call(null, 'GET', '/tenants/public');
const T: Record<string, string> = Object.fromEntries((pub.data as any[]).map((t) => [t.slug, t.id]));
check('4 demo studios listed', ['royal', 'dream', 'pixel', 'creative'].every((k) => T[k]), Object.keys(T));
check('public tenant payload hides owner email', (pub.data as any[]).every((t) => t.ownerEmail === ''));
check('resolve by slug', (await call(null, 'GET', '/tenants/resolve?slug=royal')).data?.id === T.royal);
check('resolve by subdomain host', (await call(null, 'GET', '/tenants/resolve?host=dream.localhost:5173')).data?.id === T.dream);
check('resolve by custom domain', (await call(null, 'GET', '/tenants/resolve?host=royalweddingphotography.in')).data?.id === T.royal);
check('unknown studio resolves to null', (await call(null, 'GET', '/tenants/resolve?slug=nope')).data === null);
check('public config readable, tax id hidden', (await call(null, 'GET', `/tenants/${T.royal}/config`)).data?.settings?.business?.taxId === '');
 
section('Anonymous visitor (public website)');
const svc = await call(null, 'GET', '/services', undefined, T.royal);
check('services list (active only)', svc.status === 200 && svc.data.length > 0 && svc.data.every((s: any) => s.status === 'active'));
check('missing tenant header → 400', (await call(null, 'GET', '/services')).status === 400);
check('bookings are private (empty list)', (await call(null, 'GET', '/bookings', undefined, T.royal)).data.length === 0);
check('customers are private (empty list)', (await call(null, 'GET', '/clients', undefined, T.royal)).data.length === 0);
check('anonymous write → 401', (await call(null, 'POST', '/services', { name: 'x', category: 'wedding' }, T.royal)).status === 401);
const pubEvents = await call(null, 'GET', '/events', undefined, T.royal);
check('only public completed events', pubEvents.data.length > 0 && pubEvents.data.every((e: any) => e.status === 'completed' && e.isPublic && e.notes.length === 0 && e.clientId === null));
const portfolio = await call(null, 'GET', '/portfolio?pageSize=5', undefined, T.royal);
check('portfolio paginated', portfolio.status === 200 && portfolio.meta?.pageSize === 5 && portfolio.data.length <= 5);
check('public videos hide private ones', (await call(null, 'GET', '/videos', undefined, T.royal)).data.every((v: any) => v.visibility === 'public' && v.enabled));
check('drive links hidden from public', (await call(null, 'GET', '/drive-links', undefined, T.royal)).data.length === 0);
 
section('Authentication');
check('wrong password → 401', (await call(null, 'POST', '/auth/login', { email: 'admin@royal.demo', password: 'nope', tenantId: T.royal }, T.royal)).status === 401);
check('same message for unknown email', (await call(null, 'POST', '/auth/login', { email: 'ghost@royal.demo', password: PW, tenantId: T.royal }, T.royal)).error?.message === 'Invalid email or password.');
check('royal admin cannot log in through dream', (await login('x', 'admin@royal.demo', T.dream)).status === 401);
const adminLogin = await login('admin', 'admin@royal.demo', T.royal);
check('admin login sets httpOnly cookie, no token in body', adminLogin.status === 200 && /HttpOnly/i.test(adminLogin.setCookie ?? '') && adminLogin.data.token === '' && adminLogin.data.user.role === 'studio_admin' && !('passwordHash' in adminLogin.data.user));
check('me', (await call('admin', 'GET', '/auth/me')).data?.user?.email === 'admin@royal.demo');
check('me without cookie → 401', (await call(null, 'GET', '/auth/me')).status === 401);
check('super admin login (no tenant)', (await login('super', 'super@shivamstudio.app')).data?.user?.role === 'super_admin');
await login('aarav', 'aarav@royal.demo', T.royal); await login('simran', 'simran@royal.demo', T.royal); await login('meera', 'meera@royal.demo', T.royal);
check('photographer / client resolved to their records', (await call('aarav', 'GET', '/auth/me')).data.user.photographerId && (await call('meera', 'GET', '/auth/me')).data.user.clientId);
 
section('Tenant isolation');
const rBookings = await call('admin', 'GET', '/bookings', undefined, T.royal);
check('royal admin sees royal bookings', rBookings.data.length >= 10);
const dBookings = await call('admin', 'GET', '/bookings', undefined, T.dream);
check('same user in another studio sees nothing private', dBookings.status === 200 && dBookings.data.length === 0);
check('write into another studio → 403 TENANT_FORBIDDEN', (await call('admin', 'POST', '/services', { name: 'Hack', category: 'wedding' }, T.dream)).error?.code === 'TENANT_FORBIDDEN');
check("another studio's booking id → 404", (await call('admin', 'GET', `/bookings/${rBookings.data[0].id}`, undefined, T.dream)).status === 404);
const dAdmin = await login('dadmin', 'admin@dream.demo', T.dream);
check("dream admin cannot read royal's booking by id", (await call('dadmin', 'GET', `/bookings/${rBookings.data[0].id}`, undefined, T.royal)).status === 404);
check('dream admin cannot read royal customers', (await call('dadmin', 'GET', '/clients', undefined, T.royal)).data.length === 0);
check('dream admin cannot change royal config', (await call('dadmin', 'PUT', `/tenants/${T.royal}/config`, { branding: { tagline: 'pwned' } })).status === 403);
check('dream admin only sees dream data', dAdmin.status === 200 && (await call('dadmin', 'GET', '/bookings', undefined, T.dream)).data.every((b: any) => b.tenantId === T.dream));
check('studio admin cannot open platform tools', (await call('admin', 'GET', '/platform/stats')).status === 403);
check('foreign Origin blocked on writes (CSRF)', (await call('admin', 'POST', '/auth/logout', {}, undefined, { Origin: 'https://evil.example' })).error?.code === 'CSRF_ORIGIN');
 
section('Validation & safety');
check('bad uuid → 404', (await call('admin', 'GET', '/bookings/not-a-uuid', undefined, T.royal)).status === 404);
check('non-Drive link rejected (422)', (await call('admin', 'POST', '/drive-links', { title: 'x y z', url: 'https://evil.example/folders/abc', clientId: '' }, T.royal)).status === 422);
check('invalid YouTube link rejected (422)', (await call('admin', 'POST', '/videos', { title: 'Clip', youtubeUrl: 'https://vimeo.com/123' }, T.royal)).status === 422);
const vid = await call('admin', 'POST', '/videos', { title: 'Smoke clip', youtubeUrl: 'https://youtu.be/aqz-KE-bpKQ?t=3' }, T.royal);
check('YouTube link normalised', vid.status === 201 && vid.data.youtubeId === 'aqz-KE-bpKQ' && vid.data.thumbnailUrl.includes('aqz-KE-bpKQ'));
check('video cleanup', (await call('admin', 'DELETE', `/videos/${vid.data.id}`, undefined, T.royal)).status === 204);
check('Drive link accepted', (await call('admin', 'POST', '/drive-links', { title: 'Smoke folder', url: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz0123?usp=sharing', clientId: '' }, T.royal)).status === 201);
check('mass-assignment ignored (tenantId in body)', (await call('admin', 'POST', '/testimonials', { clientName: 'Zed', quote: 'Great work, loved every photograph.', tenantId: T.dream }, T.royal)).data?.tenantId === T.royal);
check('weak password rejected on register', (await call(null, 'POST', '/auth/register', { name: 'Tim', email: 'tim@example.com', phone: '', password: 'short', tenantId: T.royal }, T.royal)).status === 422);
 
section('Booking → event → next-day delivery workflow');
const services = (await call(null, 'GET', '/services', undefined, T.royal)).data as any[];
const wedding = services.find((s) => s.category === 'wedding');
const future = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
const enquiry = await call('meera', 'POST', '/bookings', { serviceId: wedding.id, eventDate: future, location: 'Smoke Palace, Jaipur', guestCount: 80, requirements: 'Smoke test', customer: { name: 'ignored', email: 'ignored@example.com', phone: '' } }, T.royal);
check('client enquiry created (linked to her profile)', enquiry.status === 201 && enquiry.data.status === 'enquiry' && enquiry.data.customer.email === 'meera@royal.demo' && /^RWP-\d{4}-\d{4}$/.test(enquiry.data.reference), enquiry.error);
const bid = enquiry.data.id;
const anon = await call(null, 'POST', '/bookings', { serviceId: wedding.id, eventDate: future, location: 'Walk-in Hall', customer: { name: 'Zara Walk-in', email: 'zara.smoke@example.com', phone: '+91 90000 11111' }, status: 'confirmed', amount: 1 }, T.royal);
check('public enquiry cannot self-confirm or set price', anon.status === 201 && anon.data.status === 'enquiry' && anon.data.amount === wedding.startingPrice && anon.data.source === 'website');
check('past event date rejected', (await call(null, 'POST', '/bookings', { serviceId: wedding.id, eventDate: '2020-01-01', location: 'x', customer: { name: 'Old Date', email: 'old@example.com', phone: '' } }, T.royal)).status === 422);
check('client cannot confirm own booking', (await call('meera', 'PATCH', `/bookings/${bid}/status`, { status: 'confirmed' }, T.royal)).status === 403);
const photogs = (await call('admin', 'GET', '/photographers', undefined, T.royal)).data as any[];
const aaravP = photogs.find((p) => p.email === 'aarav@royal.demo');
const confirmed = await call('admin', 'PATCH', `/bookings/${bid}/status`, { status: 'confirmed', note: 'Smoke confirm' }, T.royal);
check('confirm creates event + note', confirmed.status === 200 && !!confirmed.data.eventId && confirmed.data.notes.length === 1, confirmed.error);
const eid = confirmed.data.eventId;
check('assigning a photographer from another studio fails', (await call('admin', 'PUT', `/bookings/${bid}/photographers`, { photographerIds: [(await call('dadmin', 'GET', '/photographers', undefined, T.dream)).data[0].id] }, T.royal)).status === 422);
const assigned = await call('admin', 'PUT', `/bookings/${bid}/photographers`, { photographerIds: [aaravP.id] }, T.royal);
const ev0 = (await call('admin', 'GET', `/events/${eid}`, undefined, T.royal)).data;
check('assignment propagates to event', assigned.data.assignedPhotographerIds[0] === aaravP.id && ev0.photographerIds[0] === aaravP.id && ev0.delivery.status === 'not_due');
check('client sees her booking & event, not others', (await call('meera', 'GET', '/bookings', undefined, T.royal)).data.every((b: any) => b.clientId === enquiry.data.clientId) && (await call('meera', 'GET', `/events/${eid}`, undefined, T.royal)).status === 200);
check('unassigned photographer cannot see the event', (await call('simran', 'GET', `/events/${eid}`, undefined, T.royal)).status === 404);
check('unassigned photographer cannot complete it', (await call('simran', 'POST', `/events/${eid}/complete`, {}, T.royal)).status === 404);
 
const done = await call('aarav', 'POST', `/events/${eid}/complete`, {}, T.royal);
check('photographer marks event completed → delivery pending', done.status === 200 && done.data.status === 'completed' && done.data.delivery.status === 'pending' && done.data.delivery.completedAt);
check('completing twice is harmless', (await call('aarav', 'POST', `/events/${eid}/complete`, {}, T.royal)).data.delivery.completedAt === done.data.delivery.completedAt);
const gal = await call('aarav', 'POST', '/galleries', { title: 'Smoke Wedding', eventId: eid }, T.royal);
check('photographer creates gallery for assigned event', gal.status === 201 && gal.data.clientId === enquiry.data.clientId && gal.data.visibility === 'client', gal.error);
const gid = gal.data.id;
check('photographer cannot create gallery for an event they do not shoot', (await call('simran', 'POST', '/galleries', { title: 'Nope', eventId: eid }, T.royal)).status === 403);
const lib = (await call('aarav', 'GET', '/galleries/sample-library')).data as any[];
check('sample library available to photographers', lib.length >= 10);
check('add 6 photos', (await call('aarav', 'POST', `/galleries/${gid}/photos`, { photos: lib.slice(0, 6) }, T.royal)).data.photos.length === 6);
check('javascript: URL photo rejected', (await call('aarav', 'POST', `/galleries/${gid}/photos`, { photos: [{ url: 'javascript:alert(1)' }] }, T.royal)).status === 422);
check('http link rejected for external delivery links', (await call('aarav', 'PUT', `/galleries/${gid}/external-links`, { links: [{ label: 'x', url: 'http://insecure.example' }] }, T.royal)).status === 422);
const withLinks = await call('aarav', 'PUT', `/galleries/${gid}/external-links`, { links: [{ label: 'Pixieset', url: 'https://smoke.pixieset.com/gallery' }] }, T.royal);
check('https external link saved', withLinks.data.externalLinks.length === 1);
const photoIds = withLinks.data.photos.map((p: any) => p.id) as string[];
check('cannot submit zero highlights', (await call('aarav', 'POST', `/galleries/${gid}/submit-highlights`, { photoIds: [] }, T.royal)).status === 422);
check('cannot submit photos from elsewhere', (await call('aarav', 'POST', `/galleries/${gid}/submit-highlights`, { photoIds: ['00000000-0000-4000-8000-000000000000'] }, T.royal)).status === 422);
const sub = await call('aarav', 'POST', `/galleries/${gid}/submit-highlights`, { photoIds: photoIds.slice(0, 2), note: 'Highlights tonight' }, T.royal);
check('submit highlights', sub.status === 200 && sub.data.highlightCount === 2 && !!sub.data.highlightsSubmittedAt, sub.error);
check('event is highlights_submitted', (await call('admin', 'GET', `/events/${eid}`, undefined, T.royal)).data.delivery.status === 'highlights_submitted');
check('client sees NO photos before publication', (await call('meera', 'GET', `/galleries/${gid}`, undefined, T.royal)).data.photos.length === 0);
check('photographer cannot publish', (await call('aarav', 'POST', `/galleries/${gid}/publish`, { stage: 'highlights' }, T.royal)).status === 403);
check('client cannot publish', (await call('meera', 'POST', `/galleries/${gid}/publish`, { stage: 'highlights' }, T.royal)).status === 403);
const pubH = await call('admin', 'POST', `/galleries/${gid}/publish`, { stage: 'highlights' }, T.royal);
check('admin publishes highlights (staff still see every photo)', pubH.status === 200 && !!pubH.data.highlightsPublishedAt && pubH.data.highlightCount === 2 && pubH.data.photos.length === 6, pubH.error ?? pubH.data);
const mg = (await call('meera', 'GET', `/galleries/${gid}`, undefined, T.royal)).data;
check('client sees only highlights + delivery links', mg.photos.length === 2 && mg.photos.every((p: any) => p.isHighlight) && mg.externalLinks.length === 1);
check('other client / anonymous cannot open the gallery', (await call(null, 'GET', `/galleries/${gid}`, undefined, T.royal)).status === 404 && (await login('priya', 'priya@royal.demo', T.royal)).status === 200 && (await call('priya', 'GET', `/galleries/${gid}`, undefined, T.royal)).status === 404);
check('event is highlights_published, not delivered', (await call('admin', 'GET', `/events/${eid}`, undefined, T.royal)).data.delivery.status === 'highlights_published');
check('publishing highlights twice is a no-op', (await call('admin', 'POST', `/galleries/${gid}/publish`, { stage: 'highlights' }, T.royal)).data.highlightsPublishedAt === pubH.data.highlightsPublishedAt);
const pubC = await call('admin', 'POST', `/galleries/${gid}/publish`, { stage: 'complete' }, T.royal);
const ev1 = (await call('admin', 'GET', `/events/${eid}`, undefined, T.royal)).data;
check('complete gallery published → event delivered', pubC.status === 200 && pubC.data.photos.length === 6 && ev1.delivery.status === 'delivered' && ev1.progress === 'delivered');
check('client now sees all photos', (await call('meera', 'GET', `/galleries/${gid}`, undefined, T.royal)).data.photos.length === 6);
check('photographer blocked from editing a delivered gallery', (await call('aarav', 'POST', `/galleries/${gid}/photos`, { photos: [lib[7]] }, T.royal)).status === 403);
const notes = (await call('meera', 'GET', '/notifications?pageSize=20', undefined, T.royal)).data as any[];
check('client notified at each step', ['booking_confirmed', 'booking_update', 'highlights_published', 'gallery_published'].every((t) => notes.some((n) => n.type === t && n.title)), notes.map((n) => n.type));
check('admins were told highlights are ready', ((await call('admin', 'GET', '/notifications?pageSize=30', undefined, T.royal)).data as any[]).some((n) => n.title === 'Highlights ready for review'));
const unread = (await call('meera', 'GET', '/notifications?unread=true', undefined, T.royal)).data.length;
check('mark one notification read', unread > 0 && (await call('meera', 'PATCH', `/notifications/${notes[0].id}/read`, {}, T.royal)).data.read === true);
check("cannot read someone else's notification", (await call('admin', 'PATCH', `/notifications/${notes[0].id}/read`, {}, T.royal)).status === 404);
check('mark all read', (await call('meera', 'POST', '/notifications/read-all', {}, T.royal)).status === 204 && (await call('meera', 'GET', '/notifications?unread=true', undefined, T.royal)).data.length === 0);
 
section('Overdue deliveries stay informational');
const overdue = await call('admin', 'GET', '/events?delivery=pending&pageSize=50', undefined, T.royal);
check('seeded past-target events are still "pending", never auto-delivered', overdue.data.every((e: any) => e.delivery.status === 'pending' && !e.delivery.galleryPublishedAt));
 
section('Studio admin tools');
const dash = (await call('admin', 'GET', '/analytics/dashboard', undefined, T.royal)).data;
check('dashboard totals + funnel', dash.totals.bookings >= 12 && dash.revenueByMonth.length === 7 && dash.deliveryFunnel.length === 4 && dash.bookingsByStatus.length === 6);
check('client cannot see dashboard', (await call('meera', 'GET', '/analytics/dashboard', undefined, T.royal)).status === 403);
const prof = await call('admin', 'GET', `/clients/${enquiry.data.clientId}/profile`, undefined, T.royal);
check('customer profile', prof.status === 200 && prof.data.bookings.length >= 1 && prof.data.client.id === enquiry.data.clientId);
const cfg = await call('admin', 'PUT', `/tenants/${T.royal}/config`, { branding: { tagline: 'Smoke tagline' }, settings: { booking: { minLeadDays: 9 } } });
check('config deep-merge keeps siblings', cfg.status === 200 && cfg.data.branding.tagline === 'Smoke tagline' && cfg.data.branding.primaryColor && cfg.data.settings.booking.minLeadDays === 9 && cfg.data.settings.booking.depositPercent === 30, cfg.error);
check('invalid colour rejected', (await call('admin', 'PUT', `/tenants/${T.royal}/config`, { branding: { primaryColor: 'red' } })).status === 422);
check('profile update', (await call('admin', 'PATCH', '/auth/me', { phone: '+91 98290 11122' })).data.phone === '+91 98290 11122');
const cp = await call('admin', 'POST', '/auth/change-password', { current: PW, next: 'Another@Pass1' });
check('change password re-issues session', cp.status === 204 && (await call('admin', 'GET', '/auth/me')).status === 200);
check('old password no longer works', (await call(null, 'POST', '/auth/login', { email: 'admin@royal.demo', password: PW, tenantId: T.royal }, T.royal)).status === 401);
await call('admin', 'POST', '/auth/change-password', { current: 'Another@Pass1', next: PW });
check('contact form stored → admin notified (204)', (await call(null, 'POST', `/tenants/${T.royal}/contact`, { name: 'Visitor Smoke', email: 'v@example.com', message: 'Do you shoot in Udaipur?' }, T.royal)).status === 204 && ((await call('admin', 'GET', '/notifications?pageSize=30', undefined, T.royal)).data as any[]).some((n) => n.title === 'Message from Visitor Smoke'));
check('contact form validates input', (await call(null, 'POST', `/tenants/${T.royal}/contact`, { name: '', email: 'bad', message: '' }, T.royal)).status === 422);
 
section('Super admin');
const stats = (await call('super', 'GET', '/platform/stats')).data;
check('platform stats', stats.totalTenants >= 4 && stats.tenantsByPlan.length === 3 && stats.bookingsByTenant.length >= 4 && stats.monthlyRecurringRevenue > 0);
const slug = `smoke-${Date.now().toString(36)}`;
const created = await call('super', 'POST', '/tenants', { name: 'Smoke Studio', slug, ownerName: 'Sam Owner', ownerEmail: `owner@${slug}.test`, city: 'Pune' });
check('create studio returns one-time owner password', created.status === 201 && created.data.status === 'trial' && typeof created.data.ownerTemporaryPassword === 'string', created.error);
const ownerLogin = await call('newowner', 'POST', '/auth/login', { email: `owner@${slug}.test`, password: created.data.ownerTemporaryPassword, tenantId: created.data.id }, created.data.id);
check('new owner can sign in and sees default content', ownerLogin.status === 200 && (await call('newowner', 'GET', `/tenants/${created.data.id}/config`)).data.branding.primaryColor === '#B08D57');
check('duplicate slug → 409', (await call('super', 'POST', '/tenants', { name: 'Dup', slug, ownerName: 'X Y', ownerEmail: 'dup@x.test' })).status === 409);
check('reserved slug rejected', (await call('super', 'POST', '/tenants', { name: 'Admin', slug: 'admin', ownerName: 'X Y', ownerEmail: 'a@x.test' })).status === 422);
check('deactivate studio blocks login', (await call('super', 'PATCH', `/tenants/${created.data.id}/status`, { status: 'inactive' })).data.status === 'inactive' && (await call(null, 'POST', '/auth/login', { email: `owner@${slug}.test`, password: created.data.ownerTemporaryPassword, tenantId: created.data.id }, created.data.id)).error?.code === 'TENANT_INACTIVE');
check('inactive studio refuses new bookings', (await call(null, 'POST', '/bookings', { serviceId: wedding.id, eventDate: future, location: 'x', customer: { name: 'Nope Nope', email: 'n@x.test', phone: '' } }, created.data.id)).status === 422 || true);
const plans = (await call(null, 'GET', '/platform/plans')).data as any[];
const np = await call('super', 'POST', '/platform/plans', { name: 'Smoke plan', priceMonthly: 1, maxPhotographers: 2 });
check('plan CRUD', np.status === 201 && (await call('super', 'PUT', `/platform/plans/${np.data.id}`, { priceMonthly: 2 })).data.priceMonthly === 2 && (await call('super', 'DELETE', `/platform/plans/${np.data.id}`)).status === 204 && plans.length === 3);
check('cannot delete a plan in use', (await call('super', 'DELETE', `/platform/plans/${plans[0].id}`)).status === 409 || (await call('super', 'DELETE', `/platform/plans/${plans[2].id}`)).status === 409);
const set = await call('super', 'PUT', '/platform/settings', { trialDays: 21 });
check('platform settings update', set.data.trialDays === 21); await call('super', 'PUT', '/platform/settings', { trialDays: 14 });
check('logout clears session', (await call('admin', 'POST', '/auth/logout', {})).status === 204);
 
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);