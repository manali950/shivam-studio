import { useState } from 'react';
import { ArrowRight, Bell, CalendarDays, Images, Plus, Video as VideoIcon } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { daysUntil, formatDate, timeAgo, titleCase } from '@/lib/utils';
import type { StudioEvent } from '@/types';
import { TLink } from '@/components/shared/TLink';
import { Countdown, DriveButton, PaymentBar, PhotographerStack, deliveryMessage } from '@/components/shared/Bits';
import { DeliveryTracker, DueBadge } from '@/components/shared/DeliveryTracker';
import { Lightbox } from '@/components/shared/Lightbox';
import { YouTubeEmbed } from '@/components/shared/YouTubeEmbed';
import { btn } from '@/components/ui/Button';
import { StatusBadge, Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { SmartImage } from '@/components/ui/SmartImage';
import { useAllPhotographers, useCatalogue, useClientBookings, useClientDrive, useClientEvents, useClientGalleries, useClientVideos } from './clientData';
 
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
 
function DeliveryCard({ e, galleryId, drive }: { e: StudioEvent; galleryId?: string; drive?: string }) {
  const m = deliveryMessage(e);
  const live = e.delivery.status === 'highlights_published' || e.delivery.status === 'delivered';
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-card ${live ? 'border-emerald-200' : 'border-line'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{e.title}</p><p className="text-xs text-ink-muted">{formatDate(e.date)} · {e.venue}</p></div>
        <div className="flex items-center gap-1.5"><DueBadge delivery={e.delivery} /><Badge tone={m.tone === 'success' ? 'success' : m.tone === 'warning' ? 'warning' : m.tone === 'info' ? 'info' : 'neutral'} dot>{m.title}</Badge></div>
      </div>
      <DeliveryTracker delivery={e.delivery} className="mt-4" />
      <p className="mt-3 text-xs text-ink-muted">{m.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {live && <TLink to={`/portal/photos?event=${e.id}${galleryId ? `&gallery=${galleryId}` : ''}`} className={btn('primary', 'sm')}>{e.delivery.status === 'delivered' ? 'Open complete gallery' : 'View highlights'}<ArrowRight className="h-3.5 w-3.5" /></TLink>}
        {drive && <DriveButton url={drive} compact />}
      </div>
    </div>
  );
}
 
export default function ClientDashboard() {
  const { user } = useAuth();
  const { tenant, config, money } = useTenant();
  const cat = useCatalogue(); const bk = useClientBookings(); const ev = useClientEvents(); const gal = useClientGalleries(); const vids = useClientVideos(); const drive = useClientDrive(); const ph = useAllPhotographers();
  const notes = useTenantQuery(['notifications', 'dash', user!.id], (t) => services.notifications.list(t, user!.id, { pageSize: 4 }));
  const [light, setLight] = useState<number | null>(null);
 
  const events = ev.data?.items ?? [];
  const upcoming = (bk.data?.items ?? []).filter((b) => ['enquiry', 'pending', 'confirmed'].includes(b.status) && daysUntil(b.eventDate) >= 0).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const nextEvent = events.filter((e) => e.status === 'scheduled' || e.status === 'in_progress').sort((a, b) => a.date.localeCompare(b.date))[0];
  const deliveries = events.filter((e) => e.status === 'completed').sort((a, b) => (b.delivery.completedAt ?? '').localeCompare(a.delivery.completedAt ?? ''));
  const latest = (gal.data?.items ?? []).filter((g) => g.highlightsPublishedAt || g.completePublishedAt).sort((a, b) => (b.highlightsPublishedAt ?? '').localeCompare(a.highlightsPublishedAt ?? ''))[0];
  const latestFull = useTenantQuery(['galleries', 'latest', latest?.id], (t) => services.galleries.get(t, latest!.id), { enabled: !!latest });
  const photos = (latestFull.data?.photos ?? []).filter((p) => p.isHighlight || latestFull.data?.completePublishedAt).slice(0, 8);
  const driveFor = (id: string) => drive.data?.items.find((d) => d.eventId === id)?.url;
 
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">{tenant.name}</p><h1 className="font-serif text-3xl font-semibold sm:text-4xl">{greeting()}, {user?.name.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-ink-muted">{nextEvent ? <>Your next event, <b className="text-ink">{nextEvent.title}</b>, is {daysUntil(nextEvent.date) === 0 ? 'today' : `in ${daysUntil(nextEvent.date)} days`}.</> : 'Everything about your photography in one place.'}</p></div>
        <TLink to="/booking" className={btn('dark', 'md')}><Plus className="h-4 w-4" />Book another shoot</TLink>
      </div>
 
      {/* Delivery — the most prominent block */}
      <section aria-labelledby="delivery-h">
        <div className="mb-2 flex items-center justify-between"><h2 id="delivery-h" className="flex items-center gap-2 text-sm font-semibold"><Images className="h-4 w-4 text-brand-dark" />Photo delivery</h2><TLink to="/portal/photos" className="text-xs font-semibold text-brand-dark">All galleries →</TLink></div>
        {ev.isLoading ? <Skeleton className="h-44 rounded-xl" /> : deliveries.length === 0 ? <EmptyState title="No completed events yet" body={`After your event, highlights are published within ${config.settings.deliveryTargetHours} hours.`} /> : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{deliveries.slice(0, 2).map((e) => <DeliveryCard key={e.id} e={e} galleryId={gal.data?.items.find((g) => g.eventId === e.id)?.id} drive={driveFor(e.id)} />)}</div>
        )}
      </section>
 
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Upcoming bookings" subtitle="Dates, payment and your team" action={<TLink to="/portal/bookings" className="text-xs font-semibold text-brand-dark">All bookings</TLink>} />
          {bk.isLoading ? <div className="space-y-2 p-4"><Skeleton className="h-16" /><Skeleton className="h-16" /></div> : upcoming.length === 0 ? <div className="p-4"><EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No upcoming bookings" action={<TLink to="/booking" className={btn('primary', 'sm')}>Plan your next shoot</TLink>} /></div> : (
            <ul className="divide-y divide-line">{upcoming.slice(0, 3).map((b) => (
              <li key={b.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{cat.service(b.serviceId)}</p><StatusBadge status={b.status} /><StatusBadge status={b.paymentStatus} /></div>
                  <p className="mt-0.5 text-xs text-ink-muted">{b.reference} · {formatDate(b.eventDate)} · {b.location}</p>
                  <div className="mt-2 flex items-center gap-3"><Countdown date={b.eventDate} /><PhotographerStack ids={b.assignedPhotographerIds} all={ph.data?.items ?? []} /></div>
                </div>
                <PaymentBar amount={b.amount} paid={b.paidAmount} currency={config.settings.currency} locale={config.settings.locale} />
              </li>))}</ul>
          )}
        </Card>
 
        <Card>
          <CardHeader title="Recent notifications" action={<TLink to="/portal/notifications" className="text-xs font-semibold text-brand-dark">View all</TLink>} />
          <ul className="divide-y divide-line">
            {notes.isLoading && <li className="p-4"><Skeleton className="h-12" /></li>}
            {notes.data?.items.length === 0 && <li className="p-4 text-sm text-ink-muted">No notifications yet.</li>}
            {notes.data?.items.map((n) => <li key={n.id} className="flex gap-2.5 p-3"><span className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full ${n.read ? 'bg-paper-2 text-ink-faint' : 'bg-brand-soft text-brand-dark'}`}><Bell className="h-3 w-3" /></span><div className="min-w-0"><p className="truncate text-[13px] font-medium">{n.title}</p><p className="line-clamp-2 text-xs text-ink-muted">{n.body}</p><p className="mt-0.5 text-[10px] text-ink-faint">{timeAgo(n.createdAt)}</p></div></li>)}
          </ul>
        </Card>
      </div>
 
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Latest delivered photographs" subtitle={latest ? `${latest.title} · ${latest.completePublishedAt ? 'complete gallery' : 'highlights'}` : undefined} action={<TLink to="/portal/photos" className="text-xs font-semibold text-brand-dark">Open photos</TLink>} />
          {!latest ? <div className="p-4"><EmptyState title="Nothing delivered yet" body="Your highlights will appear here the moment they are published." /></div> : (
            <div className="grid grid-cols-2 gap-1.5 p-3 sm:grid-cols-4">{(photos.length ? photos : Array.from<undefined>({ length: 4 })).map((p, i) => p ? (
              <button key={p.id} onClick={() => setLight(i)} aria-label={`Preview ${p.title}`} className="group overflow-hidden rounded-lg"><SmartImage src={p.url} alt={p.title} ratio="1/1" width={360} className="w-full" imgClassName="transition duration-500 group-hover:scale-105" /></button>) : <Skeleton key={i} className="aspect-square" />)}</div>
          )}
        </Card>
        <Card>
          <CardHeader title="Your videos" action={<TLink to="/portal/videos" className="text-xs font-semibold text-brand-dark">All videos</TLink>} />
          <div className="space-y-3 p-3">
            {vids.isLoading && <Skeleton className="aspect-video" />}
            {vids.data?.items.filter((v) => v.clientId).slice(0, 1).map((v) => <div key={v.id}><YouTubeEmbed videoId={v.youtubeId} title={v.title} thumbnail={v.thumbnailUrl} /><p className="mt-2 text-sm font-medium">{v.title}</p><p className="text-xs text-ink-muted">{titleCase(v.category)}</p></div>)}
            {vids.data && !vids.data.items.some((v) => v.clientId) && <EmptyState icon={<VideoIcon className="h-5 w-5" />} title="No films yet" body="Wedding films and highlights will be added here." />}
            {drive.data && drive.data.items.length > 0 && <div className="border-t border-line pt-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Google Drive folders</p><div className="flex flex-col gap-2">{drive.data.items.slice(0, 2).map((d) => <DriveButton key={d.id} url={d.url} title={d.title} compact />)}</div></div>}
          </div>
        </Card>
      </div>
      <p className="text-center text-[11px] text-ink-faint">Event balance and amounts are shown in {config.settings.currency}. Total spent on your bookings: {money((bk.data?.items ?? []).reduce((s, b) => s + b.paidAmount, 0))}.</p>
      {light !== null && <Lightbox photos={photos} index={light} onIndex={setLight} onClose={() => setLight(null)} allowDownload />}
    </div>
  );
}
 