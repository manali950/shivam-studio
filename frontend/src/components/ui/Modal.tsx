import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';
 
const W = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
 
function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([aria-label="Close"])')?.focus(), 50);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key); clearTimeout(t); };
  }, [open, onClose]);
  return ref;
}
 
interface Props { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: keyof typeof W }
 
export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }: Props) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className={cn('relative flex max-h-[92vh] w-full animate-fade-up flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl', W[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0"><h2 className="truncate text-base font-semibold text-ink">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}</div>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-paper-2 hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3 sm:rounded-b-2xl">{footer}</div>}
      </div>
    </div>, document.body);
}
 
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-lg' }: Omit<Props, 'size'> & { width?: string }) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={onClose} />
      <div ref={ref} className={cn('relative flex h-full w-full animate-slide-in flex-col bg-white shadow-pop', width)}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0"><h2 className="truncate text-base font-semibold">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}</div>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-ink-muted hover:bg-paper-2"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-paper/60 px-5 py-3">{footer}</div>}
      </div>
    </div>, document.body);
}
 
export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = 'Confirm', danger, loading }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'dark'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <div className="text-sm text-ink-2">{body}</div>
    </Modal>
  );
}