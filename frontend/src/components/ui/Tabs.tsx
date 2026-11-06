import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
 
export interface TabItem<K extends string> { key: K; label: ReactNode; count?: number }
export function Tabs<K extends string>({ items, value, onChange, className, variant = 'underline' }: { items: TabItem<K>[]; value: K; onChange: (k: K) => void; className?: string; variant?: 'underline' | 'pill' }) {
  return (
    <div role="tablist" className={cn('no-scrollbar flex gap-1 overflow-x-auto', variant === 'underline' && 'border-b border-line', className)}>
      {items.map((t) => {
        const on = t.key === value;
        return (
          <button key={t.key} role="tab" aria-selected={on} onClick={() => onChange(t.key)}
            className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium transition',
              variant === 'underline' ? cn('-mb-px border-b-2 px-3 py-2', on ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink')
                : cn('rounded-full px-3 py-1.5', on ? 'bg-ink text-white' : 'text-ink-muted hover:bg-paper-2'))}>
            {t.label}
            {t.count !== undefined && <span className={cn('rounded-full px-1.5 text-[10px] font-semibold', on ? (variant === 'pill' ? 'bg-white/20' : 'bg-brand-soft text-brand-dark') : 'bg-paper-2 text-ink-muted')}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}