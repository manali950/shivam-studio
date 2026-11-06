import { useMemo, useState } from 'react';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import { CardSkeletons, PackageCard, PageBanner, ServiceCard } from './parts';
 
export function ServicesPage() {
  const s = useTenantQuery(['services', 'public'], (t) => services.services.list(t, { pageSize: 30, status: 'active', sort: 'sortOrder' } as any));
  const p = useTenantQuery(['packages', 'public'], (t) => services.packages.list(t, { pageSize: 50, status: 'active' } as any));
  return (
    <>
      <PageBanner eyebrow="Services" title="Photography for every occasion" subtitle="From palace weddings to product catalogues — pick a service and we'll tailor a package." />
      <section className="container-x py-14">
        {s.isLoading ? <CardSkeletons n={6} h="h-96" /> : s.error ? <ErrorState error={s.error} onRetry={() => s.refetch()} /> : !s.data?.items.length ? <EmptyState title="Services coming soon" /> : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{s.data.items.map((x) => <ServiceCard key={x.id} s={x} count={p.data?.items.filter((k) => k.serviceId === x.id).length} />)}</div>
        )}
      </section>
    </>
  );
}
 
export function PackagesPage() {
  const s = useTenantQuery(['services', 'public'], (t) => services.services.list(t, { pageSize: 30, status: 'active', sort: 'sortOrder' } as any));
  const p = useTenantQuery(['packages', 'public'], (t) => services.packages.list(t, { pageSize: 50, status: 'active', sort: 'sortOrder' } as any));
  const [svc, setSvc] = useState('all');
  const names = useMemo(() => new Map((s.data?.items ?? []).map((x) => [x.id, x.name])), [s.data]);
  const withPackages = (s.data?.items ?? []).filter((x) => p.data?.items.some((k) => k.serviceId === x.id));
  const shown = (p.data?.items ?? []).filter((k) => svc === 'all' || k.serviceId === svc);
  return (
    <>
      <PageBanner eyebrow="Packages" title="Choose your coverage" subtitle="Every package includes next-day highlights and a private online gallery." />
      <section className="container-x py-12">
        <Tabs variant="pill" value={svc} onChange={setSvc} className="mb-10" items={[{ key: 'all', label: 'All packages' }, ...withPackages.map((x) => ({ key: x.id, label: x.name }))]} />
        {p.isLoading ? <CardSkeletons n={3} h="h-[28rem]" /> : p.error ? <ErrorState error={p.error} onRetry={() => p.refetch()} /> : shown.length === 0 ? <EmptyState title="No packages in this category yet" /> : (
          <div className="grid gap-6 pt-3 md:grid-cols-2 xl:grid-cols-3">{shown.map((k) => <PackageCard key={k.id} p={k} serviceName={names.get(k.serviceId)} />)}</div>
        )}
      </section>
    </>
  );
}