import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ExternalLink, Images, Lock, Sparkles } from 'lucide-react';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { formatDateTime, pluralize } from '@/lib/utils';
import { DriveButton, deliveryMessage } from '@/components/shared/Bits';
import { DeliveryTracker, DueBadge } from '@/components/shared/DeliveryTracker';
import { Lightbox } from '@/components/shared/Lightbox';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { SmartImage } from '@/components/ui/SmartImage';
import { Tabs } from '@/components/ui/Tabs';
import { useClientDrive, useClientEvents, useClientGalleries } from './clientData';
 
export default function ClientPhotos() {
  const [sp, setSp] = useSearchParams();
  const gq = useClientGalleries(); const eq = useClientEvents(); const dq = useClientDrive();
  const galleries = gq.data?.items ?? [];
  const selId = sp.get('gallery') ?? galleries.find((g) => g.eventId === sp.get('event'))?.id ?? galleries[0]?.id;
  const sel = galleries.find((g) => g.id === selId);
  const full = useTenantQuery(['galleries', 'detail', selId], (t) => services.galleries.get(t, selId!), { enabled: !!selId });
  const event = eq.data?.items.find((e) => e.id === sel?.eventId);
  const [tab, setTab] = useState<'highlights' | 'complete'>('highlights');
  const [light, setLight] = useState<number | null>(null);
  useEffect(() => { setTab(sel?.completePublishedAt ? 'complete' : 'highlights'); }, [sel?.id, sel?.completePublishedAt]);
 
  const photos = full.data?.photos ?? [];
  const shown = tab === 'highlights' ? photos.filter((p) => p.isHighlight) : photos;
  const drives = dq.data?.items.filter((d) => d.eventId === sel?.eventId) ?? [];
 
  return (
    <div className="space-y-4">
      <div><h1 className="font-serif text-3xl font-semibold">My photos</h1><p className="text-sm text-ink-muted">Next-day highlights first, then your complete gallery.</p></div>
      {gq.isLoading ? <Skeleton className="h-40 rounded-xl" /> : gq.error ? <ErrorState error={gq.error} onRetry={() => gq.refetch()} /> : galleries.length === 0 ? <EmptyState icon={<Images className="h-5 w-5" />} title="No galleries yet" body="Your galleries appear here after your event." /> : (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {galleries.map((g) => (
              <button key={g.id} onClick={() => setSp({ gallery: g.id })} aria-pressed={g.id === selId} className={`flex w-60 shrink-0 gap-3 rounded-xl border p-2 text-left transition ${g.id === selId ? 'border-brand bg-brand-soft/50 shadow-card' : 'border-line bg-white hover:border-brand/50'}`}>
                <SmartImage src={g.previewUrls[0] ?? g.coverUrl} alt="" width={160} className="h-14 w-14 shrink-0 rounded-lg" />
                <span className="min-w-0"><span className="line-clamp-2 text-[13px] font-medium leading-snug">{g.title}</span><span className="mt-0.5 block text-[11px] text-ink-muted">{g.completePublishedAt ? 'Complete' : g.highlightsPublishedAt ? 'Highlights live' : 'Awaiting delivery'}</span></span>
              </button>
            ))}
          </div>
 
          {sel && event && (
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{sel.title}</h2><p className="text-xs text-ink-muted">{deliveryMessage(event).body}</p></div><DueBadge delivery={event.delivery} /></div>
              <DeliveryTracker delivery={event.delivery} className="mt-4" />
              {event.delivery.notes && <p className="mt-3 rounded-lg bg-paper-2 p-2.5 text-xs text-ink-2"><b>Studio note:</b> {event.delivery.notes}</p>}
              {(drives.length > 0 || sel.externalLinks.length > 0) && (
                <div className="mt-4 flex flex-wrap items-start gap-3 border-t border-line pt-4">
                  {drives.map((d) => <div key={d.id}><DriveButton url={d.url} title={d.title} />{d.description && <p className="mt-1 max-w-xs text-xs text-ink-muted">{d.description}</p>}</div>)}
                  {sel.externalLinks.map((l) => <a key={l.id} href={l.url} target="_blank" rel="noreferrer noopener" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-paper-2"><ExternalLink className="h-4 w-4" />{l.label}</a>)}
                </div>
              )}
            </Card>
          )}
 
          <Tabs value={tab} onChange={setTab} items={[{ key: 'highlights', label: <span className="inline-flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Next-day highlights</span>, count: sel?.highlightsPublishedAt ? photos.filter((p) => p.isHighlight).length : 0 }, { key: 'complete', label: <span className="inline-flex items-center gap-1.5">{!sel?.completePublishedAt && <Lock className="h-3 w-3" />}Complete gallery</span>, count: sel?.completePublishedAt ? photos.length : 0 }]} />
          {full.isLoading ? <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3]" />)}</div>
            : tab === 'complete' && !sel?.completePublishedAt ? <EmptyState icon={<Lock className="h-5 w-5" />} title="Complete gallery not published yet" body="Your studio is finishing retouching. You will get a notification as soon as every photograph is ready." />
            : tab === 'highlights' && !sel?.highlightsPublishedAt && !sel?.completePublishedAt ? <EmptyState icon={<Sparkles className="h-5 w-5" />} title="Highlights not published yet" body={event ? deliveryMessage(event).body : 'We will notify you as soon as they are ready.'} />
            : shown.length === 0 ? <EmptyState title="No photographs to show" /> : (
              <>
                <div className="flex items-center justify-between"><p className="text-xs text-ink-muted">{pluralize(shown.length, 'photograph')}{sel?.highlightsPublishedAt && tab === 'highlights' ? ` · published ${formatDateTime(sel.highlightsPublishedAt)}` : ''}</p>{tab === 'complete' && <Badge tone="success">Download enabled</Badge>}</div>
                <div className="columns-2 gap-2 md:columns-3 lg:columns-4 [&>*]:mb-2">
                  {shown.map((p, i) => (
                    <div key={p.id} className="group relative break-inside-avoid overflow-hidden rounded-lg">
                      <button onClick={() => setLight(i)} aria-label={`Preview ${p.title}`} className="block w-full"><SmartImage src={p.url} alt={p.title} ratio={`${p.width}/${p.height}`} width={520} className="w-full" imgClassName="transition duration-500 group-hover:scale-105" /></button>
                      <a href={p.url} target="_blank" rel="noreferrer noopener" download aria-label={`Download ${p.title}`} className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink opacity-0 shadow transition hover:bg-white group-hover:opacity-100 focus:opacity-100"><Download className="h-4 w-4" /></a>
                    </div>
                  ))}
                </div>
              </>
            )}
        </>
      )}
      {light !== null && <Lightbox photos={shown.map((p) => ({ ...p, galleryTitle: sel?.title }))} index={light} onIndex={setLight} onClose={() => setLight(null)} allowDownload />}
    </div>
  );
}