import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, KeyRound, Pause, Pencil, Play, Plus, Store } from 'lucide-react';
import { services } from '@/services/data-provider';
import { usePlatformMutation } from '@/hooks/data';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, slugify } from '@/lib/utils';
import type { Tenant, TenantCreated, TenantStatus } from '@/types';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { DataTable, Pagination, SearchInput, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Field, Input, Select } from '@/components/ui/Form';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { PLATFORM_KEYS, usePlans } from './platformData';
 
const host = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const schema = z.object({
  name: z.string().trim().min(3, 'Enter the studio name'), slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens').min(3, 'At least 3 characters').max(40),
  ownerName: z.string().trim().min(2, 'Enter the owner name'), ownerEmail: z.string().trim().email('Enter a valid email'), city: z.string().trim().max(80).optional(),
  planId: z.string().min(1, 'Choose a plan'), status: z.enum(['trial', 'active', 'inactive']),
  subdomain: z.string().trim().regex(/^$|^[a-z0-9]+(-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens').optional(), customDomain: z.string().trim().refine((v) => v === '' || host.test(v), 'Enter a domain like photos.example.com').optional(),
});
type F = z.infer<typeof schema>;
const TABS: { key: '' | TenantStatus; label: string }[] = [{ key: '', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'trial', label: 'Trial' }, { key: 'inactive', label: 'Inactive' }];
 
export default function PlatformStudios() {
  const [sp, setSp] = useSearchParams(); const plans = usePlans();
  const [status, setStatus] = useState<'' | TenantStatus>(''); const [search, setSearch] = useState(''); const q = useDebounce(search); const [page, setPage] = useState(1);
  const [form, setForm] = useState<Tenant | 'new' | null>(sp.get('new') === '1' ? 'new' : null); const [toggle, setToggle] = useState<Tenant | null>(null);
  const params = useMemo(() => ({ page, pageSize: 10, search: q || undefined, status: status || undefined }), [page, q, status]);
  const list = useQuery({ queryKey: ['platform-tenants', params], queryFn: () => services.tenants.list(params), placeholderData: keepPreviousData });
  const setSt = usePlatformMutation<{ id: string; status: TenantStatus }, Tenant>((a) => services.tenants.setStatus(a.id, a.status), PLATFORM_KEYS, { success: 'Studio status updated', onSuccess: () => setToggle(null) });
  const planName = (id: string) => plans.data?.find((p) => p.id === id)?.name ?? '—';
  const closeForm = () => { setForm(null); if (sp.get('new')) { const n = new URLSearchParams(sp); n.delete('new'); setSp(n, { replace: true }); } };
 
  const cols: Column<Tenant>[] = [
    { key: 'n', header: 'Studio', primary: true, cell: (t) => <div><p className="font-medium">{t.name}</p><p className="font-mono text-[11px] text-ink-muted">/{t.slug}{t.customDomain ? ` · ${t.customDomain}` : ''}</p></div> },
    { key: 'o', header: 'Owner', hideBelow: 'lg', cell: (t) => <div><p className="text-[13px]">{t.ownerName}</p><p className="text-xs text-ink-muted">{t.ownerEmail}</p></div> },
    { key: 'p', header: 'Plan', hideBelow: 'lg', cell: (t) => <div className="flex flex-col items-start gap-1"><Badge tone="violet">{planName(t.planId)}</Badge><StatusBadge status={t.subscriptionStatus} /></div> },
    { key: 'c', header: 'Since', hideBelow: 'xl', cell: (t) => formatDate(t.createdAt) },
    { key: 's', header: 'Status', cell: (t) => <StatusBadge status={t.status} /> },
  ];
  return (
    <div>
      <PageHeader title="Studios" subtitle="Create and configure the photography studios on your platform." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm('new')}>New studio</Button>} />
      <Tabs variant="pill" className="mb-3" value={status} onChange={(k) => { setStatus(k); setPage(1); }} items={TABS} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search studio, slug, owner, city…" className="w-full sm:w-72" /><span className="ml-auto text-xs text-ink-muted">{list.data ? `${list.data.total} studios` : ''}</span></div>
        {list.error ? <div className="p-4"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div> : (
          <DataTable columns={cols} rows={list.data?.items ?? []} rowKey={(t) => t.id} loading={list.isLoading} onRowClick={(t) => setForm(t)}
            empty={<EmptyState icon={<Store className="h-5 w-5" />} title="No studios found" body="Create a studio to onboard a new photography business." />}
            actions={(t) => (<>
              <a href={`/${t.slug}`} target="_blank" rel="noreferrer" aria-label={`Open ${t.name} website`} title="Open website" className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-paper-2 hover:text-ink"><ExternalLink className="h-4 w-4" /></a>
              <IconButton label={`Edit ${t.name}`} onClick={() => setForm(t)}><Pencil className="h-4 w-4" /></IconButton>
              {t.status === 'inactive' ? <IconButton label={`Activate ${t.name}`} onClick={() => setSt.mutate({ id: t.id, status: 'active' })} className="hover:text-emerald-600"><Play className="h-4 w-4" /></IconButton> : <IconButton label={`Deactivate ${t.name}`} onClick={() => setToggle(t)} className="hover:text-red-600"><Pause className="h-4 w-4" /></IconButton>}
            </>)}
            mobileCard={(t) => <div className="space-y-1"><div className="flex items-start justify-between gap-2"><p className="font-medium">{t.name}</p><StatusBadge status={t.status} /></div><p className="font-mono text-[11px] text-ink-muted">/{t.slug}</p><p className="text-xs text-ink-2">{t.ownerName} · {planName(t.planId)}</p></div>} />
        )}
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
      {form && <StudioModal row={form === 'new' ? null : form} onClose={closeForm} />}
      <ConfirmDialog open={!!toggle} onClose={() => setToggle(null)} danger loading={setSt.isPending} title={`Deactivate ${toggle?.name}?`} confirmLabel="Deactivate studio" onConfirm={() => toggle && setSt.mutate({ id: toggle.id, status: 'inactive' })}
        body={<>The public website, portals and sign-ins for this studio are disabled immediately. <b>No data is deleted</b> and you can reactivate it at any time.</>} />
    </div>
  );
}
 
function StudioModal({ row, onClose }: { row: Tenant | null; onClose: () => void }) {
  const plans = usePlans(); const [tab, setTab] = useState<'details' | 'config'>('details'); const [slugTouched, setSlugTouched] = useState(!!row);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { name: row?.name ?? '', slug: row?.slug ?? '', ownerName: row?.ownerName ?? '', ownerEmail: row?.ownerEmail ?? '', city: row?.city ?? '', planId: row?.planId ?? '', status: row?.status ?? 'trial', subdomain: row?.subdomain ?? '', customDomain: row?.customDomain ?? '' } });
  const name = watch('name'); const [created, setCreated] = useState<TenantCreated | null>(null);
  useEffect(() => { if (!slugTouched) setValue('slug', slugify(name ?? ''), { shouldValidate: !!name }); }, [name, slugTouched, setValue]);
  useEffect(() => { if (!plans.data || row) return; setValue('planId', plans.data.find((p) => p.status === 'active')?.id ?? ''); }, [plans.data, row, setValue]);
  const save = usePlatformMutation<F, Tenant | TenantCreated>((v) => (row
    ? services.tenants.update(row.id, { ...v, customDomain: v.customDomain || null, subdomain: v.subdomain || v.slug })
    : services.tenants.create({ ...v, customDomain: v.customDomain || null, subdomain: v.subdomain || v.slug } as never)), PLATFORM_KEYS, { success: row ? 'Studio updated' : 'Studio created', onSuccess: (r) => (row ? onClose() : setCreated(r as TenantCreated)) });
  const err = (k: keyof F) => errors[k]?.message as string | undefined;
  if (created) return <OwnerCredentials studio={created} onClose={onClose} />;
  return (
    <Modal open onClose={onClose} size="lg" title={row ? row.name : 'New studio'} subtitle={row ? `Studio ID ${row.id}` : 'Creates the studio, default website content and its owner account.'}
      footer={tab === 'details' ? <><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>{row ? 'Save changes' : 'Create studio'}</Button></> : <Button variant="outline" onClick={onClose}>Done</Button>}>
      {row && <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ key: 'details', label: 'Details & domains' }, { key: 'config', label: 'Configuration' }]} />}
      {tab === 'details' ? (
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
          <Field label="Studio name" required error={err('name')}><Input invalid={!!errors.name} {...register('name')} /></Field>
          <Field label="URL slug" required error={err('slug')} hint="Used for /slug paths in development."><Input invalid={!!errors.slug} className="font-mono" {...register('slug', { onChange: () => setSlugTouched(true) })} /></Field>
          <Field label="Owner name" required error={err('ownerName')}><Input invalid={!!errors.ownerName} {...register('ownerName')} /></Field>
          <Field label="Owner email" required error={err('ownerEmail')} hint={row ? 'Existing owner account is not changed here.' : 'Becomes the studio admin sign-in.'}><Input type="email" invalid={!!errors.ownerEmail} {...register('ownerEmail')} /></Field>
          <Field label="City"><Input {...register('city')} /></Field>
          <Field label="Plan" required error={err('planId')}><Select invalid={!!errors.planId} {...register('planId')}><option value="">Select…</option>{plans.data?.filter((p) => p.status === 'active' || p.id === row?.planId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Status"><Select {...register('status')}><option value="trial">Trial</option><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
          <Field label="Subdomain" error={err('subdomain')} hint="Defaults to the slug: slug.<platform-domain>"><Input className="font-mono" invalid={!!errors.subdomain} {...register('subdomain')} /></Field>
          <Field label="Custom domain" error={err('customDomain')} hint="Optional. Customer points a CNAME at the platform." className="sm:col-span-2"><Input className="font-mono" placeholder="photos.studio-example.com" invalid={!!errors.customDomain} {...register('customDomain')} /></Field>
        </form>
      ) : row && <ConfigPanel tenant={row} />}
    </Modal>
  );
}
 
/** Shown once after a studio is created: the owner's sign-in. The temporary password is never retrievable again. */
function OwnerCredentials({ studio, onClose }: { studio: TenantCreated; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const pw = studio.ownerTemporaryPassword;
  const copy = async () => { try { await navigator.clipboard.writeText(pw ?? ''); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard unavailable: the value is selectable */ } };
  return (
    <Modal open onClose={onClose} size="md" title={`${studio.name} is ready`} subtitle="Share the owner's first sign-in securely."
      footer={<Button onClick={onClose}>Done</Button>}>
      <div className="space-y-3 text-sm">
        <div className="rounded-xl border border-line bg-paper-2/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Owner sign-in</p>
          <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-y-1.5">
            <dt className="text-ink-muted">Email</dt><dd className="break-all font-medium">{studio.ownerEmail}</dd>
            <dt className="text-ink-muted">Password</dt>
            <dd className="flex items-center gap-2">{pw ? <code className="select-all break-all rounded bg-white px-1.5 py-0.5 font-mono text-[13px] ring-1 ring-line">{pw}</code> : <span className="text-ink-muted">Not available</span>}
              {pw && <IconButton label={copied ? 'Copied' : 'Copy password'} onClick={copy}>{copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</IconButton>}</dd>
            <dt className="text-ink-muted">Sign in at</dt><dd className="font-mono text-[13px]">/{studio.slug}/login</dd>
          </dl>
        </div>
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900"><KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>This temporary password is shown <b>only now</b> and cannot be retrieved later. Ask the owner to change it after the first sign-in (Profile → Change password).</span></p>
      </div>
    </Modal>
  );
}
 
const cfgSchema = z.object({ currency: z.enum(['INR', 'USD', 'EUR', 'GBP']), deliveryTargetHours: z.number({ invalid_type_error: '1–720' }).min(1, '1–720').max(720, '1–720'), enquiryEnabled: z.boolean(), autoConfirm: z.boolean() });
function ConfigPanel({ tenant }: { tenant: Tenant }) {
  const q = useQuery({ queryKey: ['platform-config', tenant.id], queryFn: () => services.tenants.getConfig(tenant.id) });
  if (q.isLoading) return <Skeleton className="h-40" />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <ConfigForm tenant={tenant} s={q.data.settings} />;
}
function ConfigForm({ tenant, s }: { tenant: Tenant; s: import('@/types').TenantSettings }) {
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<z.infer<typeof cfgSchema>>({ resolver: zodResolver(cfgSchema), defaultValues: { currency: s.currency, deliveryTargetHours: s.deliveryTargetHours, enquiryEnabled: s.booking.enquiryEnabled, autoConfirm: s.booking.autoConfirm } });
  const save = usePlatformMutation<z.infer<typeof cfgSchema>, unknown>((v) => services.tenants.updateConfig(tenant.id, { settings: { currency: v.currency, deliveryTargetHours: v.deliveryTargetHours, booking: { enquiryEnabled: v.enquiryEnabled, autoConfirm: v.autoConfirm } } }), ['platform-config', 'tenant-config'], { success: 'Configuration saved' });
  return (
    <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
      <Field label="Currency"><Select {...register('currency')}>{['INR', 'USD', 'EUR', 'GBP'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Field label="Highlights target (hours)" error={errors.deliveryTargetHours?.message} hint="Default for new events."><Input type="number" min={1} max={720} invalid={!!errors.deliveryTargetHours} {...register('deliveryTargetHours', { valueAsNumber: true })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" {...register('enquiryEnabled')} />Accept website booking enquiries</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" {...register('autoConfirm')} />Auto-confirm bookings</label>
      <div className="sm:col-span-2"><Button type="submit" loading={save.isPending} disabled={!isDirty}>Save configuration</Button><p className="mt-2 text-xs text-ink-muted">Studios manage branding, website content and everything else themselves from their own admin dashboard.</p></div>
    </form>
  );
}