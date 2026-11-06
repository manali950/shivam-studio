import type { ReactNode } from 'react';
import { cn, titleCase } from '@/lib/utils';
 
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'violet';
const T: Record<Tone, string> = {
  neutral: 'bg-paper-2 text-ink-2 ring-line',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  brand: 'bg-brand-soft text-brand-dark ring-brand/30',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};
export function Badge({ tone = 'neutral', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', T[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{children}
    </span>
  );
}
 
const STATUS: Record<string, [Tone, string?]> = {
  // booking
  enquiry: ['info', 'New enquiry'], pending: ['warning', 'Under review'], confirmed: ['success'], completed: ['neutral'], rejected: ['danger'], cancelled: ['danger'],
  // payment
  unpaid: ['danger'], partial: ['warning', 'Part paid'], paid: ['success'], refunded: ['neutral'],
  // event
  scheduled: ['info'], in_progress: ['violet', 'In progress'],
  // progress
  planned: ['neutral'], shooting: ['violet'], wrapped: ['info', 'Shoot wrapped'], editing: ['warning'], delivered: ['success'],
  // delivery
  not_due: ['neutral', 'Not due'], highlights_submitted: ['warning', 'Awaiting review'], highlights_published: ['info', 'Highlights live'],
  // generic
  active: ['success'], inactive: ['neutral'], trial: ['violet', 'Trial'], on_leave: ['warning', 'On leave'], trialing: ['violet', 'Trialing'], past_due: ['danger', 'Past due'], archived: ['neutral'],
  published: ['success'], draft: ['neutral'], private: ['neutral'], client: ['info', 'Client only'], public: ['brand'], disabled: ['danger'],
};
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const [tone, label] = STATUS[status] ?? ['neutral'];
  return <Badge tone={tone} dot className={className}>{label ?? titleCase(status)}</Badge>;
}