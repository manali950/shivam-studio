import { Banknote, CalendarCheck, Camera, Store, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { services } from '@/services/data-provider';
import { formatDate, formatMoney } from '@/lib/utils';
import { AreaChart, BarList, Donut, SERIES } from '@/components/charts/Charts';
import { StatCard } from '@/components/shared/StatCard';
import { btn } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { usePlans, usePlatformStats } from './platformData';
 
export default function PlatformOverview() {
  const q = usePlatformStats(); const plans = usePlans(); const d = q.data;
  const recent = useQuery({ queryKey: ['platform-tenants', 'recent'], queryFn: () => services.tenants.list({ pageSize: 6, sort: 'createdAt', order: 'desc' }) });
  const money = (n: number) => formatMoney(n, 'INR', 'en-IN');
  const planName = (id: string) => plans.data?.find((p) => p.id === id)?.name ?? '—';
  const v = (x: React.ReactNode) => (q.isLoading ? '…' : x);
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="space-y-4">
      <PageHeader title="Platform overview" subtitle="Every studio on shivamStudio at a glance." actions={<Link to="/platform/studios?new=1" className={btn('primary', 'md')}><Store className="h-4 w-4" />New studio</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
        <StatCard label="Studios" value={v(d?.totalTenants)} icon={<Store className="h-4 w-4" />} sub={`${d?.activeTenants ?? '–'} active · ${d?.trialTenants ?? '–'} trial · ${d?.inactiveTenants ?? '–'} inactive`} />
        <StatCard label="Monthly recurring revenue" value={v(money(d?.monthlyRecurringRevenue ?? 0))} icon={<Banknote className="h-4 w-4" />} tone="success" sub="Active subscriptions" />
        <StatCard label="Customers" value={v(d?.totalCustomers)} icon={<Users className="h-4 w-4" />} tone="ink" sub="Across all studios" />
        <StatCard label="Bookings" value={v(d?.totalBookings)} icon={<CalendarCheck className="h-4 w-4" />} sub="All time" />
        <StatCard label="Photographers" value={v(d?.totalPhotographers)} icon={<Camera className="h-4 w-4" />} tone="ink" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2"><CardHeader title="New studios" subtitle="Sign-ups per month" /><div className="p-4 pt-2">{q.isLoading ? <Skeleton className="h-48" /> : <AreaChart data={d!.signups.map((s) => ({ label: s.month, value: s.tenants }))} format={(n) => `${n} studio${n === 1 ? '' : 's'}`} color="#6d4aff" />}</div></Card>
        <Card><CardHeader title="Studios by plan" /><div className="p-4">{q.isLoading ? <Skeleton className="h-28" /> : <Donut centerValue={d!.totalTenants} centerLabel="studios" segments={d!.tenantsByPlan.filter((p) => p.count).map((p, i) => ({ label: p.planName, value: p.count, color: SERIES[i % SERIES.length] }))} />}</div></Card>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card><CardHeader title="Most active studios" subtitle="Bookings to date" /><div className="p-4">{q.isLoading ? <Skeleton className="h-28" /> : <BarList items={[...d!.bookingsByTenant].sort((a, b) => b.bookings - a.bookings).map((t) => ({ label: t.tenantName, value: t.bookings, hint: `${t.customers} customers` }))} />}</div></Card>
        <Card><CardHeader title="Newest studios" action={<Link to="/platform/studios" className="text-xs font-semibold text-violet-700">Manage</Link>} />
          {recent.isLoading ? <div className="p-3"><Skeleton className="h-28" /></div> : <ul className="divide-y divide-line">{recent.data?.items.map((t) => <li key={t.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.name}</p><p className="truncate text-xs text-ink-muted">{planName(t.planId)} · {t.city} · since {formatDate(t.createdAt)}</p></div><StatusBadge status={t.status} /></li>)}</ul>}</Card>
      </div>
    </div>
  );
}