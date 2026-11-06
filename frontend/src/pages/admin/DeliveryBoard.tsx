import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Images, Send, Sparkles, Star } from 'lucide-react';
import { useTenantMutation, useTenantQuery } from '@/hooks/data';
import { useStudioStats } from '@/hooks/admin';
import { services } from '@/services/data-provider';
import { cn, formatDate, formatDateTime, pluralize, timeAgo } from '@/lib/utils';
import type { Gallery, StudioEvent } from '@/types';
import { PhotographerStack } from '@/components/shared/Bits';
import { DeliveryTracker, DueBadge, deliveryDue } from '@/components/shared/DeliveryTracker';
import { Lightbox } from '@/components/shared/Lightbox';
import { TLink } from '@/components/shared/TLink';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { SmartImage } from '@/components/ui/SmartImage';
import { usePhotographerList } from '@/hooks/admin';
 
type Col = 'awaiting' | 'review' | 'live' | 'done';
const COLS: { key: Col; title: string; hint: string; tone: string }[] = [
  { key: 'awaiting', title: 'Awaiting highlights', hint: 'Shoot done — photographer picking selects', tone: 'bg-amber-500' },
  { key: 'review', title: 'Highlights in review', hint: 'Submitted — your approval needed', tone: 'bg-blue-500' },
  { key: 'live', title: 'Highlights live', hint: 'Client sees highlights — complete gallery pending', tone: 'bg-brand' },
  { key: 'done', title: 'Delivered', hint: 'Complete gallery published', tone: 'bg-emerald-500' },
];
const colOf = (e: StudioEvent): Col => (e.delivery.galleryPublishedAt ? 'done' : e.delivery.highlightsPublishedAt ? 'live' : e.delivery.highlightsSubmittedAt ? 'review' : 'awaiting');
 
export default function DeliveryBoard() {
  const q = useTenantQuery(['events', 'delivery-board'], (t) => services.events.list(t, { status: 'completed', pageSize: 200, sort: 'date', order: 'desc' }));
  const ph = usePhotographerList(); const stats = useStudioStats();
  const [review, setReview] = useState<{ e: StudioEvent; mode: 'highlights' | 'complete' } | null>(null);
  const events = q.data?.items ?? [];
  const by = (c: Col) => events.filter((e) => colOf(e) === c).sort((a, b) => (c === 'done' ? b.delivery.galleryPublishedAt!.localeCompare(a.delivery.galleryPublishedAt!) : (a.delivery.completedAt ?? '').localeCompare(b.delivery.completedAt ?? '')));
  const overdue = events.filter((e) => deliveryDue(e.delivery)?.overdue).length;
  return (
    <div>
      <PageHeader title="Photo delivery" subtitle="Next-day highlights first, complete galleries later. You approve every release." actions={<TLink to="/admin/galleries" className="text-sm font-semibold text-brand-dark">Manage galleries →</TLink>} />
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge tone={overdue ? 'danger' : 'success'}>{overdue ? `${pluralize(overdue, 'event')} past the highlight target` : 'All within target'}</Badge>
        <Badge tone="neutral">{stats.data?.totals.pendingDeliveries ?? '…'} not fully delivered</Badge>
        <span className="self-center text-ink-faint">Overdue is a flag only — nothing is delivered automatically.</span>
      </div>
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-4"><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /><Skeleton className="h-72" /></div> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLS.map((c) => { const items = by(c.key).slice(0, c.key === 'done' ? 8 : 50); return (
            <section key={c.key} aria-label={c.title} className="flex min-h-[10rem] flex-col rounded-xl bg-paper-2/70 p-2">
              <header className="px-2 pb-2 pt-1"><div className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', c.tone)} /><h2 className="text-[13px] font-semibold">{c.title}</h2><span className="ml-auto rounded-full bg-white px-2 text-[11px] font-semibold tabular-nums">{by(c.key).length}</span></div><p className="mt-0.5 text-[11px] text-ink-muted">{c.hint}</p></header>
              <div className="flex-1 space-y-2">
                {items.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">Nothing here</p>}
                {items.map((e) => (
                  <Card key={e.id} className="p-3">
                    <div className="flex items-start justify-between gap-2"><p className="text-[13px] font-semibold leading-snug">{e.title}</p><DueBadge delivery={e.delivery} /></div>
                    <p className="mt-0.5 text-[11px] text-ink-muted">Shot {formatDate(e.date)}{e.delivery.completedAt && ` · done ${timeAgo(e.delivery.completedAt)}`}</p>
                    <div className="mt-2 flex items-center justify-between"><PhotographerStack ids={e.photographerIds} all={ph.data?.items ?? []} /><span className="text-[11px] text-ink-faint">target {e.delivery.targetHours}h</span></div>
                    <DeliveryTracker delivery={e.delivery} compact className="mt-3" />
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.key === 'awaiting' && <TLink to={`/admin/events?open=${e.id}`} className="text-xs font-semibold text-brand-dark">Open event</TLink>}
                      {c.key === 'review' && <Button size="xs" icon={<Sparkles className="h-3.5 w-3.5" />} onClick={() => setReview({ e, mode: 'highlights' })}>Review &amp; publish</Button>}
                      {c.key === 'live' && <Button size="xs" variant="dark" icon={<Images className="h-3.5 w-3.5" />} onClick={() => setReview({ e, mode: 'complete' })}>Publish complete gallery</Button>}
                      {c.key !== 'awaiting' && <TLink to={`/admin/events?open=${e.id}`} className="self-center text-xs font-semibold text-ink-muted hover:text-ink">Details</TLink>}
                    </div>
                  </Card>))}
              </div>
            </section>); })}
        </div>
      )}
      {review && <ReviewModal e={review.e} mode={review.mode} onClose={() => setReview(null)} />}
    </div>
  );
}
 
function ReviewModal({ e, mode, onClose }: { e: StudioEvent; mode: 'highlights' | 'complete'; onClose: () => void }) {
  const gl = useTenantQuery(['galleries', 'event', e.id], (t) => services.galleries.listByEvent(t, e.id));
  const gid = gl.data?.[0]?.id;
  const gq = useTenantQuery(['galleries', 'detail', gid], (t) => services.galleries.get(t, gid!), { enabled: !!gid });
  const g = gq.data; const [light, setLight] = useState<number | null>(null);
  const toggle = useTenantMutation<{ id: string; on: boolean }, Gallery>((t, a) => services.galleries.updatePhoto(t, gid!, a.id, { isHighlight: a.on }), ['galleries']);
  const inv = ['galleries', 'events', 'analytics', 'notifications'];
  const pubH = useTenantMutation<void, Gallery>((t) => services.galleries.publishHighlights(t, gid!), inv, { success: 'Highlights published — the client has been notified', onSuccess: onClose });
  const pubC = useTenantMutation<void, Gallery>((t) => services.galleries.publishComplete(t, gid!), inv, { success: 'Complete gallery published — event delivered', onSuccess: onClose });
  const [, force] = useState(0); useEffect(() => { force((n) => n + 1); }, [g?.updatedAt]);
  const hl = g?.photos.filter((p) => p.isHighlight).length ?? 0;
  return (
    <Modal open onClose={onClose} size="xl" title={mode === 'highlights' ? 'Review highlights' : 'Publish complete gallery'} subtitle={`${e.title} · ${e.delivery.highlightsSubmittedAt ? `submitted ${formatDateTime(e.delivery.highlightsSubmittedAt)}` : 'not yet submitted'}`}
      footer={<>
        <Button variant="outline" onClick={onClose}>Close</Button>
        {mode === 'highlights' ? <Button icon={<Send className="h-4 w-4" />} disabled={!g || hl === 0} loading={pubH.isPending} onClick={() => pubH.mutate()}>Publish {hl} highlight{hl === 1 ? '' : 's'} to client</Button>
          : <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} disabled={!g || g.photos.length === 0} loading={pubC.isPending} onClick={() => pubC.mutate()}>Publish all {g?.photos.length ?? 0} photographs</Button>}
      </>}>
      {gl.isLoading || gq.isLoading ? <Skeleton className="h-64" /> : !gid ? <EmptyState icon={<Images className="h-5 w-5" />} title="No gallery linked to this event" body="Create a gallery for this event first." action={<TLink to={`/admin/galleries?new=1`} className="text-sm font-semibold text-brand-dark">Create gallery</TLink>} /> : gq.error || !g ? <ErrorState error={gq.error} onRetry={() => gq.refetch()} /> : (
        <div className="space-y-3">
          <p className="rounded-lg bg-paper p-3 text-sm text-ink-2">{mode === 'highlights' ? <>Swap any photograph in or out of the highlight set, then publish. <b>{e.delivery.notes ? `Photographer’s note: ${e.delivery.notes}` : ''}</b></> : <>This makes every photograph available to the client to view and download, marks the event <b>delivered</b> and sends a notification.</>}</p>
          {g.externalLinks.length > 0 && <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">Delivery links: {g.externalLinks.map((l) => <a key={l.id} className="inline-flex items-center gap-1 font-medium text-brand-dark" href={l.url} target="_blank" rel="noreferrer noopener">{l.label}<ExternalLink className="h-3 w-3" /></a>)}</p>}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {g.photos.map((p, i) => (
              <div key={p.id} className={cn('group relative overflow-hidden rounded-lg ring-2 ring-offset-1', p.isHighlight ? 'ring-brand' : 'ring-transparent')}>
                <button onClick={() => setLight(i)} className="block w-full" aria-label={`Preview ${p.title}`}><SmartImage src={p.url} alt={p.title} ratio="1/1" width={240} className="w-full" /></button>
                {mode === 'highlights' && <button aria-pressed={p.isHighlight} aria-label={p.isHighlight ? `Remove ${p.title} from highlights` : `Add ${p.title} to highlights`} onClick={() => toggle.mutate({ id: p.id, on: !p.isHighlight })} className={cn('absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full shadow', p.isHighlight ? 'bg-brand text-brand-contrast' : 'bg-white/90 text-ink-muted')}><Star className={cn('h-3.5 w-3.5', p.isHighlight && 'fill-current')} /></button>}
                {mode === 'complete' && p.isHighlight && <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-medium text-white">Highlight</span>}
              </div>))}
          </div>
          {light !== null && <Lightbox photos={g.photos.map((p) => ({ ...p, galleryTitle: g.title }))} index={light} onIndex={setLight} onClose={() => setLight(null)} />}
        </div>
      )}
    </Modal>
  );
}