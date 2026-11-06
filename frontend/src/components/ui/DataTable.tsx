import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Skeleton } from './Feedback';
 
export interface Column<T> {
  key: string; header: ReactNode; cell: (row: T) => ReactNode;
  className?: string; align?: 'right' | 'center'; hideMobile?: boolean; primary?: boolean; hideBelow?: 'lg' | 'xl';
}
 
interface Props<T> {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; loading?: boolean; onRowClick?: (r: T) => void;
  empty?: ReactNode; mobileCard?: (r: T) => ReactNode; actions?: (r: T) => ReactNode; dense?: boolean;
}
 
/** Compact table on ≥md; stacked cards on mobile (never horizontal page overflow). */
export function DataTable<T>({ columns, rows, rowKey, loading, onRowClick, empty, mobileCard, actions, dense }: Props<T>) {
  if (loading) return <div className="space-y-px">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-none" />)}</div>;
  if (!rows.length) return <div className="p-4">{empty}</div>;
  const hide = (c: Column<T>) => (c.hideBelow === 'xl' ? 'hidden xl:table-cell' : c.hideBelow === 'lg' ? 'hidden lg:table-cell' : '');
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-line bg-paper/70 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {columns.map((c) => <th key={c.key} className={cn('px-4 py-2 font-semibold', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', hide(c), c.className)}>{c.header}</th>)}
              {actions && <th className="w-px px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-brand-soft/40')}>
                {columns.map((c) => <td key={c.key} className={cn('px-4 align-middle', dense ? 'py-1.5' : 'py-2.5', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', hide(c), c.className)}>{c.cell(r)}</td>)}
                {actions && <td className="px-3 py-1.5 text-right" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-0.5">{actions(r)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('px-4 py-3', onRowClick && 'active:bg-brand-soft/40')}>
            {mobileCard ? mobileCard(r) : (
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0 font-medium">{primary.cell(r)}</div>{actions && <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>{actions(r)}</div>}</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {columns.filter((c) => c !== primary && !c.hideMobile).map((c) => (
                    <div key={c.key} className="min-w-0"><dt className="text-[10px] uppercase tracking-wide text-ink-faint">{c.header}</dt><dd className="truncate text-ink-2">{c.cell(r)}</dd></div>
                  ))}
                </dl>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
 
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return total ? <div className="border-t border-line px-4 py-2 text-xs text-ink-muted">{total} {total === 1 ? 'result' : 'results'}</div> : null;
  const from = (page - 1) * pageSize + 1; const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs text-ink-muted">
      <span>{from}–{to} of {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></Button>
        <span className="px-1.5 tabular-nums">{page} / {pages}</span>
        <Button variant="outline" size="xs" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}
 
export function SearchInput({ value, onChange, placeholder = 'Search…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input pl-8" />
    </div>
  );
}