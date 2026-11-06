import { Check, Clock } from 'lucide-react';
import type { DeliveryInfo } from '@/types';
import { cn, formatDateTime } from '@/lib/utils';
 
/** Delivery target maths. Overdue is *informational only* — a gallery is never auto-marked delivered. */
export function deliveryDue(d: DeliveryInfo) {
  if (!d.completedAt || d.highlightsPublishedAt) return null;
  const due = new Date(d.completedAt).getTime() + d.targetHours * 3600000;
  const hours = (due - Date.now()) / 3600000;
  return { dueAt: new Date(due).toISOString(), overdue: hours < 0, hours: Math.abs(hours) };
}
export const fmtHours = (h: number) => (h >= 48 ? `${Math.round(h / 24)}d` : h >= 1 ? `${Math.round(h)}h` : `${Math.max(1, Math.round(h * 60))}m`);
 
export function DueBadge({ delivery, className }: { delivery: DeliveryInfo; className?: string }) {
  const due = deliveryDue(delivery);
  if (!due) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', due.overdue ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-amber-50 text-amber-800 ring-amber-200', className)}>
      <Clock className="h-3 w-3" />{due.overdue ? `Overdue ${fmtHours(due.hours)}` : `Due in ${fmtHours(due.hours)}`}
    </span>
  );
}
 
const STEPS = [
  { key: 'completedAt', label: 'Event done', short: 'Done' },
  { key: 'highlightsSubmittedAt', label: 'Highlights in review', short: 'In review' },
  { key: 'highlightsPublishedAt', label: 'Highlights live', short: 'Highlights' },
  { key: 'galleryPublishedAt', label: 'Full gallery', short: 'Gallery' },
] as const;
 
export function DeliveryTracker({ delivery, compact, className }: { delivery: DeliveryInfo; compact?: boolean; className?: string }) {
  const done = STEPS.map((s) => !!delivery[s.key]);
  const current = done.findIndex((d) => !d);
  return (
    <ol className={cn('grid grid-cols-4 gap-1', className)} aria-label="Delivery progress">
      {STEPS.map((s, i) => {
        const isDone = done[i]; const isCur = i === current;
        return (
          <li key={s.key} className="relative min-w-0 text-center">
            {i > 0 && <span className={cn('absolute right-1/2 top-3 h-0.5 w-full -translate-y-1/2', done[i - 1] && isDone ? 'bg-emerald-500' : done[i - 1] ? 'bg-gradient-to-r from-emerald-500 to-paper-3' : 'bg-paper-3')} aria-hidden />}
            <span className={cn('relative mx-auto grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ring-4 ring-white', isDone ? 'bg-emerald-500 text-white' : isCur ? 'bg-brand text-brand-contrast' : 'bg-paper-3 text-ink-faint')}>
              {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              {isCur && <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" aria-hidden />}
            </span>
            <p className={cn('mt-1 truncate text-[11px] font-medium leading-tight', isDone ? 'text-ink' : isCur ? 'text-ink-2' : 'text-ink-faint')}>{compact ? s.short : s.label}</p>
            {!compact && <p className="truncate text-[10px] text-ink-muted">{delivery[s.key] ? formatDateTime(delivery[s.key]) : isCur ? 'Next up' : '—'}</p>}
          </li>
        );
      })}
    </ol>
  );
}