import { useState } from 'react';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { titleCase } from '@/lib/utils';
import type { Video } from '@/types';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { YouTubeEmbed } from '@/components/shared/YouTubeEmbed';
import { CardSkeletons, PageBanner, VideoCard } from './parts';
 
export default function VideosPage() {
  const q = useTenantQuery(['videos', 'public'], (t) => services.videos.list(t, { pageSize: 50, visibility: 'public', enabled: true } as any));
  const [cat, setCat] = useState('all');
  const [playing, setPlaying] = useState<Video | null>(null);
  const items = q.data?.items ?? [];
  const cats = [...new Set(items.map((v) => v.category))];
  const featured = items.find((v) => v.featured);
  const shown = items.filter((v) => cat === 'all' || v.category === cat);
  const LABEL: Record<string, string> = { wedding: 'Wedding highlights', 'pre-wedding': 'Pre-wedding films', event: 'Event highlights', showcase: 'Studio showcase' };
  return (
    <>
      <PageBanner eyebrow="Films" title="Stories in motion" subtitle="Wedding highlights, pre-wedding films and event recaps — streamed from our YouTube channel." />
      <section className="container-x py-12">
        {featured && cat === 'all' && (
          <div className="mb-12 grid items-center gap-8 lg:grid-cols-5">
            <div className="lg:col-span-3"><YouTubeEmbed videoId={featured.youtubeId} title={featured.title} thumbnail={featured.thumbnailUrl} /></div>
            <div className="lg:col-span-2"><p className="eyebrow">Featured film · {titleCase(featured.category)}</p><h2 className="h-section mt-2 sm:!text-4xl">{featured.title}</h2><p className="mt-3 text-ink-muted">{featured.description}</p></div>
          </div>
        )}
        <Tabs variant="pill" value={cat} onChange={setCat} className="mb-8" items={[{ key: 'all', label: 'All films', count: items.length }, ...cats.map((c) => ({ key: c, label: LABEL[c] ?? titleCase(c) }))]} />
        {q.isLoading ? <CardSkeletons n={3} h="h-56" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : shown.length === 0 ? <EmptyState title="No films in this category yet" /> : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{shown.map((v) => <VideoCard key={v.id} v={v} onPlay={setPlaying} />)}</div>
        )}
      </section>
      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title} subtitle={playing && titleCase(playing.category)} size="lg">
        {playing && (<><YouTubeEmbed videoId={playing.youtubeId} title={playing.title} thumbnail={playing.thumbnailUrl} autoPlay /><p className="mt-3 text-sm text-ink-muted">{playing.description}</p></>)}
      </Modal>
    </>
  );
}