import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sparkline } from '../charts/Charts';
 
export function StatCard({ label, value, icon, sub, trend, tone = 'brand', className, onClick }: {
  label: string; value: ReactNode; icon?: ReactNode; sub?: ReactNode; trend?: number[]; tone?: 'brand' | 'ink' | 'danger' | 'success'; className?: string; onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cn('card flex items-start gap-3 p-3 text-left', onClick && 'transition hover:border-brand/50 hover:shadow-pop', className)}>
      {icon && <span className={cn('hidden h-9 w-9 shrink-0 place-items-center rounded-lg sm:grid', tone === 'brand' && 'bg-brand-soft text-brand-dark', tone === 'ink' && 'bg-ink text-white', tone === 'danger' && 'bg-red-50 text-red-600', tone === 'success' && 'bg-emerald-50 text-emerald-600')}>{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold leading-tight tabular-nums text-ink">{value}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-ink-muted">{sub}</p>}
      </div>
      {trend && trend.length > 1 && <Sparkline data={trend} className="mt-1 hidden shrink-0 sm:block" />}
    </Tag>
  );
}