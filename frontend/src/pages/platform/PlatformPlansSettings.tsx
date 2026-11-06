import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Archive, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { services } from '@/services/data-provider';
import { usePlatformMutation } from '@/hooks/data';
import { formatMoney, pluralize } from '@/lib/utils';
import type { PlatformSettings, SubscriptionPlan } from '@/types';
import { SectionForm } from '@/components/shared/SectionForm';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Field, Input, Select, TagInput } from '@/components/ui/Form';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { PLATFORM_KEYS, usePlans, usePlatformStats } from './platformData';
 
const int = (min: number, max: number) => z.number({ invalid_type_error: `${min}–${max}` }).int(`${min}–${max}`).min(min, `${min}–${max}`).max(max, `${min}–${max}`);
const planSchema = z.object({ name: z.string().trim().min(2, 'Enter a plan name'), priceMonthly: z.number({ invalid_type_error: 'Enter a price' }).min(0, 'Price cannot be negative'), currency: z.enum(['INR', 'USD']), maxPhotographers: int(1, 1000), maxStorageGb: int(1, 100000), maxBookingsPerMonth: int(1, 100000), features: z.array(z.string()), status: z.enum(['active', 'archived']) });
type PF = z.infer<typeof planSchema>;
 
export function PlatformPlans() {
  const q = usePlans(); const stats = usePlatformStats();
  const [edit, setEdit] = useState<SubscriptionPlan | 'new' | null>(null); const [del, setDel] = useState<SubscriptionPlan | null>(null);
  const remove = usePlatformMutation<string, void>((id) => services.platform.plans.remove(id), PLATFORM_KEYS, { success: 'Plan deleted', onSuccess: () => setDel(null) });
  const users = (id: string) => stats.data?.tenantsByPlan.find((p) => p.planId === id)?.count ?? 0;
  return (
    <div>
      <PageHeader title="Subscription plans" subtitle="What studios get at each tier." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit('new')}>New plan</Button>} />
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading ? <div className="grid grid-cols-1 gap-3 md:grid-cols-3"><Skeleton className="h-64" /><Skeleton className="h-64" /><Skeleton className="h-64" /></div> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.data!.map((p) => (
            <Card key={p.id} className={p.status === 'archived' ? 'opacity-70' : ''}>
              <div className="flex items-start justify-between gap-2 p-4 pb-2"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold">{p.name}</h2>{p.status === 'archived' && <Badge tone="neutral">Archived</Badge>}</div><p className="mt-1 text-2xl font-semibold tabular-nums">{formatMoney(p.priceMonthly, p.currency, p.currency === 'INR' ? 'en-IN' : 'en-US')}<span className="text-sm font-normal text-ink-muted"> / month</span></p></div>
                <div className="flex"><IconButton label={`Edit ${p.name}`} onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></IconButton><IconButton label={`Delete ${p.name}`} onClick={() => setDel(p)} className="hover:text-red-600"><Trash2 className="h-4 w-4" /></IconButton></div></div>
              <dl className="grid grid-cols-3 gap-2 px-4 py-2 text-center text-xs"><div className="rounded-lg bg-paper p-2"><dd className="text-sm font-semibold">{p.maxPhotographers}</dd><dt className="text-ink-muted">photographers</dt></div><div className="rounded-lg bg-paper p-2"><dd className="text-sm font-semibold">{p.maxStorageGb} GB</dd><dt className="text-ink-muted">storage</dt></div><div className="rounded-lg bg-paper p-2"><dd className="text-sm font-semibold">{p.maxBookingsPerMonth}</dd><dt className="text-ink-muted">bookings/mo</dt></div></dl>
              <ul className="space-y-1.5 px-4 py-3 text-[13px] text-ink-2">{p.features.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{f}</li>)}</ul>
              <p className="border-t border-line px-4 py-2 text-xs text-ink-muted">{pluralize(users(p.id), 'studio')} on this plan</p>
            </Card>))}
        </div>)}
      {edit && <PlanModal row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger loading={remove.isPending} title={`Delete ${del?.name}?`} confirmLabel="Delete plan" onConfirm={() => del && remove.mutate(del.id)}
        body={<>{del && users(del.id) > 0 ? <>This plan is used by <b>{pluralize(users(del.id), 'studio')}</b>, so it can’t be deleted. Archive it instead (edit the plan and set its status to Archived).</> : <>This permanently removes the plan.</>}</>} />
    </div>
  );
}
 
function PlanModal({ row, onClose }: { row: SubscriptionPlan | null; onClose: () => void }) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<PF>({ resolver: zodResolver(planSchema), defaultValues: { name: row?.name ?? '', priceMonthly: row?.priceMonthly ?? 0, currency: row?.currency ?? 'INR', maxPhotographers: row?.maxPhotographers ?? 3, maxStorageGb: row?.maxStorageGb ?? 50, maxBookingsPerMonth: row?.maxBookingsPerMonth ?? 50, features: row?.features ?? [], status: row?.status ?? 'active' } });
  const save = usePlatformMutation<PF, SubscriptionPlan>((v) => (row ? services.platform.plans.update(row.id, v) : services.platform.plans.create(v)), PLATFORM_KEYS, { success: 'Plan saved', onSuccess: onClose });
  const err = (k: keyof PF) => errors[k]?.message as string | undefined;
  return (
    <Modal open onClose={onClose} size="lg" title={row ? `Edit ${row.name}` : 'New plan'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))} icon={row?.status === 'archived' ? <Archive className="h-4 w-4" /> : undefined}>Save plan</Button></>}>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Field label="Name" required error={err('name')}><Input invalid={!!errors.name} {...register('name')} /></Field>
        <Field label="Status"><Select {...register('status')}><option value="active">Active</option><option value="archived">Archived (hidden from new studios)</option></Select></Field>
        <Field label="Price per month" error={err('priceMonthly')}><Input type="number" min={0} step="any" invalid={!!errors.priceMonthly} {...register('priceMonthly', { valueAsNumber: true })} /></Field>
        <Field label="Currency"><Select {...register('currency')}><option>INR</option><option>USD</option></Select></Field>
        <Field label="Max photographers" error={err('maxPhotographers')}><Input type="number" invalid={!!errors.maxPhotographers} {...register('maxPhotographers', { valueAsNumber: true })} /></Field>
        <Field label="Storage (GB)" error={err('maxStorageGb')}><Input type="number" invalid={!!errors.maxStorageGb} {...register('maxStorageGb', { valueAsNumber: true })} /></Field>
        <Field label="Bookings per month" error={err('maxBookingsPerMonth')}><Input type="number" invalid={!!errors.maxBookingsPerMonth} {...register('maxBookingsPerMonth', { valueAsNumber: true })} /></Field>
        <Field label="Features" group className="sm:col-span-2"><Controller control={control} name="features" render={({ field }) => <TagInput value={field.value} onChange={field.onChange} placeholder="Custom domain, Priority support… Enter" />} /></Field>
      </form>
    </Modal>
  );
}
 
const setSchema = z.object({
  platformName: z.string().trim().min(2, 'Enter a platform name'), supportEmail: z.string().trim().email('Enter a valid email'), baseDomain: z.string().trim().regex(/^$|^([a-z0-9-]+\.)+[a-z]{2,}$/i, 'Enter a domain like shivamstudio.app'),
  defaultPlanId: z.string().min(1, 'Choose a default plan'), trialDays: int(0, 365), allowSelfSignup: z.boolean(), maintenanceMode: z.boolean(), defaultDeliveryTargetHours: int(1, 720),
});
export function PlatformSettingsPage() {
  const q = useQuery({ queryKey: ['platform-settings'], queryFn: () => services.platform.getSettings() }); const plans = usePlans();
  const save = usePlatformMutation<PlatformSettings, PlatformSettings>((v) => services.platform.updateSettings(v), PLATFORM_KEYS, { success: 'Platform settings saved' });
  return (
    <div className="space-y-3">
      <PageHeader title="Platform settings" subtitle="Defaults that apply to new studios and the platform as a whole." />
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isLoading || plans.isLoading ? <Skeleton className="h-72" /> : (
        <SectionForm title="General" subtitle="Changes affect new studios — existing studios keep their own configuration." schema={setSchema} saving={save.isPending} defaults={q.data!} onSave={(v) => save.mutate(v as PlatformSettings)}
          fields={[{ name: 'platformName', label: 'Platform name', type: 'text' }, { name: 'supportEmail', label: 'Support email', type: 'email' }, { name: 'baseDomain', label: 'Base domain', type: 'text', hint: 'Studios without a custom domain live at <subdomain>.<base domain>.' }, { name: 'defaultPlanId', label: 'Default plan for new studios', type: 'select', options: (plans.data ?? []).filter((p) => p.status === 'active').map((p) => ({ value: p.id, label: p.name })) }, { name: 'trialDays', label: 'Trial length (days)', type: 'number', min: 0, max: 365 }, { name: 'defaultDeliveryTargetHours', label: 'Default highlights target (hours)', type: 'number', min: 1, max: 720 }, { name: 'allowSelfSignup', label: 'Allow studios to self-register', type: 'toggle' }, { name: 'maintenanceMode', label: 'Maintenance mode', type: 'toggle', hint: 'Shows a maintenance banner to studio users (demo flag).' }]} />
      )}
    </div>
  );
}