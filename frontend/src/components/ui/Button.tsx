import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
 
export type Variant = 'primary' | 'dark' | 'outline' | 'ghost' | 'danger' | 'soft' | 'success';
export type Size = 'xs' | 'sm' | 'md' | 'lg';
 
const V: Record<Variant, string> = {
  primary: 'bg-brand text-brand-contrast hover:bg-brand-dark hover:text-white shadow-sm',
  dark: 'bg-ink text-white hover:bg-ink-2 shadow-sm',
  outline: 'border border-line bg-white text-ink hover:bg-paper-2',
  ghost: 'text-ink-2 hover:bg-paper-2',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  soft: 'bg-brand-soft text-brand-dark hover:bg-brand/20',
};
const S: Record<Size, string> = { xs: 'h-7 px-2.5 text-xs gap-1', sm: 'h-8 px-3 text-[13px] gap-1.5', md: 'h-9 px-4 text-sm gap-2', lg: 'h-11 px-6 text-sm gap-2' };
 
/** Class helper so <Link> can look like a button. */
export const btn = (variant: Variant = 'primary', size: Size = 'md', extra?: string) =>
  cn('inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg font-medium transition disabled:pointer-events-none disabled:opacity-50', V[variant], S[size], extra);
 
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean; icon?: ReactNode }
export const Button = forwardRef<HTMLButtonElement, Props>(({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} disabled={disabled || loading} className={btn(variant, size, className)} {...p}>
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
    {children}
  </button>
));
Button.displayName = 'Button';
 
export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string }>(({ label, className, children, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} aria-label={label} title={label} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-paper-2 hover:text-ink disabled:opacity-40', className)} {...p}>{children}</button>
));
IconButton.displayName = 'IconButton';