import { forwardRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
 
export function Field({ label, error, hint, required, className, children, group }: { label?: ReactNode; error?: string; hint?: ReactNode; required?: boolean; className?: string; children: ReactNode; group?: boolean }) {
  const Wrap = (group ? 'div' : 'label') as 'label';
  return (
    <Wrap className={cn('block', className)} {...(group ? { role: 'group', 'aria-label': typeof label === 'string' ? label : undefined } : {})}>
      {label && <span className="mb-1 block text-xs font-medium text-ink-2">{label}{required && <span className="text-red-500"> *</span>}</span>}
      {children}
      {error ? <span role="alert" className="mt-1 block text-xs text-red-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-ink-muted">{hint}</span> : null}
    </Wrap>
  );
}
 
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <input ref={ref} className={cn('input', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-200', className)} {...p} />
));
Input.displayName = 'Input';
 
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <textarea ref={ref} className={cn('input', invalid && 'border-red-400', className)} {...p} />
));
Textarea.displayName = 'Textarea';
 
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(({ className, invalid, children, ...p }, ref) => (
  <select ref={ref} className={cn('input appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%236f6a63%27><path d=%27M5.8 7.5 10 11.7l4.2-4.2 1.3 1.3L10 14.3 4.5 8.8z%27/></svg>")] bg-[length:16px] bg-[right_8px_center] bg-no-repeat pr-8', invalid && 'border-red-400', className)} {...p}>{children}</select>
));
Select.displayName = 'Select';
 
export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-paper-3')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
      {(label || hint) && <span className="min-w-0 text-sm"><span className="block font-medium text-ink-2">{label}</span>{hint && <span className="block text-xs text-ink-muted">{hint}</span>}</span>}
    </label>
  );
}
 
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(({ label, className, ...p }, ref) => (
  <label className={cn('flex cursor-pointer items-center gap-2 text-sm text-ink-2', className)}>
    <input ref={ref} type="checkbox" className="h-4 w-4 rounded border-line text-brand accent-[rgb(var(--brand))]" {...p} />{label}
  </label>
));
Checkbox.displayName = 'Checkbox';
 
export function TagInput({ value, onChange, placeholder = 'Type and press Enter', suggestions }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [draft, setDraft] = useState('');
  const add = (t: string) => { const v = t.trim(); if (v && !value.includes(v)) onChange([...value, v]); setDraft(''); };
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-paper-2 px-2 py-0.5 text-xs text-ink-2">
          {t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="text-ink-faint hover:text-red-600"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={draft} list={suggestions ? 'tag-suggest' : undefined} onChange={(e) => setDraft(e.target.value)} placeholder={value.length ? '' : placeholder}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
        onBlur={() => add(draft)} className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint" />
      {suggestions && <datalist id="tag-suggest">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
    </div>
  );
}
 
export function ChipSelect<V extends string>({ value, onChange, options, single }: { value: V[]; onChange: (v: V[]) => void; options: { value: V; label: string; hint?: string }[]; single?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button key={o.value} type="button" aria-pressed={on} title={o.hint}
            onClick={() => onChange(single ? [o.value] : on ? value.filter((x) => x !== o.value) : [...value, o.value])}
            className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition', on ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-white text-ink-2 hover:bg-paper-2')}>
            {on && <Check className="h-3 w-3" />}{o.label}
          </button>
        );
      })}
    </div>
  );
}
 
export function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#b08d57'} onChange={(e) => onChange(e.target.value)} aria-label="Pick colour" className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-white p-1" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={7} className="font-mono uppercase" />
    </div>
  );
}