import { useState } from 'react';
import { z } from 'zod';
import { Mail, MapPin, Phone } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { formatDate, pluralize, titleCase } from '@/lib/utils';
import type { Client } from '@/types';
import { CrudPage } from '@/components/shared/CrudPage';
import { Kv } from '@/components/shared/Bits';
import { TLink } from '@/components/shared/TLink';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Drawer } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/SmartImage';
 
const SOURCES = ['website', 'whatsapp', 'referral', 'walk-in'];
const schema = z.object({ name: z.string().trim().min(2, 'Enter a name'), email: z.string().trim().email('Enter a valid email'), phone: z.string().trim().regex(/^[+\d][\d\s()-]{6,}$/, 'Enter a valid phone number'), city: z.string().max(80).optional(), source: z.string().min(1), notes: z.string().max(1000).optional() });
type F = z.infer<typeof schema>;
 
export default function CustomersPage() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      <CrudPage<Client, F> title="Customers" subtitle="Everyone who has booked or enquired — with their full history." noun="customer" queryKey="clients" invalidate={['analytics']}
        load={(t, p) => services.clients.list(t, p)} create={(t, v) => services.clients.create(t, v)} update={(t, id, v) => services.clients.update(t, id, v)} remove={(t, id) => services.clients.remove(t, id)}
        onRowClick={(c) => setOpen(c.id)} searchPlaceholder="Search name, email, phone, city…"
        deleteBody={(c) => <>Delete <b>{c.name}</b>? Their bookings stay in your records but are no longer linked to a customer profile.</>}
        columns={[
          { key: 'n', header: 'Customer', primary: true, cell: (c) => <div className="flex items-center gap-2.5"><Avatar name={c.name} size={32} /><div><p className="font-medium">{c.name}</p><p className="text-xs text-ink-muted">{c.email}</p></div></div> },
          { key: 'p', header: 'Phone', hideBelow: 'lg', cell: (c) => c.phone }, { key: 'c', header: 'City', hideBelow: 'lg', cell: (c) => c.city || '—' },
          { key: 's', header: 'Source', hideBelow: 'xl', cell: (c) => <Badge>{titleCase(c.source)}</Badge> }, { key: 'j', header: 'Customer since', hideBelow: 'xl', cell: (c) => formatDate(c.createdAt) },
        ]}
        fields={[{ name: 'name', label: 'Full name', type: 'text', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', type: 'text', required: true }, { name: 'city', label: 'City', type: 'text' }, { name: 'source', label: 'How they found you', type: 'select', options: SOURCES.map((s) => ({ value: s, label: titleCase(s) })) }, { name: 'notes', label: 'Private notes', type: 'textarea', rows: 3 }]}
        schema={schema as never} defaults={(c) => ({ name: c?.name ?? '', email: c?.email ?? '', phone: c?.phone ?? '', city: c?.city ?? '', source: c?.source ?? 'walk-in', notes: c?.notes ?? '' })} />
      {open && <Profile id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
  
function Profile({ id, onClose }: { id: string; onClose: () => void }) {
  const { money } = useTenant();
  const q = useTenantQuery(['clients', 'profile', id], (t) => services.clients.profile(t, id));
  const d = q.data;
  const lifetime = d?.bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'rejected').reduce((s, b) => s + b.paidAmount, 0) ?? 0;
  return (
    <Drawer open onClose={onClose} width="max-w-xl" title={d?.client.name ?? 'Customer'} subtitle={d ? `Customer since ${formatDate(d.client.createdAt)} · ${titleCase(d.client.source)}` : undefined}>
      {q.isLoading ? <Skeleton className="h-64" /> : q.error || !d ? <ErrorState error={q.error ?? new Error('Not found')} onRetry={() => q.refetch()} /> : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Kv k="Email"><a className="flex items-center gap-1 text-brand-dark" href={`mailto:${d.client.email}`}><Mail className="h-3.5 w-3.5" />{d.client.email}</a></Kv>
            <Kv k="Phone"><a className="flex items-center gap-1" href={`tel:${d.client.phone}`}><Phone className="h-3.5 w-3.5 text-ink-faint" />{d.client.phone}</a></Kv>
            <Kv k="City"><span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-ink-faint" />{d.client.city || '—'}</span></Kv>
            <Kv k="Lifetime payments"><span className="font-semibold tabular-nums">{money(lifetime)}</span></Kv>
            {d.client.notes && <div className="col-span-2"><Kv k="Private notes">{d.client.notes}</Kv></div>}
          </div>
          <section><h3 className="mb-2 text-sm font-semibold">Bookings ({d.bookings.length})</h3>
            {d.bookings.length === 0 ? <p className="text-sm text-ink-muted">No bookings yet.</p> : <ul className="divide-y divide-line rounded-xl border border-line">{d.bookings.map((b) => <li key={b.id}><TLink to={`/admin/bookings?open=${b.id}`} className="flex items-center gap-3 p-3 hover:bg-paper/70"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{b.reference}</p><p className="text-xs text-ink-muted">{formatDate(b.eventDate)} · {b.location}</p></div><div className="text-right"><p className="text-sm font-medium tabular-nums">{money(b.amount)}</p><StatusBadge status={b.status} /></div></TLink></li>)}</ul>}</section>
          <section><h3 className="mb-2 text-sm font-semibold">Events ({d.events.length})</h3>
            {d.events.length === 0 ? <p className="text-sm text-ink-muted">No events yet.</p> : <ul className="divide-y divide-line rounded-xl border border-line">{d.events.map((e) => <li key={e.id}><TLink to={`/admin/events?open=${e.id}`} className="flex items-center gap-3 p-3 hover:bg-paper/70"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.title}</p><p className="text-xs text-ink-muted">{formatDate(e.date)} · {pluralize(e.photographerIds.length, 'photographer')}</p></div><StatusBadge status={e.delivery.status === 'not_due' ? e.status : e.delivery.status} /></TLink></li>)}</ul>}</section>
        </div>
      )}
    </Drawer>
  );
}