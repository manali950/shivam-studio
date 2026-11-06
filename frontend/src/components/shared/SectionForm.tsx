import type { ReactNode } from 'react';
import { Controller, useForm, type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { ColorField, Field, Input, Select, TagInput, Textarea, Toggle } from '../ui/Form';
 
export interface SectionField {
  name: string; label: string; type: 'text' | 'textarea' | 'url' | 'email' | 'number' | 'select' | 'toggle' | 'tags' | 'color';
  options?: { value: string; label: string }[]; hint?: ReactNode; placeholder?: string; rows?: number; span?: 1 | 2; step?: number; min?: number; max?: number;
}
 
/** Small settings form: one card, Zod validation, dirty-aware Save. Used by Website CMS and Settings tabs. */
export function SectionForm<F extends FieldValues>({ title, subtitle, fields, schema, defaults, onSave, saving, extra, aside }: {
  title: string; subtitle?: string; fields: SectionField[]; schema: ZodType<F, any, any>; defaults: F; onSave: (v: F) => void; saving: boolean;
  extra?: (f: UseFormReturn<F>) => ReactNode; aside?: (f: UseFormReturn<F>) => ReactNode;
}) {
  const form = useForm<F>({ resolver: zodResolver(schema), defaultValues: defaults as DefaultValues<F> });
  const { register, control, handleSubmit, formState: { errors, isDirty }, reset } = form;
  const err = (n: string) => (errors as Record<string, { message?: string }>)[n]?.message;
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <form noValidate onSubmit={handleSubmit((v) => { onSave(v); reset(v); })} className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((f) => {
            const span = f.span === 2 || f.type === 'textarea' || f.type === 'tags' || f.type === 'toggle' ? 'sm:col-span-2' : '';
            const bad = !!err(f.name);
            let ctl: ReactNode;
            switch (f.type) {
              case 'textarea': ctl = <Textarea rows={f.rows ?? 3} invalid={bad} {...register(f.name as never)} />; break;
              case 'number': ctl = <Input type="number" step={f.step ?? 1} min={f.min} max={f.max} invalid={bad} {...register(f.name as never, { valueAsNumber: true })} />; break;
              case 'select': ctl = <Select invalid={bad} {...register(f.name as never)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>; break;
              case 'toggle': return <div key={f.name} className={span}><Controller control={control} name={f.name as never} render={({ field }) => <Toggle checked={!!field.value} onChange={field.onChange} label={f.label} hint={f.hint} />} /></div>;
              case 'tags': ctl = <Controller control={control} name={f.name as never} render={({ field }) => <TagInput value={field.value ?? []} onChange={field.onChange} placeholder={f.placeholder} />} />; break;
              case 'color': ctl = <Controller control={control} name={f.name as never} render={({ field }) => <ColorField value={field.value ?? ''} onChange={field.onChange} />} />; break;
              default: ctl = <Input type={f.type} placeholder={f.placeholder} invalid={bad} {...register(f.name as never)} />;
            }
            return <Field key={f.name} label={f.label} error={err(f.name)} hint={f.hint} className={span} group={f.type === 'tags' || f.type === 'color'}>{ctl}</Field>;
          })}
          {extra?.(form)}
          <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" icon={<Save className="h-4 w-4" />} loading={saving} disabled={!isDirty}>Save changes</Button>{isDirty && <span className="text-xs text-amber-700">Unsaved changes</span>}</div>
        </div>
        {aside && <div className="lg:w-72">{aside(form)}</div>}
      </form>
    </Card>
  );
}