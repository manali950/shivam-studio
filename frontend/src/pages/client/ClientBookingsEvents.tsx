import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronDown, MapPin, Users } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { cn, daysUntil, formatDate, formatMoney } from '@/lib/utils';
import type { PhotographyProgress } from '@/types';
import { Countdown, Kv, PaymentBar, PhotographerStack, deliveryMessage } from '@/components/shared/Bits';
import { DeliveryTracker, DueBadge } from '@/components/shared/DeliveryTracker';
import { TLink } from '@/components/shared/TLink';
import { btn } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import { useAllPhotographers, useCatalogue, useClientBookings, useClientEvents } from './clientData';
 
export function ClientBookings() {
  const { config } = useTenant();
  const q = useClientBookings(); const ph = useAllPhotographers(); const cat = useCatalogue();
  const [tab, setTab] = useState<'all' | 'upcoming' | 'completed' | 'closed'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const rows = (q.data?.items ?? []).filter((b) => tab === 'all' || (tab === 'upcoming' ? ['enquiry', 'pending', 'confirmed'].includes(b.status) : tab === 'completed' ? b.status === 'completed' : ['cancelled', 'rejected'].includes(b.status)));
  const money = (n: number) => formatMoney(n, config.settings.currency, config.settings.locale);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="font-serif text-3xl font-semibold">My bookings</h1><p className="text-sm text-ink-muted">Status, payments and details for every booking.</p></div><TLink to="/booking" className={btn('dark', 'md')}>New booking</TLink></div>
      <Tabs variant="pill" value={tab} onChange={setTab} items={[{ key: 'all', label: 'All', count: q.data?.total }, { key: 'upcoming', label: 'Upcoming' }, { key: 'completed', label: 'Completed' }, { key: 'closed', label: 'Cancelled' }]} />
      {q.isLoading ? <div className="space-y-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No bookings here" /> : (
        <ul className="space-y-3">
          {rows.map((b) => (
            <li key={b.id}><Card>
              <button className="grid w-full gap-3 p-4 text-left sm:grid-cols-[1fr_auto_auto] sm:items-center" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{cat.service(b.serviceId)}</span><StatusBadge status={b.status} /></div>
                  <p className="mt-0.5 text-xs text-ink-muted">{b.reference} · {cat.pkg(b.packageId)}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2"><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-ink-faint" />{formatDate(b.eventDate)}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-ink-faint" />{b.location}</span>{daysUntil(b.eventDate) >= 0 && b.status !== 'cancelled' && <Countdown date={b.eventDate} />}</p></div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end"><StatusBadge status={b.paymentStatus} /><span className="text-sm font-semibold tabular-nums">{money(b.amount)}</span></div>
                <ChevronDown className={cn('hidden h-4 w-4 text-ink-faint transition sm:block', open === b.id && 'rotate-180')} />
              </button>
              {open === b.id && (
                <div className="grid animate-fade-in gap-4 border-t border-line bg-paper/50 p-4 sm:grid-cols-3">
                  <Kv k="Payment"><PaymentBar amount={b.amount} paid={b.paidAmount} currency={config.settings.currency} locale={config.settings.locale} /></Kv>
                  <Kv k="Your team"><PhotographerStack ids={b.assignedPhotographerIds} all={ph.data?.items ?? []} size={28} />{b.assignedPhotographerIds.length > 0 && <span className="mt-1 block text-xs text-ink-muted">{b.assignedPhotographerIds.map((i) => ph.data?.items.find((p) => p.id === i)?.name).filter(Boolean).join(', ')}</span>}</Kv>
                  <Kv k="Guests"><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-ink-faint" />{b.guestCount ?? '—'}</span></Kv>
                  <div className="sm:col-span-3"><Kv k="Your requirements">{b.requirements || <span className="text-ink-faint">None provided</span>}</Kv></div>
                  {b.eventId && <Link to="../events" className="text-sm font-semibold text-brand-dark">View event details →</Link>}
                </div>
              )}
            </Card></li>
          ))}
        </ul>
      )}
    </div>
  );
}
  
const STAGES: { key: PhotographyProgress; label: string }[] = [{ key: 'planned', label: 'Planned' }, { key: 'shooting', label: 'Shooting' }, { key: 'wrapped', label: 'Shoot wrapped' }, { key: 'editing', label: 'Editing' }, { key: 'delivered', label: 'Delivered' }];
export function ProgressStages({ progress }: { progress: PhotographyProgress }) {
  const idx = STAGES.findIndex((s) => s.key === progress);
  return (
    <ol className="flex items-center gap-1" aria-label="Photography progress">
      {STAGES.map((s, i) => (
        <li key={s.key} className="flex flex-1 flex-col gap-1" title={s.label}>
          <span className={cn('h-1.5 rounded-full', i <= idx ? 'bg-brand' : 'bg-paper-3')} /><span className={cn('hidden truncate text-[10px] sm:block', i === idx ? 'font-semibold text-ink' : 'text-ink-faint')}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
 
export function ClientEvents() {
  const q = useClientEvents(); const ph = useAllPhotographers();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const rows = (q.data?.items ?? []).filter((e) => (tab === 'upcoming' ? e.status !== 'completed' && e.status !== 'cancelled' : e.status === 'completed' || e.status === 'cancelled')).sort((a, b) => (tab === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  return (
    <div className="space-y-4">
      <div><h1 className="font-serif text-3xl font-semibold">My events</h1><p className="text-sm text-ink-muted">Dates, venues, your photographers and live progress.</p></div>
      <Tabs variant="pill" value={tab} onChange={setTab} items={[{ key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past events' }]} />
      {q.isLoading ? <Skeleton className="h-48 rounded-xl" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? <EmptyState title={`No ${tab} events`} /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((e) => { const m = deliveryMessage(e); return (
            <Card key={e.id} className="overflow-hidden">
              <div className="flex gap-4 p-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-ink text-center text-white"><span><span className="block text-xl font-semibold leading-none">{new Date(e.date).getDate()}</span><span className="text-[10px] uppercase tracking-wide text-white/70">{new Date(e.date).toLocaleString('en', { month: 'short' })}</span></span></div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold leading-tight">{e.title}</h2><StatusBadge status={e.status} /></div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3.5 w-3.5" />{e.venue}, {e.city} · {e.startTime}</p>
                  <div className="mt-2 flex items-center gap-3">{e.status !== 'completed' && <Countdown date={e.date} />}<PhotographerStack ids={e.photographerIds} all={ph.data?.items ?? []} /></div></div>
              </div>
              <div className="space-y-3 border-t border-line bg-paper/50 p-4">
                <div><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Photography progress</p><ProgressStages progress={e.progress} /></div>
                <div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Photo delivery · {m.title}</p><DueBadge delivery={e.delivery} /></div><DeliveryTracker delivery={e.delivery} compact /></div>
              </div>
            </Card>); })}
        </div>
      )}
    </div>
  );
}