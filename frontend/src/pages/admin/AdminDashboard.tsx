import { Banknote, Bell, Calendar, CalendarCheck, CalendarPlus, Camera, Clock, FolderOpen, Send, Users, Video, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useTenantQuery } from '@/hooks/data';
import { useStudioStats } from '@/hooks/admin';
import { services } from '@/services/data-provider';
import { formatDate, pluralize, timeAgo, titleCase } from '@/lib/utils';
import { AreaChart, BarList, Donut } from '@/components/charts/Charts';
import { StatCard } from '@/components/shared/StatCard';
import { TLink } from '@/components/shared/TLink';
import { Countdown } from '@/components/shared/Bits';
import { btn } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { BOOKING_STATUS_COLOR } from './adminUi';
 
const QUICK = [
  { label: 'New booking', to: '/admin/bookings?new=1', icon: CalendarCheck }, { label: 'Add event', to: '/admin/events?new=1', icon: CalendarPlus },
  { label: 'Create gallery', to: '/admin/galleries?new=1', icon: FolderOpen }, { label: 'Add video', to: '/admin/videos?new=1', icon: Video },
  { label: 'Photo delivery', to: '/admin/delivery', icon: Send }, { label: 'Photographers', to: '/admin/photographers', icon: Camera },
];
 
export default function AdminDashboard() {
  const { user } = useAuth(); const { tenant, money } = useTenant();
  const s = useStudioStats();
  const enq = useTenantQuery(['bookings', 'recent-enquiries'], (t) => services.bookings.list(t, { pageSize: 30, sort: 'createdAt', order: 'desc' }));
  const upcoming = useTenantQuery(['events', 'upcoming-5'], (t) => services.events.list(t, { upcoming: true, pageSize: 5, sort: 'date', order: 'asc' }));
  const activity = useTenantQuery(['notifications', 'activity', user!.id], (t) => services.notifications.list(t, user!.id, { pageSize: 6 }));
  const pending = (enq.data?.items ?? []).filter((b) => b.status === 'enquiry' || b.status === 'pending').slice(0, 5);
  const d = s.data; const t = d?.totals;
  if (s.error) return <ErrorState error={s.error} onRetry={() => s.refetch()} />;
  const kpi = (v: React.ReactNode) => (s.isLoading ? '…' : v);
  return (
    <div className="space-y-4">
      <PageHeader title={`Welcome back, ${user?.name.split(' ')[0]}`} subtitle={`${tenant.name} · ${formatDate(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={<TLink to="/admin/bookings?new=1" className={btn('primary', 'md')}><CalendarCheck className="h-4 w-4" />New booking</TLink>} />
 
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Revenue collected" value={kpi(money(t?.revenue ?? 0))} icon={<Banknote className="h-4 w-4" />} trend={d?.revenueByMonth.map((m) => m.revenue)} />
        <StatCard label="Outstanding" value={kpi(money(t?.outstanding ?? 0))} icon={<Wallet className="h-4 w-4" />} tone="ink" sub="On confirmed bookings" />
        <StatCard label="Pending enquiries" value={kpi(t?.pendingEnquiries)} icon={<Bell className="h-4 w-4" />} tone={t?.pendingEnquiries ? 'danger' : 'success'} sub="Needs a decision" />
        <StatCard label="Upcoming events" value={kpi(t?.upcomingEvents)} icon={<Calendar className="h-4 w-4" />} sub={`${t?.photographers ?? '–'} active photographers`} />
        <StatCard label="Pending deliveries" value={kpi(t?.pendingDeliveries)} icon={<Send className="h-4 w-4" />} tone={t?.pendingDeliveries ? 'danger' : 'success'} sub="Completed, not fully delivered" />
        <StatCard label="Customers" value={kpi(t?.clients)} icon={<Users className="h-4 w-4" />} sub={`${t?.bookings ?? '–'} bookings in total`} />
      </div>
 
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Revenue collected" subtitle="Payments received on bookings created each month" />
          <div className="p-4 pt-2">{s.isLoading ? <Skeleton className="h-48" /> : <AreaChart data={d!.revenueByMonth.map((m) => ({ label: m.month, value: m.revenue, sub: m.bookings }))} format={(n) => money(n)} secondaryLabel="bookings" />}</div>
        </Card>
        <Card>
          <CardHeader title="Bookings by status" />
          {s.isLoading ? <div className="p-4"><Skeleton className="h-32" /></div> : (
            <div className="flex flex-wrap items-center gap-4 p-4">
              <Donut centerValue={t?.bookings} centerLabel="bookings" segments={d!.bookingsByStatus.filter((x) => x.count).map((x) => ({ label: titleCase(x.status), value: x.count, color: BOOKING_STATUS_COLOR[x.status] }))} />
            </div>
          )}
        </Card>
      </div>
 
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Enquiries needing action" subtitle="Newest first" action={<TLink to="/admin/bookings" className="text-xs font-semibold text-brand-dark">All bookings</TLink>} />
          {enq.isLoading ? <div className="p-3"><Skeleton className="h-28" /></div> : pending.length === 0 ? <div className="p-4"><EmptyState icon={<Clock className="h-5 w-5" />} title="Inbox zero" body="New website enquiries will appear here." /></div> : (
            <ul className="divide-y divide-line">{pending.map((b) => (
              <li key={b.id}><TLink to={`/admin/bookings?open=${b.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 hover:bg-paper/70">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{b.customer.name}</p><p className="truncate text-xs text-ink-muted">{b.reference} · {formatDate(b.eventDate)} · {b.location}</p></div>
                <StatusBadge status={b.status} /><span className="text-[11px] text-ink-faint">{timeAgo(b.createdAt)}</span><span className={btn('soft', 'xs')}>Review</span>
              </TLink></li>))}</ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Photo delivery funnel" subtitle="Completed events by stage" action={<TLink to="/admin/delivery" className="text-xs font-semibold text-brand-dark">Open</TLink>} />
          <div className="p-4">{s.isLoading ? <Skeleton className="h-28" /> : <BarList items={d!.deliveryFunnel.map((f) => ({ label: f.label, value: f.count }))} max={Math.max(1, d!.deliveryFunnel[0]?.count)} />}</div>
        </Card>
      </div>
 
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader title="Upcoming events" action={<TLink to="/admin/events" className="text-xs font-semibold text-brand-dark">All events</TLink>} />
          {upcoming.isLoading ? <div className="p-3"><Skeleton className="h-28" /></div> : upcoming.data?.items.length === 0 ? <div className="p-4"><EmptyState title="No upcoming events" /></div> : (
            <ul className="divide-y divide-line">{upcoming.data?.items.map((e) => <li key={e.id} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.title}</p><p className="truncate text-xs text-ink-muted">{formatDate(e.date)} · {e.city}</p></div><Countdown date={e.date} /></li>)}</ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Photographer workload" subtitle="Upcoming assignments" />
          <div className="p-4">{s.isLoading ? <Skeleton className="h-28" /> : <BarList items={[...d!.photographerLoad].sort((a, b) => b.upcoming - a.upcoming).map((p) => ({ label: p.name, value: p.upcoming, hint: `${p.completed} done` }))} format={(n) => pluralize(n, 'event')} />}</div>
        </Card>
        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader title="Top services" subtitle="By number of live bookings" />
          <div className="p-4">{s.isLoading ? <Skeleton className="h-28" /> : <BarList items={d!.bookingsByService.slice(0, 6).map((x) => ({ label: x.name, value: x.count, hint: money(x.revenue) }))} />}</div>
        </Card>
      </div>
 
      <Card>
        <CardHeader title="Recent activity" action={<TLink to="/admin/bookings" className="text-xs font-semibold text-brand-dark">Bookings</TLink>} />
        {activity.isLoading ? <div className="p-3"><Skeleton className="h-20" /></div> : activity.data?.items.length === 0 ? <div className="p-4"><EmptyState title="No activity yet" /></div> : (
          <ul className="grid divide-y divide-line md:grid-cols-2 md:divide-y-0">{activity.data?.items.map((n) => <li key={n.id}><TLink to={n.link} className="flex gap-3 p-3 hover:bg-paper/70"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark"><Bell className="h-3.5 w-3.5" /></span><span className="min-w-0"><span className="block truncate text-[13px] font-medium">{n.title}</span><span className="line-clamp-1 text-xs text-ink-muted">{n.body}</span><span className="text-[10px] text-ink-faint">{timeAgo(n.createdAt)}</span></span></TLink></li>)}</ul>
        )}
      </Card>
 
      <div className="flex flex-wrap gap-2">{QUICK.map((a) => <TLink key={a.label} to={a.to} className={btn('outline', 'sm')}><a.icon className="h-4 w-4" />{a.label}</TLink>)}</div>
    </div>
  );
}