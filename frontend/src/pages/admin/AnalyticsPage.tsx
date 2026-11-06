import { CalendarCheck, Percent, Send, Wallet } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useStudioStats } from '@/hooks/admin';
import { titleCase } from '@/lib/utils';
import { AreaChart, BarList, Donut } from '@/components/charts/Charts';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardHeader, PageHeader } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { BOOKING_STATUS_COLOR } from './adminUi';
 
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
 
export default function AnalyticsPage() {
  const { money } = useTenant(); const q = useStudioStats(); const d = q.data;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const st = (s: string) => d?.bookingsByStatus.find((x) => x.status === s)?.count ?? 0;
  const total = d?.totals.bookings ?? 0; const won = st('confirmed') + st('completed'); const closed = won + st('cancelled') + st('rejected');
  const billed = (d?.totals.revenue ?? 0) + (d?.totals.outstanding ?? 0);
  const funnel = d?.deliveryFunnel ?? [];
  const v = (x: React.ReactNode) => (q.isLoading ? '…' : x);
  return (
    <div className="space-y-4">
      <PageHeader title="Analytics" subtitle="Revenue, booking conversion and delivery performance." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Booking win rate" value={v(pct(won, closed))} icon={<Percent className="h-4 w-4" />} sub={`${won} won of ${closed} decided`} />
        <StatCard label="Avg. booking value" value={v(money(won ? Math.round(billed / won) : 0))} icon={<CalendarCheck className="h-4 w-4" />} tone="ink" sub="Collected + outstanding ÷ won" />
        <StatCard label="Collection rate" value={v(pct(d?.totals.revenue ?? 0, billed))} icon={<Wallet className="h-4 w-4" />} tone="success" sub={`${money(d?.totals.outstanding ?? 0)} still to collect`} />
        <StatCard label="Fully delivered" value={v(pct(funnel[3]?.count ?? 0, funnel[0]?.count ?? 0))} icon={<Send className="h-4 w-4" />} sub={`${funnel[3]?.count ?? 0} of ${funnel[0]?.count ?? 0} completed events`} />
      </div>
 
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Revenue collected" subtitle="Last 7 months" />
          <div className="p-4 pt-2">{q.isLoading ? <Skeleton className="h-48" /> : <AreaChart data={d!.revenueByMonth.map((m) => ({ label: m.month, value: m.revenue, sub: m.bookings }))} format={money} secondaryLabel="bookings" />}</div>
          {d && <details className="border-t border-line px-4 py-2 text-xs"><summary className="cursor-pointer font-medium text-ink-muted">View as table</summary>
            <table className="mt-2 w-full text-left"><thead className="text-ink-muted"><tr><th className="py-1 font-medium">Month</th><th className="py-1 text-right font-medium">Revenue</th><th className="py-1 text-right font-medium">Bookings</th></tr></thead><tbody>{d.revenueByMonth.map((m) => <tr key={m.month} className="border-t border-line"><td className="py-1">{m.month}</td><td className="py-1 text-right tabular-nums">{money(m.revenue)}</td><td className="py-1 text-right tabular-nums">{m.bookings}</td></tr>)}</tbody></table></details>}
        </Card>
        <Card>
          <CardHeader title="Bookings created" subtitle="New bookings and enquiries per month" />
          <div className="p-4 pt-2">{q.isLoading ? <Skeleton className="h-48" /> : <AreaChart data={d!.revenueByMonth.map((m) => ({ label: m.month, value: m.bookings }))} format={(n) => `${n} booking${n === 1 ? '' : 's'}`} color="#2a78d6" />}</div>
        </Card>
      </div>
 
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card><CardHeader title="Revenue by service" subtitle="Payments received" /><div className="p-4">{q.isLoading ? <Skeleton className="h-32" /> : <BarList items={[...d!.bookingsByService].sort((a, b) => b.revenue - a.revenue).map((s) => ({ label: s.name, value: s.revenue, hint: `${s.count} booking${s.count === 1 ? '' : 's'}` }))} format={(n) => money(n, true)} />}</div></Card>
        <Card><CardHeader title="Booking pipeline" /><div className="flex flex-wrap items-center gap-4 p-4">{q.isLoading ? <Skeleton className="h-28 w-full" /> : <><Donut centerValue={total} centerLabel="bookings" segments={d!.bookingsByStatus.filter((x) => x.count).map((x) => ({ label: titleCase(x.status), value: x.count, color: BOOKING_STATUS_COLOR[x.status] }))} /></>}</div></Card>
        <Card><CardHeader title="Delivery funnel" subtitle="Share of completed events reaching each stage" /><div className="space-y-3 p-4">{q.isLoading ? <Skeleton className="h-28" /> : funnel.map((f, i) => <div key={f.label}><BarList items={[{ label: f.label, value: f.count, hint: i ? pct(f.count, funnel[0].count) : undefined }]} max={Math.max(1, funnel[0].count)} /></div>)}</div></Card>
      </div>
 
      <Card>
        <CardHeader title="Photographer workload" subtitle="Assignments across the team" />
        {q.isLoading ? <div className="p-4"><Skeleton className="h-24" /></div> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-[13px]"><thead><tr className="border-b border-line bg-paper/70 text-[11px] uppercase tracking-wide text-ink-muted"><th className="px-4 py-2 font-semibold">Photographer</th><th className="px-4 py-2 text-right font-semibold">Upcoming</th><th className="px-4 py-2 text-right font-semibold">Completed</th><th className="px-4 py-2 font-semibold">Load</th></tr></thead>
            <tbody>{[...d!.photographerLoad].sort((a, b) => b.upcoming - a.upcoming).map((p) => <tr key={p.photographerId} className="border-b border-line last:border-0"><td className="px-4 py-2 font-medium">{p.name}</td><td className="px-4 py-2 text-right tabular-nums">{p.upcoming}</td><td className="px-4 py-2 text-right tabular-nums">{p.completed}</td><td className="w-1/3 px-4 py-2"><div className="h-1.5 overflow-hidden rounded-full bg-paper-3"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, p.upcoming * 20)}%` }} /></div></td></tr>)}</tbody></table></div>)}
      </Card>
    </div>
  );
}