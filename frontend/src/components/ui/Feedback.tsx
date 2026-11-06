import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errMsg } from '@/services/errors';
import { Button } from './Button';
 
export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('animate-spin', className ?? 'h-5 w-5')} />;
export const Skeleton = ({ className }: { className?: string }) => <div className={cn('skeleton rounded-md', className)} aria-hidden />;
 
export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-white/60 px-6 py-10 text-center', className)}>
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-paper-2 text-ink-muted">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
 
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center rounded-xl border border-red-200 bg-red-50/60 px-6 py-8 text-center', className)}>
      <AlertTriangle className="mb-2 h-6 w-6 text-red-500" />
      <p className="text-sm font-semibold text-red-800">Something went wrong</p>
      <p className="mt-1 max-w-md text-sm text-red-700/80">{errMsg(error)}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-3" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRetry}>Try again</Button>}
    </div>
  );
}
 
/** Renders loading / error / empty / data consistently for any react-query result. */
export function QueryBoundary<T>({ query, skeleton, isEmpty, empty, children }: {
  query: Pick<UseQueryResult<T>, 'data' | 'isLoading' | 'error' | 'refetch'>;
  skeleton?: ReactNode; isEmpty?: (d: T) => boolean; empty?: ReactNode; children: (data: T) => ReactNode;
}) {
  if (query.isLoading) return <>{skeleton ?? <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>}</>;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return <>{children(query.data)}</>;
}
 
export const PageLoader = () => <div className="grid min-h-[40vh] place-items-center text-ink-muted"><Spinner className="h-6 w-6" /></div>;