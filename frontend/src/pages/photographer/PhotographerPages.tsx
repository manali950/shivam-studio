import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Calendar, CalendarCheck, CheckCircle2, Clock, MapPin, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { daysUntil, formatDate, formatMoney, pluralize, titleCase } from '@/lib/utils';
import type { StudioEvent } from '@/types';
import { Countdown } from '@/components/shared/Bits';
import { DeliveryTracker, DueBadge } from '@/components/shared/DeliveryTracker';
import { StatCard } from '@/components/shared/StatCard';
import { TLink } from '@/components/shared/TLink';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { btn } from '@/components/ui/Button';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import { useCatalogue } from '../client/clientData';
import { ProgressStages } from '../client/ClientBookingsEvents';
import { needsHighlights, nextAction, useMyBookings, useMyEvents } from './photographerData';
 
const todayStr = () => new Date().toISOString().slice(0, 10);
 
function EventRow({ e }: { e: StudioEvent }) {
  const a = nextAction(e);
  return (
    <li>
      <TLink to={`/photographer/events/${e.id}`} className="flex items-center gap-3 p-3 transition hover:bg-paper/70">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-ink text-center text-white"><span><span className="block text-base font-semibold leading-none">{new Date(e.date).getDate()}</span><span className="text-[10px] uppercase tracking-wide text-white/70">{new Date(e.date).toLocaleString('en', { month: 'short' })}</span></span></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{e.title}</span><span className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted"><MapPin className="h-3 w-3 shrink-0" />{e.venue}, {e.city} · {e.startTime}</span></span>
        <Badge tone={a.tone === 'neutral' ? 'neutral' : a.tone === 'warning' ? 'warning' : a.tone === 'success' ? 'success' : 'info'} className="hidden shrink-0 sm:inline-flex">{a.label}</Badge>
      </TLink>
    </li>
  );
}
 
export function PhotographerDashboard() {
  const { user } = useAuth(); const q = useMyEvents();
  const events = q.data?.items ?? [];
  const t = todayStr();
  const upcoming = events.filter((e) => e.status !== 'completed' && e.status !== 'cancelled' && e.date >= t).sort((a, b) => a.date.localeCompare(b.date));
  const todo = events.filter(needsHighlights);
  const inReview = events.filter((e) => e.delivery.highlightsSubmittedAt && !e.delivery.highlightsPublishedAt);
  const delivered = events.filter((e) => e.delivery.galleryPublishedAt);
  const next = upcoming[0];
  const firstName = user?.name.split(' ')[0];
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="space-y-4">
      <PageHeader title={`Hello, ${firstName}`} subtitle="Your shoots, delivery tasks and notes for the studio." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Upcoming shoots" value={q.isLoading ? '…' : upcoming.length} icon={<Calendar className="h-4 w-4" />} sub={next ? `Next: ${formatDate(next.date, { day: 'numeric', month: 'short' })}` : 'Nothing scheduled'} />
        <StatCard label="Highlights to submit" value={q.isLoading ? '…' : todo.length} icon={<AlertCircle className="h-4 w-4" />} tone={todo.length ? 'danger' : 'success'} sub={todo.length ? 'Clients are waiting' : 'All caught up'} />
        <StatCard label="In studio review" value={q.isLoading ? '…' : inReview.length} icon={<Clock className="h-4 w-4" />} tone="ink" />
        <StatCard label="Delivered" value={q.isLoading ? '…' : delivered.length} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" sub="Complete galleries" />
      </div>
 
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Delivery to-do" subtitle="Completed shoots waiting for your highlight selection" />
          {q.isLoading ? <div className="p-3"><Skeleton className="h-16" /></div> : todo.length === 0 ? <div className="p-4"><EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Nothing to submit" body="When you wrap a shoot it shows up here until highlights are submitted." /></div> : (
            <ul className="divide-y divide-line">{todo.map((e) => <li key={e.id} className="flex flex-wrap items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{e.title}</p><p className="text-xs text-ink-muted">Shot {formatDate(e.date)} · target {e.delivery.targetHours}h</p></div><DueBadge delivery={e.delivery} /><TLink to={`/photographer/events/${e.id}`} className={btn('primary', 'sm')}><Send className="h-3.5 w-3.5" />Submit highlights</TLink></li>)}</ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Next shoot" />
          {!next ? <div className="p-4"><EmptyState title="No upcoming shoots" /></div> : (
            <TLink to={`/photographer/events/${next.id}`} className="block space-y-2 p-4 hover:bg-paper/50">
              <Countdown date={next.date} />
              <p className="font-serif text-xl font-semibold leading-tight">{next.title}</p>
              <p className="text-xs text-ink-muted">{formatDate(next.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {next.startTime}</p>
              <p className="flex items-center gap-1 text-xs text-ink-2"><MapPin className="h-3.5 w-3.5 text-ink-faint" />{next.venue}, {next.city}</p>
            </TLink>
          )}
        </Card>
      </div>
 
      <Card>
        <CardHeader title="Upcoming schedule" action={<TLink to="/photographer/events" className="text-xs font-semibold text-brand-dark">All events</TLink>} />
        {q.isLoading ? <div className="p-3"><Skeleton className="h-24" /></div> : upcoming.length === 0 ? <div className="p-4"><EmptyState title="Your calendar is clear" /></div> : <ul className="divide-y divide-line">{upcoming.slice(0, 6).map((e) => <EventRow key={e.id} e={e} />)}</ul>}
      </Card>
    </div>
  );
}
 
export function PhotographerEvents() {
  const q = useMyEvents(); const [tab, setTab] = useState<'upcoming' | 'delivery' | 'past'>('upcoming');
  const events = useMemo(() => q.data?.items ?? [], [q.data]);
  const groups = useMemo(() => ({
    upcoming: events.filter((e) => e.status !== 'completed' && e.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date)),
    delivery: events.filter((e) => e.status === 'completed' && !e.delivery.galleryPublishedAt).sort((a, b) => b.date.localeCompare(a.date)),
    past: events.filter((e) => e.delivery.galleryPublishedAt || e.status === 'cancelled').sort((a, b) => b.date.localeCompare(a.date)),
  }), [events]);
  const rows = groups[tab];
  return (
    <div className="space-y-3">
      <PageHeader title="My events" subtitle="Events you are assigned to." />
      <Tabs variant="pill" value={tab} onChange={setTab} items={[{ key: 'upcoming', label: 'Upcoming', count: groups.upcoming.length }, { key: 'delivery', label: 'Delivery', count: groups.delivery.length }, { key: 'past', label: 'Delivered / closed', count: groups.past.length }]} />
      {q.isLoading ? <Skeleton className="h-40 rounded-xl" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState icon={<Calendar className="h-5 w-5" />} title={`No ${tab === 'delivery' ? 'events awaiting delivery' : tab + ' events'}`} /> : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((e) => { const a = nextAction(e); return (
            <TLink key={e.id} to={`/photographer/events/${e.id}`} className="card block space-y-3 p-4 transition hover:border-brand/50 hover:shadow-pop">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{e.title}</p><p className="mt-0.5 text-xs text-ink-muted">{formatDate(e.date)} · {e.startTime} · {e.venue}, {e.city}</p></div><StatusBadge status={e.status} /></div>
              <ProgressStages progress={e.progress} />
              <div className="flex items-center justify-between gap-2"><Badge tone={a.tone === 'neutral' ? 'neutral' : a.tone === 'warning' ? 'warning' : a.tone === 'success' ? 'success' : 'info'}>{a.label}</Badge>{e.status !== 'completed' ? <Countdown date={e.date} /> : <DueBadge delivery={e.delivery} />}</div>
              {e.status === 'completed' && <DeliveryTracker delivery={e.delivery} compact />}
            </TLink>); })}
        </div>
      )}
    </div>
  );
}
 
export function PhotographerBookings() {
  const { config } = useTenant(); const nav = useNavigate(); const { to } = useTenant();
  const q = useMyBookings(); const cat = useCatalogue();
  const cols: Column<NonNullable<typeof q.data>['items'][number]>[] = [
    { key: 'ref', header: 'Booking', primary: true, cell: (b) => <div><p className="font-medium">{cat.service(b.serviceId)}</p><p className="text-xs text-ink-muted">{b.reference} · {b.customer.name}</p></div> },
    { key: 'date', header: 'Date', cell: (b) => <span className="whitespace-nowrap">{formatDate(b.eventDate)} <span className="text-xs text-ink-muted">({daysUntil(b.eventDate) >= 0 ? `in ${pluralize(daysUntil(b.eventDate), 'day')}` : 'past'})</span></span> },
    { key: 'loc', header: 'Location', hideBelow: 'lg', cell: (b) => b.location },
    { key: 'contact', header: 'Client contact', hideBelow: 'xl', cell: (b) => <span className="text-xs">{b.customer.phone}</span> },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
    { key: 'pay', header: 'Fee', align: 'right', hideBelow: 'xl', cell: (b) => <span className="tabular-nums">{formatMoney(b.amount, config.settings.currency, config.settings.locale)}</span> },
  ];
  return (
    <div className="space-y-3">
      <PageHeader title="Bookings" subtitle="Bookings the studio has assigned to you." />
      <Card>
        {q.error ? <div className="p-4"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div> : (
          <DataTable columns={cols} rows={q.data?.items ?? []} rowKey={(b) => b.id} loading={q.isLoading} onRowClick={(b) => b.eventId && nav(to(`/photographer/events/${b.eventId}`))}
            empty={<EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="No bookings assigned yet" body="The studio will assign you to bookings from the admin dashboard." />}
            mobileCard={(b) => <div className="space-y-1"><div className="flex items-start justify-between gap-2"><p className="font-medium">{cat.service(b.serviceId)}</p><StatusBadge status={b.status} /></div><p className="text-xs text-ink-muted">{b.reference} · {b.customer.name}</p><p className="text-xs text-ink-2">{formatDate(b.eventDate)} · {b.location}</p><p className="text-xs text-ink-muted">{titleCase(b.source)} enquiry</p></div>} />
        )}
      </Card>
    </div>
  );
}