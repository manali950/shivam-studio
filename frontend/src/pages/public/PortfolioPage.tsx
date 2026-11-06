import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { services } from '@/services/data-provider';
import { titleCase } from '@/lib/utils';
import type { PortfolioPhoto, ServiceCategory } from '@/types';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import { SmartImage } from '@/components/ui/SmartImage';
import { Lightbox } from '@/components/shared/Lightbox';
import { PageBanner } from './parts';
 
const PAGE = 12;
export default function PortfolioPage() {
  const { tenant } = useTenant();
  const [cat, setCat] = useState<string>('all');
  const [light, setLight] = useState<number | null>(null);
  const all = useInfiniteQuery({ queryKey: ['portfolio-cats', tenant.id], queryFn: () => services.galleries.portfolio(tenant.id, { pageSize: 200 }), initialPageParam: 1, getNextPageParam: () => undefined });
  const q = useInfiniteQuery({
    queryKey: ['portfolio', tenant.id, cat], initialPageParam: 1,
    queryFn: ({ pageParam }) => services.galleries.portfolio(tenant.id, { page: pageParam, pageSize: PAGE, category: cat === 'all' ? undefined : cat }),
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  });
  const photos: PortfolioPhoto[] = q.data?.pages.flatMap((p) => p.items) ?? [];
  const cats = useMemo(() => [...new Set((all.data?.pages[0]?.items ?? []).map((p) => p.category))] as ServiceCategory[], [all.data]);
  const total = q.data?.pages[0]?.total ?? 0;
  return (
    <>
      <PageBanner eyebrow="Portfolio" title="A closer look at our work" subtitle="Tap any photograph for a full-screen preview with details." />
      <section className="container-x py-10">
        <Tabs variant="pill" value={cat} onChange={setCat} className="mb-8" items={[{ key: 'all', label: 'All' }, ...cats.map((c) => ({ key: c, label: titleCase(c) }))]} />
        {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? (
          <div className="columns-2 gap-3 md:columns-3 lg:columns-4 [&>*]:mb-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton w-full rounded-xl" style={{ height: 180 + (i % 3) * 80 }} />)}</div>
        ) : photos.length === 0 ? <EmptyState title="No photographs published in this category yet" /> : (
          <>
            <div className="columns-2 gap-3 md:columns-3 lg:columns-4 [&>*]:mb-3">
              {photos.map((p, i) => (
                <button key={p.id} onClick={() => setLight(i)} aria-label={`Preview ${p.title}`} className="group relative block w-full break-inside-avoid overflow-hidden rounded-xl">
                  <SmartImage src={p.url} alt={p.title} ratio={`${p.width}/${p.height}`} width={600} sizes="(min-width:1024px) 25vw, 50vw" className="w-full" imgClassName="transition duration-700 group-hover:scale-105" />
                  <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/65 via-transparent to-transparent p-3 opacity-0 transition group-hover:opacity-100"><span className="text-left text-sm text-white">{p.title}<span className="block text-[11px] text-white/70">{p.galleryTitle}</span></span></span>
                  {p.featured && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-contrast">Featured</span>}
                </button>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="mb-3 text-xs text-ink-muted">Showing {photos.length} of {total}</p>
              {q.hasNextPage && <Button variant="outline" size="lg" onClick={() => q.fetchNextPage()} loading={q.isFetchingNextPage} icon={q.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}>Load more photographs</Button>}
            </div>
          </>
        )}
      </section>
      {light !== null && <Lightbox photos={photos} index={light} onIndex={setLight} onClose={() => setLight(null)} />}
    </>
  );
}