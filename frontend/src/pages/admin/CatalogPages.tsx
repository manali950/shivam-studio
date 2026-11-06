/** Studio catalogue modules built on the config-driven CrudPage: photographers, services, packages, testimonials, YouTube, Drive, blog. */
import { z } from 'zod';
import { Eye, EyeOff, Star } from 'lucide-react';
import { services } from '@/services/data-provider';
import { useClientList, useEventList, useServiceList } from '@/hooks/admin';
import { useTenant } from '@/context/TenantContext';
import { DRIVE_NOTICE, parseDrive, parseYouTube } from '@/lib/media';
import { cn, formatDate, slugify, titleCase } from '@/lib/utils';
import type { BlogPost, DriveLink, Package, Photographer, Service, Testimonial, Video } from '@/types';
import { CrudPage, type FieldDef } from '@/components/shared/CrudPage';
import { DriveButton } from '@/components/shared/Bits';
import { YouTubeEmbed } from '@/components/shared/YouTubeEmbed';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { Avatar, SmartImage } from '@/components/ui/SmartImage';
import { CATEGORY_OPTIONS } from './adminUi';
import { Pencil, Trash2 } from 'lucide-react';
 
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const optUrl = z.string().trim().refine((v) => v === '' || /^https?:\/\//.test(v), 'Enter a valid image URL').optional();
const num = (min: number, max: number, msg: string) => z.number({ invalid_type_error: msg }).min(min, msg).max(max, msg);
const ACTIVE = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];
 
/* ---------------------------------------------------------------- Photographers */
const phSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name'), title: z.string().trim().min(2, 'Enter a job title'), email: z.string().trim().email('Enter a valid email'), phone: z.string().trim().min(7, 'Enter a phone number'),
  experienceYears: num(0, 60, '0–60 years'), rating: num(1, 5, 'Rating is 1–5'), bio: z.string().trim().min(10, 'Add a short bio'), specialties: z.array(z.string()).min(1, 'Pick at least one specialty'),
  skills: z.array(z.string()), equipment: z.array(z.string()), avatarUrl: optUrl, status: z.enum(['active', 'on_leave', 'inactive']), featured: z.boolean(),
  weekdays: z.array(z.string()).min(1, 'Choose at least one working day'), blockedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')), availNote: z.string().max(200).optional(),
});
type PhF = z.infer<typeof phSchema>;
export function PhotographersAdmin() {
  const fields: FieldDef[] = [
    { name: 'name', label: 'Full name', type: 'text', required: true }, { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Lead Wedding Photographer' },
    { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', type: 'text', required: true },
    { name: 'experienceYears', label: 'Years of experience', type: 'number' }, { name: 'rating', label: 'Rating (1–5)', type: 'number', step: 0.1, min: 1 },
    { name: 'bio', label: 'Bio', type: 'textarea', rows: 4, required: true }, { name: 'specialties', label: 'Specialties', type: 'chips', options: CATEGORY_OPTIONS },
    { name: 'skills', label: 'Skills', type: 'tags', placeholder: 'Candid, Drone… press Enter' }, { name: 'equipment', label: 'Equipment', type: 'tags', placeholder: 'Sony A7R V…' },
    { name: 'avatarUrl', label: 'Photo URL', type: 'image' }, { name: 'status', label: 'Status', type: 'select', options: [...ACTIVE.slice(0, 1), { value: 'on_leave', label: 'On leave' }, ACTIVE[1]] },
    { name: 'weekdays', label: 'Working days', type: 'chips', options: DAYS.map((d, i) => ({ value: String(i), label: d })), hint: 'Used for booking-assignment hints.' },
    { name: 'blockedDates', label: 'Blocked dates', type: 'tags', placeholder: 'YYYY-MM-DD then Enter' }, { name: 'availNote', label: 'Availability note', type: 'text', span: 2 },
    { name: 'featured', label: 'Feature on the public website', type: 'toggle' },
  ];
  return (
    <CrudPage<Photographer, PhF> title="Photographers" subtitle="Your team, their specialties and availability." noun="photographer" queryKey="photographers" pageSize={9} modalSize="lg"
      load={(t, p) => services.photographers.list(t, p)} create={(t, v) => services.photographers.create(t, v)} update={(t, id, v) => services.photographers.update(t, id, v)} remove={(t, id) => services.photographers.remove(t, id)}
      invalidate={['analytics', 'events', 'bookings']} searchPlaceholder="Search name, specialty…"
      filters={[{ name: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'on_leave', label: 'On leave' }, { value: 'inactive', label: 'Inactive' }] }]}
      deleteBody={(p) => <>Remove <b>{p.name}</b>? They are unassigned from all events and bookings. Consider setting them to “Inactive” instead to keep history.</>}
      columns={[
        { key: 'n', header: 'Photographer', primary: true, cell: (p) => <div className="flex items-center gap-2.5"><Avatar src={p.avatarUrl} name={p.name} size={34} /><div><p className="font-medium">{p.name}</p><p className="text-xs text-ink-muted">{p.title}</p></div></div> },
        { key: 'sp', header: 'Specialties', hideBelow: 'lg', cell: (p) => <span className="text-xs">{p.specialties.map(titleCase).join(', ')}</span> },
        { key: 'ex', header: 'Experience', hideBelow: 'xl', cell: (p) => `${p.experienceYears} yrs` },
        { key: 'r', header: 'Rating', cell: (p) => <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{p.rating.toFixed(1)}</span> },
        { key: 's', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
      ]}
      renderGrid={(rows, { edit, del }) => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((p) => (
          <div key={p.id} className="card flex gap-3 p-3">
            <Avatar src={p.avatarUrl} name={p.name} size={56} />
            <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{p.name}</p><p className="truncate text-xs text-ink-muted">{p.title}</p></div><StatusBadge status={p.status} /></div>
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-2"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{p.rating.toFixed(1)} · {p.experienceYears} yrs{p.featured && <Badge tone="brand" className="ml-1">Featured</Badge>}</p>
              <div className="mt-2 flex gap-1">{DAYS.map((d, i) => <span key={d} title={d} className={cn('grid h-5 w-6 place-items-center rounded text-[9px] font-medium', p.availability.weekdays.includes(i) ? 'bg-ink text-white' : 'bg-paper-2 text-ink-faint')}>{d[0]}</span>)}</div>
              <div className="mt-2 flex justify-end gap-1"><IconButton label="Edit photographer" onClick={() => edit(p)}><Pencil className="h-4 w-4" /></IconButton><IconButton label="Delete photographer" onClick={() => del(p)} className="hover:text-red-600"><Trash2 className="h-4 w-4" /></IconButton></div></div>
          </div>))}</div>)}
      fields={fields} schema={phSchema as never}
      defaults={(p) => ({ name: p?.name ?? '', title: p?.title ?? '', email: p?.email ?? '', phone: p?.phone ?? '', experienceYears: p?.experienceYears ?? 1, rating: p?.rating ?? 5, bio: p?.bio ?? '', specialties: p?.specialties ?? [], skills: p?.skills ?? [], equipment: p?.equipment ?? [], avatarUrl: p?.avatarUrl ?? '', status: p?.status ?? 'active', featured: p?.featured ?? false, weekdays: (p?.availability.weekdays ?? [1, 2, 3, 4, 5, 6]).map(String), blockedDates: p?.availability.blockedDates ?? [], availNote: p?.availability.note ?? '' })}
      toPayload={(v) => { const { weekdays, blockedDates, availNote, ...rest } = v; return { ...rest, availability: { weekdays: weekdays.map(Number).sort(), blockedDates, note: availNote ?? '' } }; }} />
  );
}
 
/* ---------------------------------------------------------------- Services */
const svcSchema = z.object({ name: z.string().trim().min(2, 'Enter a service name'), category: z.string().min(1, 'Choose a category'), description: z.string().trim().min(10, 'Add a short description'), startingPrice: num(0, 100000000, 'Enter a price'), imageUrl: optUrl, status: z.enum(['active', 'inactive']), featured: z.boolean(), sortOrder: num(0, 999, 'Enter an order') });
type SvcF = z.infer<typeof svcSchema>;
export function ServicesAdmin() {
  const { money } = useTenant();
  return (
    <CrudPage<Service, SvcF> title="Services" subtitle="What you photograph — shown on the website and in booking forms." noun="service" queryKey="services" invalidate={['packages']}
      load={(t, p) => services.services.list(t, { ...p, sort: 'sortOrder' })} create={(t, v) => services.services.create(t, v)} update={(t, id, v) => services.services.update(t, id, v)} remove={(t, id) => services.services.remove(t, id)}
      filters={[{ name: 'status', label: 'Status', options: ACTIVE }]}
      columns={[
        { key: 'n', header: 'Service', primary: true, cell: (s) => <div className="flex items-center gap-2.5"><SmartImage src={s.imageUrl} alt="" width={96} className="h-9 w-12 rounded-md" /><div><p className="font-medium">{s.name}</p><p className="text-xs text-ink-muted">{titleCase(s.category)}</p></div></div> },
        { key: 'p', header: 'Starting at', align: 'right', cell: (s) => <span className="tabular-nums">{money(s.startingPrice)}</span> },
        { key: 'f', header: 'Featured', hideBelow: 'lg', cell: (s) => (s.featured ? <Badge tone="brand">Featured</Badge> : <span className="text-xs text-ink-faint">—</span>) },
        { key: 's', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
      ]}
      fields={[{ name: 'name', label: 'Name', type: 'text', required: true }, { name: 'category', label: 'Category', type: 'select', options: CATEGORY_OPTIONS, required: true }, { name: 'description', label: 'Description', type: 'textarea', required: true }, { name: 'startingPrice', label: 'Starting price', type: 'number', min: 0 }, { name: 'sortOrder', label: 'Display order', type: 'number', min: 0 }, { name: 'imageUrl', label: 'Image URL', type: 'image' }, { name: 'status', label: 'Status', type: 'select', options: ACTIVE }, { name: 'featured', label: 'Feature on the home page', type: 'toggle' }]}
      schema={svcSchema as never} defaults={(s) => ({ name: s?.name ?? '', category: s?.category ?? '', description: s?.description ?? '', startingPrice: s?.startingPrice ?? 0, imageUrl: s?.imageUrl ?? '', status: s?.status ?? 'active', featured: s?.featured ?? false, sortOrder: s?.sortOrder ?? 99 })} />
  );
}
 
/* ---------------------------------------------------------------- Packages */
const pkgSchema = z.object({ serviceId: z.string().min(1, 'Choose a service'), name: z.string().trim().min(2, 'Enter a package name'), description: z.string().max(400).optional(), price: num(0, 100000000, 'Enter a price'), durationHours: num(1, 200, '1–200 hours'), photographerCount: num(1, 20, '1–20'), deliverables: z.array(z.string()), features: z.array(z.string()), popular: z.boolean(), status: z.enum(['active', 'inactive']), sortOrder: num(0, 999, 'Enter an order') });
type PkgF = z.infer<typeof pkgSchema>;
export function PackagesAdmin() {
  const { money } = useTenant(); const svc = useServiceList();
  const name = (id: string) => svc.data?.items.find((s) => s.id === id)?.name ?? '—';
  return (
    <CrudPage<Package, PkgF> title="Packages" subtitle="Priced bundles customers can choose when booking." noun="package" queryKey="packages" invalidate={['bookings']}
      load={(t, p) => services.packages.list(t, { ...p, sort: 'sortOrder' })} create={(t, v) => services.packages.create(t, v)} update={(t, id, v) => services.packages.update(t, id, v)} remove={(t, id) => services.packages.remove(t, id)}
      filters={[{ name: 'serviceId', label: 'Service', options: (svc.data?.items ?? []).map((s) => ({ value: s.id, label: s.name })) }, { name: 'status', label: 'Status', options: ACTIVE }]}
      columns={[
        { key: 'n', header: 'Package', primary: true, cell: (p) => <div><p className="flex items-center gap-1.5 font-medium">{p.name}{p.popular && <Badge tone="brand">Popular</Badge>}</p><p className="text-xs text-ink-muted">{name(p.serviceId)}</p></div> },
        { key: 'p', header: 'Price', align: 'right', cell: (p) => <span className="tabular-nums">{money(p.price)}</span> },
        { key: 'd', header: 'Coverage', hideBelow: 'lg', cell: (p) => `${p.durationHours}h · ${p.photographerCount} photographer${p.photographerCount > 1 ? 's' : ''}` },
        { key: 'del', header: 'Deliverables', hideBelow: 'xl', cell: (p) => <span className="line-clamp-1 max-w-[16rem] text-xs">{p.deliverables.join(' · ')}</span> },
        { key: 's', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
      ]}
      fields={[{ name: 'serviceId', label: 'Service', type: 'select', required: true, options: (svc.data?.items ?? []).map((s) => ({ value: s.id, label: s.name })) }, { name: 'name', label: 'Package name', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea', rows: 2 }, { name: 'price', label: 'Price', type: 'number', min: 0 }, { name: 'durationHours', label: 'Coverage (hours)', type: 'number', min: 1 }, { name: 'photographerCount', label: 'Photographers', type: 'number', min: 1 }, { name: 'sortOrder', label: 'Display order', type: 'number', min: 0 }, { name: 'deliverables', label: 'Deliverables', type: 'tags', placeholder: '500 edited photos, Album… Enter' }, { name: 'features', label: 'Features', type: 'tags', placeholder: 'Drone coverage… Enter' }, { name: 'status', label: 'Status', type: 'select', options: ACTIVE }, { name: 'popular', label: 'Mark as “Most popular”', type: 'toggle' }]}
      schema={pkgSchema as never} defaults={(p) => ({ serviceId: p?.serviceId ?? '', name: p?.name ?? '', description: p?.description ?? '', price: p?.price ?? 0, durationHours: p?.durationHours ?? 6, photographerCount: p?.photographerCount ?? 1, deliverables: p?.deliverables ?? [], features: p?.features ?? [], popular: p?.popular ?? false, status: p?.status ?? 'active', sortOrder: p?.sortOrder ?? 99 })} />
  );
}
 
/* ---------------------------------------------------------------- Testimonials */
const tstSchema = z.object({ clientName: z.string().trim().min(2, 'Enter the client name'), role: z.string().max(80).optional(), eventType: z.string().min(1, 'Choose an event type'), rating: num(1, 5, 'Rating is 1–5'), quote: z.string().trim().min(20, 'Quote needs at least 20 characters').max(600), avatarUrl: optUrl, featured: z.boolean() });
type TstF = z.infer<typeof tstSchema>;
export function TestimonialsAdmin() {
  return (
    <CrudPage<Testimonial, TstF> title="Testimonials" subtitle="Real client feedback — featured ones appear on your home page." noun="testimonial" queryKey="testimonials"
      load={(t, p) => services.testimonials.list(t, p)} create={(t, v) => services.testimonials.create(t, v)} update={(t, id, v) => services.testimonials.update(t, id, v)} remove={(t, id) => services.testimonials.remove(t, id)}
      columns={[
        { key: 'n', header: 'Client', primary: true, cell: (t) => <div className="flex items-center gap-2.5"><Avatar src={t.avatarUrl} name={t.clientName} size={32} /><div><p className="font-medium">{t.clientName}</p><p className="text-xs text-ink-muted">{t.role || titleCase(t.eventType)}</p></div></div> },
        { key: 'q', header: 'Quote', hideBelow: 'lg', cell: (t) => <span className="line-clamp-2 max-w-md text-xs text-ink-2">“{t.quote}”</span> },
        { key: 'r', header: 'Rating', cell: (t) => <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{t.rating}</span> },
        { key: 'f', header: 'Featured', cell: (t) => (t.featured ? <Badge tone="brand">Featured</Badge> : <span className="text-xs text-ink-faint">—</span>) },
      ]}
      fields={[{ name: 'clientName', label: 'Client name', type: 'text', required: true }, { name: 'role', label: 'Role / description', type: 'text', placeholder: 'Bride, Mumbai' }, { name: 'eventType', label: 'Event type', type: 'select', options: CATEGORY_OPTIONS, required: true }, { name: 'rating', label: 'Rating (1–5)', type: 'number', min: 1 }, { name: 'quote', label: 'Quote', type: 'textarea', rows: 4, required: true, hint: 'Only add feedback a client actually gave you.' }, { name: 'avatarUrl', label: 'Photo URL', type: 'image' }, { name: 'featured', label: 'Feature on the home page', type: 'toggle' }]}
      schema={tstSchema as never} defaults={(t) => ({ clientName: t?.clientName ?? '', role: t?.role ?? '', eventType: t?.eventType ?? 'wedding', rating: t?.rating ?? 5, quote: t?.quote ?? '', avatarUrl: t?.avatarUrl ?? '', featured: t?.featured ?? false })} />
  );
}
 
/* ---------------------------------------------------------------- YouTube */
const vidSchema = z.object({
  title: z.string().trim().min(3, 'Enter a title'), youtubeUrl: z.string().trim().min(1, 'Paste a YouTube link').refine((v) => !!parseYouTube(v), 'Not a valid YouTube link (watch, youtu.be, embed or shorts)'),
  category: z.enum(['wedding', 'pre-wedding', 'event', 'showcase']), description: z.string().max(400).optional(), visibility: z.enum(['public', 'client']), eventId: z.string().optional(), clientId: z.string().optional(),
  thumbnailUrl: optUrl, featured: z.boolean(), enabled: z.boolean(),
}).refine((v) => v.visibility === 'public' || !!v.clientId, { path: ['clientId'], message: 'Choose the client who can watch this private video' });
type VidF = z.infer<typeof vidSchema>;
export function VideosAdmin() {
  const events = useEventList(); const clients = useClientList();
  return (
    <CrudPage<Video, VidF> title="YouTube videos" subtitle="Wedding films, pre-wedding stories and showcases embedded from YouTube." noun="video" queryKey="videos" pageSize={9} modalSize="lg"
      load={(t, p) => services.videos.list(t, p)} create={(t, v) => services.videos.create(t, norm(v))} update={(t, id, v) => services.videos.update(t, id, norm(v))} remove={(t, id) => services.videos.remove(t, id)}
      filters={[{ name: 'category', label: 'Category', options: ['wedding', 'pre-wedding', 'event', 'showcase'].map((v) => ({ value: v, label: titleCase(v) })) }, { name: 'visibility', label: 'Visibility', options: [{ value: 'public', label: 'Public' }, { value: 'client', label: 'Client only' }] }]}
      columns={[
        { key: 't', header: 'Video', primary: true, cell: (v) => <div className="flex items-center gap-2.5"><SmartImage src={v.thumbnailUrl} alt="" width={120} className="h-9 w-16 shrink-0 rounded-md" /><div className="min-w-0"><p className="truncate font-medium">{v.title}</p><p className="text-xs text-ink-muted">{titleCase(v.category)}</p></div></div> },
        { key: 'v', header: 'Visibility', hideBelow: 'lg', cell: (v) => <Badge tone={v.visibility === 'public' ? 'info' : 'violet'}>{v.visibility === 'public' ? 'Public' : 'Client only'}</Badge> },
        { key: 'f', header: 'Featured', hideBelow: 'lg', cell: (v) => (v.featured ? <Badge tone="brand">Featured</Badge> : <span className="text-xs text-ink-faint">—</span>) },
        { key: 's', header: 'Shown', cell: (v) => (v.enabled ? <span className="inline-flex items-center gap-1 text-emerald-700"><Eye className="h-4 w-4" />Live</span> : <span className="inline-flex items-center gap-1 text-ink-faint"><EyeOff className="h-4 w-4" />Hidden</span>) },
      ]}
      renderGrid={(rows, { edit, del }) => (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((v) => (
          <div key={v.id} className={cn('card overflow-hidden', !v.enabled && 'opacity-70')}>
            <YouTubeEmbed videoId={v.youtubeId} title={v.title} thumbnail={v.thumbnailUrl} className="rounded-none" />
            <div className="p-3"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-semibold leading-snug">{v.title}</p><div className="flex shrink-0"><IconButton label="Edit video" onClick={() => edit(v)}><Pencil className="h-4 w-4" /></IconButton><IconButton label="Delete video" onClick={() => del(v)} className="hover:text-red-600"><Trash2 className="h-4 w-4" /></IconButton></div></div>
              <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge>{titleCase(v.category)}</Badge><Badge tone={v.visibility === 'public' ? 'info' : 'violet'}>{v.visibility === 'public' ? 'Public' : 'Client only'}</Badge>{v.featured && <Badge tone="brand">Featured</Badge>}{!v.enabled && <Badge tone="warning">Hidden</Badge>}</div></div>
          </div>))}</div>)}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true, span: 2 },
        { name: 'youtubeUrl', label: 'YouTube link', type: 'url', required: true, span: 2, placeholder: 'https://www.youtube.com/watch?v=…', hint: 'Watch, youtu.be, embed and Shorts links are accepted. Videos play through youtube-nocookie.' },
        { name: 'category', label: 'Category', type: 'select', options: ['wedding', 'pre-wedding', 'event', 'showcase'].map((v) => ({ value: v, label: titleCase(v) })) }, { name: 'visibility', label: 'Visibility', type: 'select', options: [{ value: 'public', label: 'Public website' }, { value: 'client', label: 'Private — one client' }] },
        { name: 'clientId', label: 'Client (private videos)', type: 'select', options: (clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name })) }, { name: 'eventId', label: 'Related event', type: 'select', options: (events.data?.items ?? []).map((e) => ({ value: e.id, label: e.title })) },
        { name: 'description', label: 'Description', type: 'textarea', rows: 2 }, { name: 'thumbnailUrl', label: 'Custom thumbnail (optional)', type: 'image' },
        { name: 'featured', label: 'Feature on the home page', type: 'toggle' }, { name: 'enabled', label: 'Show this video', type: 'toggle' },
      ]}
      schema={vidSchema as never} defaults={(v) => ({ title: v?.title ?? '', youtubeUrl: v?.youtubeUrl ?? '', category: v?.category ?? 'showcase', description: v?.description ?? '', visibility: v?.visibility ?? 'public', eventId: v?.eventId ?? '', clientId: v?.clientId ?? '', thumbnailUrl: '', featured: v?.featured ?? false, enabled: v?.enabled ?? true })} />
  );
}
const norm = (v: VidF) => ({ ...v, eventId: v.eventId || null, clientId: v.clientId || null, thumbnailUrl: v.thumbnailUrl || undefined });
 
/* ---------------------------------------------------------------- Google Drive */
const drvSchema = z.object({ title: z.string().trim().min(3, 'Enter a title'), url: z.string().trim().min(1, 'Paste a Google Drive link').refine((v) => !!parseDrive(v), 'Use a drive.google.com folder or file link (https://drive.google.com/drive/folders/…)'), description: z.string().max(300).optional(), clientId: z.string().min(1, 'Choose the client'), eventId: z.string().optional(), visibility: z.enum(['client', 'private']) });
type DrvF = z.infer<typeof drvSchema>;
export function DriveAdmin() {
  const events = useEventList(); const clients = useClientList();
  const cname = (id: string | null) => clients.data?.items.find((c) => c.id === id)?.name ?? '—';
  const ename = (id: string | null) => events.data?.items.find((e) => e.id === id)?.title;
  return (
    <CrudPage<DriveLink, DrvF> title="Google Drive links" subtitle="Share full-resolution folders with clients. Drive permissions are controlled in Google Drive." noun="Drive link" queryKey="drive"
      load={(t, p) => services.drive.list(t, p)} create={(t, v) => services.drive.create(t, norm2(v))} update={(t, id, v) => services.drive.update(t, id, norm2(v))} remove={(t, id) => services.drive.remove(t, id)}
      filters={[{ name: 'visibility', label: 'Visibility', options: [{ value: 'client', label: 'Visible to client' }, { value: 'private', label: 'Staff only' }] }]}
      columns={[
        { key: 't', header: 'Folder', primary: true, cell: (l) => <div><p className="font-medium">{l.title}</p><p className="text-xs text-ink-muted">{ename(l.eventId) ?? 'No event'} · {formatDate(l.createdAt)}</p></div> },
        { key: 'c', header: 'Client', hideBelow: 'lg', cell: (l) => cname(l.clientId) },
        { key: 'v', header: 'Visibility', cell: (l) => <Badge tone={l.visibility === 'client' ? 'success' : 'neutral'}>{l.visibility === 'client' ? 'Client sees it' : 'Staff only'}</Badge> },
        { key: 'o', header: 'Open', cell: (l) => <DriveButton url={l.url} compact /> },
      ]}
      fields={[
        { name: 'title', label: 'Title', type: 'text', required: true, span: 2, placeholder: 'Wedding — full resolution' },
        { name: 'url', label: 'Google Drive link', type: 'url', required: true, span: 2, placeholder: 'https://drive.google.com/drive/folders/…', notice: <p className="mt-1.5 rounded-lg bg-blue-50 p-2 text-[11px] leading-snug text-blue-900">{DRIVE_NOTICE}</p> },
        { name: 'clientId', label: 'Client', type: 'select', required: true, options: (clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name })) }, { name: 'eventId', label: 'Related event', type: 'select', options: (events.data?.items ?? []).map((e) => ({ value: e.id, label: e.title })) },
        { name: 'visibility', label: 'Visibility', type: 'select', options: [{ value: 'client', label: 'Visible to client' }, { value: 'private', label: 'Staff only' }] }, { name: 'description', label: 'Note to client', type: 'text' },
      ]}
      schema={drvSchema as never} defaults={(l) => ({ title: l?.title ?? '', url: l?.url ?? '', description: l?.description ?? '', clientId: l?.clientId ?? '', eventId: l?.eventId ?? '', visibility: l?.visibility ?? 'client' })} />
  );
}
const norm2 = (v: DrvF) => ({ ...v, eventId: v.eventId || null, clientId: v.clientId || null });
 
/* ---------------------------------------------------------------- Blog */
const blogSchema = z.object({ title: z.string().trim().min(5, 'Enter a title'), excerpt: z.string().trim().min(20, 'Add a one–two sentence excerpt').max(240), body: z.string().trim().min(80, 'Write at least a short article'), coverUrl: optUrl, category: z.enum(['tips', 'stories']), authorName: z.string().trim().min(2, 'Enter the author'), readMinutes: num(1, 60, '1–60'), status: z.enum(['published', 'draft']) });
type BlogF = z.infer<typeof blogSchema>;
export function BlogAdmin() {
  return (
    <CrudPage<BlogPost, BlogF> title="Blog" subtitle="Tips and real stories that help couples find you." noun="article" queryKey="blog" modalSize="lg"
      load={(t, p) => services.blog.list(t, p)} create={(t, v) => services.blog.create(t, withBlog(v))} update={(t, id, v) => services.blog.update(t, id, withBlog(v, true))} remove={(t, id) => services.blog.remove(t, id)}
      filters={[{ name: 'status', label: 'Status', options: [{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }] }, { name: 'category', label: 'Category', options: [{ value: 'tips', label: 'Tips' }, { value: 'stories', label: 'Stories' }] }]}
      columns={[
        { key: 't', header: 'Article', primary: true, cell: (b) => <div className="flex items-center gap-2.5"><SmartImage src={b.coverUrl} alt="" width={96} className="h-9 w-12 shrink-0 rounded-md" /><div className="min-w-0"><p className="truncate font-medium">{b.title}</p><p className="text-xs text-ink-muted">{b.authorName} · {b.readMinutes} min read</p></div></div> },
        { key: 'c', header: 'Category', hideBelow: 'lg', cell: (b) => titleCase(b.category) }, { key: 'd', header: 'Published', hideBelow: 'lg', cell: (b) => formatDate(b.publishedAt) },
        { key: 's', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
      ]}
      fields={[{ name: 'title', label: 'Title', type: 'text', required: true, span: 2 }, { name: 'excerpt', label: 'Excerpt', type: 'textarea', rows: 2, required: true }, { name: 'body', label: 'Article', type: 'textarea', rows: 9, required: true, hint: 'Separate paragraphs with a blank line.' }, { name: 'coverUrl', label: 'Cover image URL', type: 'image' }, { name: 'category', label: 'Category', type: 'select', options: [{ value: 'tips', label: 'Tips' }, { value: 'stories', label: 'Stories' }] }, { name: 'authorName', label: 'Author', type: 'text', required: true }, { name: 'readMinutes', label: 'Read time (min)', type: 'number', min: 1 }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'published', label: 'Published' }, { value: 'draft', label: 'Draft' }] }]}
      schema={blogSchema as never} defaults={(b) => ({ title: b?.title ?? '', excerpt: b?.excerpt ?? '', body: b?.body ?? '', coverUrl: b?.coverUrl ?? '', category: b?.category ?? 'tips', authorName: b?.authorName ?? '', readMinutes: b?.readMinutes ?? 4, status: b?.status ?? 'draft' })} />
  );
}
const withBlog = (v: BlogF, editing = false) => ({ ...v, slug: slugify(v.title), ...(editing ? {} : { publishedAt: new Date().toISOString() }) });