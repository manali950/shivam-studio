import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { formatDate, titleCase } from '@/lib/utils';
import { TLink } from '@/components/shared/TLink';
import { btn } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { SmartImage } from '@/components/ui/SmartImage';
import { Tabs } from '@/components/ui/Tabs';
import { Lightbox } from '@/components/shared/Lightbox';
import { YouTubeEmbed } from '@/components/shared/YouTubeEmbed';
import { BlogCard, CardSkeletons, EventCard, PageBanner, SectionHeader } from './parts';
 
export function EventsPage() {
  const q = useTenantQuery(['events', 'public'], (t) => services.events.list(t, { pageSize: 50, isPublic: true, status: 'completed' } as any));
  const [type, setType] = useState('all');
  const items = q.data?.items ?? [];
  const types = [...new Set(items.map((e) => e.type))];
  const shown = items.filter((e) => type === 'all' || e.type === type);
  return (
    <>
      <PageBanner eyebrow="Events" title="Recent celebrations" subtitle="Published galleries from events our clients have shared with the world." />
      <section className="container-x py-12">
        <Tabs variant="pill" value={type} onChange={setType} className="mb-8" items={[{ key: 'all', label: 'All events' }, ...types.map((t) => ({ key: t, label: titleCase(t) }))]} />
        {q.isLoading ? <CardSkeletons n={3} h="h-72" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : shown.length === 0 ? <EmptyState title="No public events yet" body="Studios publish events once the client agrees to share them." /> : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{shown.map((e) => <EventCard key={e.id} e={e} />)}</div>
        )}
      </section>
    </>
  );
}
 
export function EventDetailPage() {
  const { id } = useParams();
  const { tenant } = useTenant();
  const ev = useTenantQuery(['events', 'public-detail', id], (t) => services.events.get(t, id!));
  const gal = useTenantQuery(['galleries', 'by-event', id], async (t) => {
    const list = await services.galleries.listByEvent(t, id!);
    const g = list.find((x) => x.visibility === 'public') ?? list[0];
    return g ? services.galleries.get(t, g.id) : null;
  });
  const vids = useTenantQuery(['videos', 'by-event', id], (t) => services.videos.list(t, { eventId: id, visibility: 'public', enabled: true, pageSize: 4 } as any));
  const [light, setLight] = useState<number | null>(null);
  const e = ev.data; const photos = gal.data?.photos ?? [];
  if (ev.error) return <><PageBanner title="Event not found" /><div className="container-x py-12"><ErrorState error={ev.error} /></div></>;
  if (!e) return <PageBanner title="Loading…" />;
  void tenant;
  return (
    <>
      <PageBanner eyebrow={titleCase(e.type)} title={e.title} image={e.coverUrl}>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80"><span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" />{formatDate(e.date)}</span><span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{e.startTime}</span><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{e.venue}, {e.city}</span></p>
      </PageBanner>
      <section className="container-x py-12">
        <p className="max-w-3xl font-serif text-2xl leading-snug">{e.description}</p>
        {vids.data?.items[0] && <div className="mt-10 max-w-3xl"><YouTubeEmbed videoId={vids.data.items[0].youtubeId} title={vids.data.items[0].title} thumbnail={vids.data.items[0].thumbnailUrl} /></div>}
        <SectionHeader eyebrow="Gallery" title={gal.data?.title ?? 'Photographs'} className="mt-14" subtitle={gal.data?.description} />
        {gal.isLoading ? <CardSkeletons n={3} h="h-72" /> : photos.length === 0 ? <EmptyState title="Photographs are not published yet" /> : (
          <div className="columns-2 gap-3 md:columns-3 [&>*]:mb-3">
            {photos.map((p, i) => <button key={p.id} onClick={() => setLight(i)} aria-label={`Preview ${p.title}`} className="group block w-full break-inside-avoid overflow-hidden rounded-xl"><SmartImage src={p.url} alt={p.title} ratio={`${p.width}/${p.height}`} width={600} className="w-full" imgClassName="transition duration-700 group-hover:scale-105" /></button>)}
          </div>
        )}
        <div className="mt-12 flex flex-wrap items-center gap-3 rounded-2xl bg-paper-2 p-6"><p className="font-serif text-xl">Planning something similar?</p><TLink to="/booking" className={btn('primary', 'md', 'ml-auto')}>Enquire now</TLink></div>
      </section>
      {light !== null && <Lightbox photos={photos.map((p) => ({ ...p, galleryTitle: e.title }))} index={light} onIndex={setLight} onClose={() => setLight(null)} />}
    </>
  );
}
 
export function BlogPage() {
  const q = useTenantQuery(['blog', 'public'], (t) => services.blog.list(t, { pageSize: 30, status: 'published' } as any));
  const [kind, setKind] = useState('all');
  const shown = (q.data?.items ?? []).filter((b) => kind === 'all' || b.category === kind);
  return (
    <>
      <PageBanner eyebrow="Journal" title="Photography tips & stories" subtitle="Advice for looking your best on camera and behind-the-scenes stories from real shoots." />
      <section className="container-x py-12">
        <Tabs variant="pill" value={kind} onChange={setKind} className="mb-8" items={[{ key: 'all', label: 'All' }, { key: 'tips', label: 'Photography tips' }, { key: 'stories', label: 'Stories' }]} />
        {q.isLoading ? <CardSkeletons n={3} h="h-72" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : shown.length === 0 ? <EmptyState title="No articles yet" /> : <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">{shown.map((b) => <BlogCard key={b.id} b={b} />)}</div>}
      </section>
    </>
  );
}
 
export function BlogPostPage() {
  const { slug } = useParams();
  const q = useTenantQuery(['blog', 'slug', slug], (t) => services.blog.getBySlug(t, slug!));
  const b = q.data;
  if (q.error) return <><PageBanner title="Article not found" /><div className="container-x py-12"><ErrorState error={q.error} /></div></>;
  if (!b) return <PageBanner title="Loading…" />;
  return (
    <>
      <PageBanner eyebrow={`${b.category === 'tips' ? 'Photography tips' : 'Stories'} · ${b.readMinutes} min read`} title={b.title} subtitle={`${b.authorName} · ${formatDate(b.publishedAt)}`} image={b.coverUrl} />
      <article className="container-x max-w-3xl py-12">
        <p className="font-serif text-2xl leading-snug text-ink">{b.excerpt}</p>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink-2">{b.body.split('\n\n').map((para, i) => <p key={i}>{para}</p>)}</div>
        <TLink to="/blog" className={btn('outline', 'md', 'mt-10')}>← Back to journal</TLink>
      </article>
    </>
  );
}