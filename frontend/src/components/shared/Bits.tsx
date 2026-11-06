import type { ReactNode } from 'react';
import { CalendarClock, ExternalLink, HardDrive } from 'lucide-react';
import type { DeliveryInfo, ID, Photographer, StudioEvent } from '@/types';
import { cn, daysUntil, formatMoney } from '@/lib/utils';
import { Avatar } from '../ui/SmartImage';
import { ProgressBar } from '../charts/Charts';
import { deliveryDue, fmtHours } from './DeliveryTracker';
import { DRIVE_NOTICE } from '@/lib/media';
 
export function Countdown({ date, className }: { date: string; className?: string }) {
  const d = daysUntil(date);
  const label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 0 ? `${d} days to go` : d === -1 ? 'Yesterday' : `${-d} days ago`;
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', d >= 0 ? 'bg-brand-soft text-brand-dark' : 'bg-paper-2 text-ink-muted', className)}><CalendarClock className="h-3 w-3" />{label}</span>;
}
 
export function PaymentBar({ amount, paid, currency, locale }: { amount: number; paid: number; currency: string; locale: string }) {
  const pct = amount ? Math.round((paid / amount) * 100) : 0;
  return (
    <div className="min-w-[8rem]">
      <div className="mb-1 flex justify-between text-[11px] text-ink-muted"><span>{formatMoney(paid, currency, locale)} paid</span><span>{pct}%</span></div>
      <ProgressBar value={paid} max={amount || 1} color={pct >= 100 ? '#10b981' : undefined} />
      {amount - paid > 0 && <p className="mt-1 text-[11px] text-ink-faint">Balance {formatMoney(amount - paid, currency, locale)}</p>}
    </div>
  );
}
 
export function PhotographerStack({ ids, all, max = 4, size = 24 }: { ids: ID[]; all: Photographer[]; max?: number; size?: number }) {
  const list = ids.map((i) => all.find((p) => p.id === i)).filter(Boolean) as Photographer[];
  if (!list.length) return <span className="text-xs text-ink-faint">Not assigned</span>;
  return (
    <span className="inline-flex items-center">
      <span className="flex -space-x-1.5">{list.slice(0, max).map((p) => <span key={p.id} title={p.name} className="rounded-full ring-2 ring-white"><Avatar src={p.avatarUrl} name={p.name} size={size} /></span>)}</span>
      {list.length > max && <span className="ml-1 text-[11px] text-ink-muted">+{list.length - max}</span>}
    </span>
  );
}
 
/** Plain-language delivery status used on every client-facing delivery card. */
export function deliveryMessage(e: Pick<StudioEvent, 'status' | 'delivery'>): { title: string; body: string; tone: 'info' | 'warning' | 'success' | 'neutral' } {
  const d: DeliveryInfo = e.delivery;
  if (d.status === 'delivered') return { title: 'Complete gallery delivered', body: 'All photographs are ready to view and download.', tone: 'success' };
  if (d.status === 'highlights_published') return { title: 'Highlights are live', body: 'Your favourite frames are ready. The complete gallery follows after final retouching.', tone: 'info' };
  if (d.status === 'highlights_submitted') return { title: 'Highlights are being reviewed', body: 'Your photographer has picked the highlights; the studio is giving them a final check.', tone: 'warning' };
  if (d.status === 'pending') {
    const due = deliveryDue(d);
    return { title: due?.overdue ? 'Highlights are taking a little longer' : 'Highlights are on their way', body: due ? (due.overdue ? `We targeted ${fmtHours(d.targetHours)} and are slightly behind — your studio is on it.` : `Expected within ${fmtHours(due.hours)} (${fmtHours(d.targetHours)} delivery target).`) : 'Your photographer is selecting highlights.', tone: due?.overdue ? 'warning' : 'info' };
  }
  return { title: e.status === 'cancelled' ? 'Event cancelled' : 'Photos after your event', body: `Next-day highlights are published within ${fmtHours(d.targetHours)} of your event.`, tone: 'neutral' };
}
 
export function DriveButton({ url, title, compact }: { url: string; title?: string; compact?: boolean }) {
  return (
    <span className="inline-flex flex-col items-start">
      <a href={url} target="_blank" rel="noreferrer noopener" className={cn('inline-flex items-center gap-2 rounded-lg bg-[#1a73e8] font-medium text-white transition hover:bg-[#1558b0]', compact ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm')}>
        <HardDrive className="h-4 w-4" />{title ?? 'View Google Drive'}<ExternalLink className="h-3.5 w-3.5 opacity-70" />
      </a>
      {!compact && <span className="mt-1 max-w-xs text-[11px] leading-snug text-ink-faint">{DRIVE_NOTICE.split('.')[0]}.</span>}
    </span>
  );
}
 
export const Dot = ({ className }: { className?: string }) => <span className={cn('inline-block h-1.5 w-1.5 rounded-full', className)} />;
export const Kv = ({ k, children }: { k: string; children: ReactNode }) => <div><dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{k}</dt><dd className="mt-0.5 text-sm text-ink">{children}</dd></div>;