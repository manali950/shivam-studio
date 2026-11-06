import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn, uid } from '@/lib/utils';
 
type Kind = 'success' | 'error' | 'info';
interface Toast { id: string; kind: Kind; message: string }
interface Ctx { success(m: string): void; error(m: string): void; info(m: string): void }
 
const ToastCtx = createContext<Ctx | null>(null);
export const useToast = () => useContext(ToastCtx)!;
 
const ICON = { success: CheckCircle2, error: XCircle, info: Info };
const TONE = { success: 'text-emerald-600', error: 'text-red-600', info: 'text-sky-600' };
 
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Kind, message: string) => {
    const id = uid('t');
    setItems((s) => [...s.slice(-3), { id, kind, message }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const api = useMemo<Ctx>(() => ({ success: (m) => push('success', m), error: (m) => push('error', m), info: (m) => push('info', m) }), [push]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" role="status" aria-live="polite">
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div key={t.id} className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-2.5 rounded-xl border border-line bg-white p-3 text-sm shadow-pop">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TONE[t.kind])} />
              <p className="flex-1 text-ink-2">{t.message}</p>
              <button aria-label="Dismiss" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="text-ink-faint hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}