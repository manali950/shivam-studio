import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { keepPreviousData } from '@tanstack/react-query';
import { AlertTriangle, Ban, Calendar, CalendarCheck, Check, CheckCheck, Mail, MapPin, Phone, Plus, RotateCcw, Send, Users, X } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useTenantMutation, useTenantQuery } from '@/hooks/data';
import { useDebounce } from '@/hooks/useDebounce';
import { useEventList, usePackageList, usePhotographerList, useServiceList, useStudioStats } from '@/hooks/admin';
import { services } from '@/services/data-provider';
import { formatDate, formatDateTime, timeAgo, titleCase } from '@/lib/utils';
import type { Booking, BookingStatus, Photographer } from '@/types';
import { Kv, PaymentBar, PhotographerStack } from '@/components/shared/Bits';
import { TLink } from '@/components/shared/TLink';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { DataTable, Pagination, SearchInput, type Column } from '@/components/ui/DataTable';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { Drawer, Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
 
const TABS = [
  { key: '', label: 'All' }, { key: 'enquiry', label: 'Enquiries' }, { key: 'pending', label: 'Pending' }, { key: 'confirmed', label: 'Confirmed' }, { key: 'completed', label: 'Completed' }, { key: 'cancelled', label: 'Cancelled' }, { key: 'rejected', label: 'Rejected' },
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
 
export default function BookingsPage() {
  const { money } = useTenant();
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState(sp.get('q') ?? ''); const q = useDebounce(search);
  const [status, setStatus] = useState(sp.get('status') ?? ''); const [payment, setPayment] = useState(''); const [photographer, setPhotographer] = useState(''); const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(sp.get('new') === '1');
  const openId = sp.get('open');
  const stats = useStudioStats(); const ph = usePhotographerList(); const svc = useServiceList();
  const params = useMemo(() => ({ page, pageSize: 12, search: q || undefined, status: (status || undefined) as BookingStatus | undefined, paymentStatus: payment || undefined, photographerId: photographer || undefined, sort: 'createdAt', order: 'desc' as const }), [page, q, status, payment, photographer]);
  const list = useTenantQuery(['bookings', 'list', params], (t) => services.bookings.list(t, params), { placeholderData: keepPreviousData } as never);
  const counts = Object.fromEntries((stats.data?.bookingsByStatus ?? []).map((s) => [s.status, s.count]));
  const total = stats.data?.totals.bookings;
  const svcName = (id: string) => svc.data?.items.find((s) => s.id === id)?.name ?? '—';
  const setParam = (k: string, v: string | null) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
 
  const cols: Column<Booking>[] = [
    { key: 'ref', header: 'Booking', primary: true, cell: (b) => <div><p className="font-medium">{b.customer.name}</p><p className="text-xs text-ink-muted">{b.reference} · {timeAgo(b.createdAt)}</p></div> },
    { key: 'svc', header: 'Service', hideBelow: 'lg', cell: (b) => svcName(b.serviceId) },
    { key: 'date', header: 'Event date', cell: (b) => <span className="whitespace-nowrap">{formatDate(b.eventDate)}</span> },
    { key: 'loc', header: 'Location', hideBelow: 'xl', cell: (b) => <span className="line-clamp-1 max-w-[14rem]">{b.location}</span> },
    { key: 'team', header: 'Team', hideBelow: 'lg', cell: (b) => <PhotographerStack ids={b.assignedPhotographerIds} all={ph.data?.items ?? []} /> },
    { key: 'amt', header: 'Amount', align: 'right', cell: (b) => <div className="text-right"><p className="font-medium tabular-nums">{money(b.amount)}</p><StatusBadge status={b.paymentStatus} /></div> },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} /> },
  ];
 
  return (
    <div>
      <PageHeader title="Bookings" subtitle="Enquiries, approvals, photographer assignment and payments." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New booking</Button>} />
      <Tabs variant="pill" className="mb-3" value={status} onChange={(k) => { setStatus(k); setPage(1); }} items={TABS.map((t) => ({ ...t, count: t.key ? counts[t.key] : total }))} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search name, reference, venue…" className="w-full sm:w-64" />
          <Select aria-label="Payment status" className="w-auto min-w-[9rem]" value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1); }}><option value="">Payment: all</option>{['unpaid', 'partial', 'paid', 'refunded'].map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</Select>
          <Select aria-label="Photographer" className="w-auto min-w-[10rem]" value={photographer} onChange={(e) => { setPhotographer(e.target.value); setPage(1); }}><option value="">Photographer: all</option>{ph.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
          <span className="ml-auto text-xs text-ink-muted">{list.data ? `${list.data.total} result${list.data.total === 1 ? '' : 's'}` : ''}</span>
        </div>
        {list.error ? <div className="p-4"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div> : (
          <DataTable columns={cols} rows={list.data?.items ?? []} rowKey={(b) => b.id} loading={list.isLoading} onRowClick={(b) => setParam('open', b.id)}
            empty={<EmptyState icon={<CalendarCheck className="h-5 w-5" />} title="No bookings match" body="Try another status or clear your search." />}
            mobileCard={(b) => <div className="space-y-1.5"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{b.customer.name}</p><p className="text-xs text-ink-muted">{b.reference} · {svcName(b.serviceId)}</p></div><StatusBadge status={b.status} /></div><p className="text-xs text-ink-2">{formatDate(b.eventDate)} · {b.location}</p><div className="flex items-center justify-between"><PhotographerStack ids={b.assignedPhotographerIds} all={ph.data?.items ?? []} /><span className="text-sm font-semibold tabular-nums">{money(b.amount)}</span></div></div>} />
        )}
        {list.data && <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} />}
      </Card>
      {openId && <BookingDrawer id={openId} onClose={() => setParam('open', null)} svcName={svcName} />}
      {creating && <NewBooking onClose={() => { setCreating(false); setParam('new', null); }} onCreated={(id) => { setCreating(false); const n = new URLSearchParams(sp); n.delete('new'); n.set('open', id); setSp(n, { replace: true }); }} />}
    </div>
  );
}
  
/* ------------------------------------------------------------ Drawer */
function BookingDrawer({ id, onClose, svcName }: { id: string; onClose: () => void; svcName: (id: string) => string }) {
  const { money } = useTenant();
  const q = useTenantQuery(['bookings', 'detail', id], (t) => services.bookings.get(t, id));
  const b = q.data;
  const inv = ['bookings', 'events', 'analytics', 'notifications', 'galleries'];
  const setStatus = useTenantMutation<{ status: BookingStatus; note?: string }, Booking>((t, a) => services.bookings.setStatus(t, id, a.status, a.note), inv, { success: 'Booking updated', onSuccess: () => setReason(null) });
  const [reason, setReason] = useState<null | 'rejected' | 'cancelled'>(null);
  const [note, setNote] = useState('');
  const addNote = useTenantMutation<string, unknown>((t, text) => services.bookings.addNote(t, id, text), ['bookings'], { onSuccess: () => setNote('') });
  const pay = useTenantMutation<number, Booking>((t, add) => services.bookings.update(t, id, { paidAmount: (b?.paidAmount ?? 0) + add }), inv, { success: 'Payment recorded' });
  const [amount, setAmount] = useState('');
  const pkgs = usePackageList(); const pkg = pkgs.data?.items.find((p) => p.id === b?.packageId);
  const balance = b ? Math.max(0, b.amount - b.paidAmount) : 0;
  const open = b && (b.status === 'enquiry' || b.status === 'pending');
 
  return (
    <Drawer open onClose={onClose} width="max-w-xl" title={b ? <span className="flex items-center gap-2">{b.customer.name} <StatusBadge status={b.status} /></span> : 'Booking'} subtitle={b ? `${b.reference} · created ${formatDateTime(b.createdAt)} · ${titleCase(b.source)}` : undefined}
      footer={b && (
        <>
          {open && <><Button variant="danger" size="sm" icon={<X className="h-4 w-4" />} onClick={() => setReason('rejected')}>Reject</Button>
            {b.status === 'enquiry' && <Button variant="outline" size="sm" loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'pending' })}>Mark pending</Button>}
            <Button variant="success" size="sm" icon={<Check className="h-4 w-4" />} loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'confirmed' })}>Approve &amp; confirm</Button></>}
          {b.status === 'confirmed' && <><Button variant="danger" size="sm" icon={<Ban className="h-4 w-4" />} onClick={() => setReason('cancelled')}>Cancel booking</Button><Button variant="dark" size="sm" icon={<CheckCheck className="h-4 w-4" />} loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'completed' })}>Mark completed</Button></>}
          {(b.status === 'cancelled' || b.status === 'rejected') && <Button variant="outline" size="sm" icon={<RotateCcw className="h-4 w-4" />} loading={setStatus.isPending} onClick={() => setStatus.mutate({ status: 'pending' })}>Reopen as pending</Button>}
        </>
      )}>
      {q.isLoading ? <p className="text-sm text-ink-muted">Loading…</p> : q.error || !b ? <ErrorState error={q.error ?? new Error('Not found')} onRetry={() => q.refetch()} /> : (
        <div className="space-y-5">
          {open && <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Approving creates the customer account record and an event, and notifies the customer in their portal.</p>}
          <section className="grid grid-cols-2 gap-3">
            <Kv k="Customer">{b.customer.name}</Kv>
            <Kv k="Contact"><a href={`mailto:${b.customer.email}`} className="flex items-center gap-1 text-brand-dark"><Mail className="h-3.5 w-3.5" />{b.customer.email}</a><a href={`tel:${b.customer.phone}`} className="mt-0.5 flex items-center gap-1 text-ink-2"><Phone className="h-3.5 w-3.5 text-ink-faint" />{b.customer.phone}</a></Kv>
            <Kv k="Service">{svcName(b.serviceId)}{pkg && <span className="block text-xs text-ink-muted">{pkg.name} · {pkg.durationHours}h · {pkg.photographerCount} photographers</span>}</Kv>
            <Kv k="Event date"><span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-ink-faint" />{formatDate(b.eventDate, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</span></Kv>
            <Kv k="Location"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-ink-faint" />{b.location}</span></Kv>
            <Kv k="Guests"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-ink-faint" />{b.guestCount ?? '—'}</span></Kv>
            <div className="col-span-2"><Kv k="Customer requirements">{b.requirements || <span className="text-ink-faint">None provided</span>}</Kv></div>
          </section>
 
          <section className="rounded-xl border border-line p-3">
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Payment</h3><StatusBadge status={b.paymentStatus} /></div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><PaymentBar amount={b.amount} paid={b.paidAmount} currency="INR" locale="en-IN" /><span className="text-sm font-semibold tabular-nums">{money(b.amount)}</span></div>
            {balance > 0 && b.status !== 'rejected' && b.status !== 'cancelled' && (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = Number(amount); if (n > 0 && n <= balance) { pay.mutate(n, { onSuccess: () => setAmount('') }); } }}>
                <Input type="number" min={1} max={balance} step="any" inputMode="decimal" aria-label="Payment received" placeholder={`Amount received (max ${money(balance)})`} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <Button type="submit" variant="outline" loading={pay.isPending} disabled={!(Number(amount) > 0 && Number(amount) <= balance)}>Record</Button>
              </form>)}
          </section>
 
          <Assign b={b} />
 
          {b.eventId && <TLink to={`/admin/events?open=${b.eventId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-dark"><Send className="h-4 w-4" />Open linked event &amp; delivery</TLink>}
 
          <section>
            <h3 className="mb-2 text-sm font-semibold">Internal notes</h3>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) addNote.mutate(note); }}><Textarea rows={2} aria-label="New note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Call notes, quote changes…" /><Button type="submit" variant="dark" className="self-end" disabled={!note.trim()} loading={addNote.isPending}>Add</Button></form>
            <ul className="mt-2 space-y-2">{[...b.notes].reverse().map((n) => <li key={n.id} className="rounded-lg bg-paper p-2.5 text-sm"><p className="text-ink-2">{n.text}</p><p className="mt-0.5 text-[11px] text-ink-faint">{n.authorName} · {timeAgo(n.createdAt)}</p></li>)}</ul>
          </section>
          <ReasonDialog kind={reason} onClose={() => setReason(null)} loading={setStatus.isPending} onConfirm={(note) => setStatus.mutate({ status: reason!, note })} />
        </div>
      )}
    </Drawer>
  );
}
 
function ReasonDialog({ kind, onClose, onConfirm, loading }: { kind: 'rejected' | 'cancelled' | null; onClose: () => void; onConfirm: (note: string) => void; loading: boolean }) {
  const [text, setText] = useState('');
  return (
    <Modal open={!!kind} onClose={onClose} size="sm" title={kind === 'rejected' ? 'Reject this booking?' : 'Cancel this booking?'} subtitle="The customer is notified in their portal."
      footer={<><Button variant="outline" onClick={onClose}>Keep booking</Button><Button variant="danger" loading={loading} onClick={() => onConfirm(text.trim())}>{kind === 'rejected' ? 'Reject' : 'Cancel booking'}</Button></>}>
      <Field label="Reason shared with the customer (optional)"><Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. We are already booked on that date." /></Field>
    </Modal>
  );
}
 
/** Photographer assignment with availability + clash hints (informational — admin can still override). */
function Assign({ b }: { b: Booking }) {
  const ph = usePhotographerList(); const events = useEventList();
  const [sel, setSel] = useState<string[]>(b.assignedPhotographerIds);
  const save = useTenantMutation<string[], Booking>((t, ids) => services.bookings.assignPhotographers(t, b.id, ids), ['bookings', 'events', 'analytics', 'notifications'], { success: 'Team updated' });
  const busy = (p: Photographer) => events.data?.items.some((e) => e.date === b.eventDate && e.id !== b.eventId && e.status !== 'cancelled' && e.photographerIds.includes(p.id));
  const reason = (p: Photographer): string | null => {
    if (p.status !== 'active') return p.status === 'on_leave' ? 'On leave' : 'Inactive';
    if (p.availability.blockedDates.includes(b.eventDate)) return 'Blocked that day';
    if (!p.availability.weekdays.includes(new Date(b.eventDate).getDay())) return `Off on ${DAYS[new Date(b.eventDate).getDay()]}`;
    if (busy(p)) return 'Already booked that day';
    return null;
  };
  const dirty = sel.slice().sort().join() !== b.assignedPhotographerIds.slice().sort().join();
  return (
    <section>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Assigned photographers</h3>{dirty && <Button size="xs" loading={save.isPending} onClick={() => save.mutate(sel)}>Save team</Button>}</div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {ph.data?.items.map((p) => { const r = reason(p); const on = sel.includes(p.id); return (
          <li key={p.id}><label className={`flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 text-sm transition ${on ? 'border-brand bg-brand-soft/50' : 'border-line hover:bg-paper'} ${p.status !== 'active' ? 'opacity-60' : ''}`}>
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={on} onChange={() => setSel((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} />
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span><span className="block truncate text-[11px] text-ink-muted">{p.title}</span></span>
            {r && <Badge tone={on ? 'danger' : 'warning'} className="shrink-0"><AlertTriangle className="mr-0.5 h-3 w-3" />{r}</Badge>}
          </label></li>); })}
      </ul>
    </section>
  );
}
 
/* ------------------------------------------------------------ Create */
const schema = z.object({
  name: z.string().trim().min(2, 'Enter the customer name'), email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().regex(/^[+\d][\d\s()-]{6,}$/, 'Enter a valid phone number'),
  serviceId: z.string().min(1, 'Choose a service'), packageId: z.string().optional(),
  eventDate: z.string().min(1, 'Choose the event date'), location: z.string().trim().min(2, 'Enter the venue / city'),
  guestCount: z.number().int().min(0).optional().or(z.nan().transform(() => undefined)), amount: z.number().min(0, 'Enter an amount').or(z.nan().transform(() => 0)),
  requirements: z.string().max(1000).optional(), status: z.enum(['enquiry', 'pending', 'confirmed']),
});
type Form = z.infer<typeof schema>;
 
function NewBooking({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const svc = useServiceList(); const pkgs = usePackageList();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { status: 'confirmed', amount: 0, serviceId: '', packageId: '' } });
  const serviceId = watch('serviceId');
  const options = pkgs.data?.items.filter((p) => p.serviceId === serviceId && p.status === 'active') ?? [];
  const create = useTenantMutation<Form, Booking>((t, v) => services.bookings.create(t, {
    serviceId: v.serviceId, packageId: v.packageId || null, eventDate: v.eventDate, location: v.location, guestCount: v.guestCount ?? null, requirements: v.requirements ?? '', amount: v.amount, status: v.status, source: 'manual',
    customer: { name: v.name, email: v.email, phone: v.phone },
  }), ['bookings', 'analytics', 'events', 'clients'], { success: 'Booking created', onSuccess: (b) => onCreated(b.id) });
  const err = (k: keyof Form) => errors[k]?.message as string | undefined;
  return (
    <Modal open onClose={onClose} size="lg" title="New booking" subtitle="For phone, WhatsApp and walk-in customers. Website enquiries arrive automatically."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={create.isPending} onClick={handleSubmit((v) => create.mutate(v))}>Create booking</Button></>}>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate onSubmit={handleSubmit((v) => create.mutate(v))}>
        <Field label="Customer name" required error={err('name')}><Input invalid={!!errors.name} {...register('name')} /></Field>
        <Field label="Email" required error={err('email')}><Input type="email" invalid={!!errors.email} {...register('email')} /></Field>
        <Field label="Phone" required error={err('phone')}><Input type="tel" invalid={!!errors.phone} {...register('phone')} /></Field>
        <Field label="Service" required error={err('serviceId')}><Select invalid={!!errors.serviceId} {...register('serviceId', { onChange: () => { setValue('packageId', ''); } })}><option value="">Select…</option>{svc.data?.items.filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Package"><Select disabled={!serviceId} {...register('packageId', { onChange: (e) => { const p = options.find((x) => x.id === e.target.value); if (p) setValue('amount', p.price); } })}><option value="">Custom quote</option>{options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Amount" error={err('amount')}><Input type="number" min={0} step="any" invalid={!!errors.amount} {...register('amount', { valueAsNumber: true })} /></Field>
        <Field label="Event date" required error={err('eventDate')}><Input type="date" invalid={!!errors.eventDate} {...register('eventDate')} /></Field>
        <Field label="Guests"><Input type="number" min={0} {...register('guestCount', { valueAsNumber: true })} /></Field>
        <Field label="Venue / city" required error={err('location')} className="sm:col-span-2"><Input invalid={!!errors.location} {...register('location')} /></Field>
        <Field label="Requirements" className="sm:col-span-2"><Textarea rows={3} {...register('requirements')} /></Field>
        <Field label="Initial status"><Select {...register('status')}><option value="enquiry">Enquiry</option><option value="pending">Pending</option><option value="confirmed">Confirmed (creates event)</option></Select></Field>
      </form>
    </Modal>
  );
}