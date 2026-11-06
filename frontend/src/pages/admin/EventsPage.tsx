import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { CheckCheck, FolderOpen, MapPin, MessageSquarePlus, Save } from 'lucide-react';
import { useTenantMutation, useTenantQuery } from '@/hooks/data';
import { usePhotographerList } from '@/hooks/admin';
import { services } from '@/services/data-provider';
import { formatDate, timeAgo, titleCase } from '@/lib/utils';
import type { PhotographyProgress, StudioEvent } from '@/types';
import { CrudPage, type FieldDef } from '@/components/shared/CrudPage';
import { PhotographerStack } from '@/components/shared/Bits';
import { DeliveryTracker, DueBadge } from '@/components/shared/DeliveryTracker';
import { TLink } from '@/components/shared/TLink';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Drawer } from '@/components/ui/Modal';
import { ProgressStages } from '../client/ClientBookingsEvents';
import { CATEGORY_OPTIONS } from './adminUi';
 
const schema = z.object({
  title: z.string().trim().min(3, 'Enter an event title'), type: z.string().min(1, 'Choose a type'), date: z.string().min(1, 'Choose a date'), startTime: z.string().min(1, 'Choose a start time'),
  venue: z.string().trim().min(2, 'Enter the venue'), city: z.string().trim().min(2, 'Enter the city'), description: z.string().max(1000).optional(),
  photographerIds: z.array(z.string()), isPublic: z.boolean(), coverUrl: z.string().trim().url('Enter a valid image URL').or(z.literal('')).optional(), status: z.string().optional(),
});
type F = z.infer<typeof schema>;
const PROGRESS: PhotographyProgress[] = ['planned', 'shooting', 'wrapped', 'editing'];
 
export default function EventsPage() {
  const [sp, setSp] = useSearchParams(); const ph = usePhotographerList();
  const openId = sp.get('open');
  const fields: FieldDef[] = [
    { name: 'title', label: 'Event title', type: 'text', required: true, span: 2 },
    { name: 'type', label: 'Type', type: 'select', options: CATEGORY_OPTIONS, required: true }, { name: 'status', label: 'Status', type: 'select', options: [{ value: 'scheduled', label: 'Scheduled' }, { value: 'in_progress', label: 'In progress' }, { value: 'cancelled', label: 'Cancelled' }], hint: 'Use “Mark completed” in the event panel to start delivery.' },
    { name: 'date', label: 'Date', type: 'date', required: true }, { name: 'startTime', label: 'Start time', type: 'time', required: true },
    { name: 'venue', label: 'Venue', type: 'text', required: true }, { name: 'city', label: 'City', type: 'text', required: true },
    { name: 'description', label: 'Description / brief', type: 'textarea' },
    { name: 'photographerIds', label: 'Photographers', type: 'chips', options: (ph.data?.items ?? []).filter((p) => p.status === 'active').map((p) => ({ value: p.id, label: p.name })) },
    { name: 'coverUrl', label: 'Cover image', type: 'image' }, { name: 'isPublic', label: 'Show on the public Events page once completed', type: 'toggle' },
  ];
  return (
    <>
      <CrudPage<StudioEvent, F> title="Events" subtitle="Every shoot, its team, progress and delivery status." noun="event" queryKey="events" modalSize="lg"
        load={(t, p) => services.events.list(t, { ...p, sort: 'date', order: 'desc' })} create={(t, v) => services.events.create(t, v)} update={(t, id, v) => services.events.update(t, id, v)} remove={(t, id) => services.events.remove(t, id)}
        invalidate={['analytics', 'bookings']} searchPlaceholder="Search title, venue, city…" onRowClick={(e) => setSp({ open: e.id })}
        filters={[{ name: 'status', label: 'Status', options: ['scheduled', 'in_progress', 'completed', 'cancelled'].map((v) => ({ value: v, label: titleCase(v) })) }, { name: 'delivery', label: 'Delivery', options: ['pending', 'highlights_submitted', 'highlights_published', 'delivered'].map((v) => ({ value: v, label: titleCase(v) })) }]}
        columns={[
          { key: 't', header: 'Event', primary: true, cell: (e) => <div><p className="font-medium">{e.title}</p><p className="flex items-center gap-1 text-xs text-ink-muted"><MapPin className="h-3 w-3" />{e.venue}, {e.city}</p></div> },
          { key: 'd', header: 'Date', cell: (e) => <span className="whitespace-nowrap">{formatDate(e.date)}<span className="block text-xs text-ink-muted">{e.startTime}</span></span> },
          { key: 'team', header: 'Team', hideBelow: 'lg', cell: (e) => <PhotographerStack ids={e.photographerIds} all={ph.data?.items ?? []} /> },
          { key: 'p', header: 'Progress', hideBelow: 'xl', cell: (e) => <Badge tone="neutral">{titleCase(e.progress)}</Badge> },
          { key: 'dl', header: 'Delivery', hideBelow: 'lg', cell: (e) => e.status === 'completed' ? <div className="flex flex-col items-start gap-1"><StatusBadge status={e.delivery.status} /><DueBadge delivery={e.delivery} /></div> : <span className="text-xs text-ink-faint">—</span> },
          { key: 's', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
        ]}
        fields={fields} schema={schema as never}
        defaults={(e) => ({ title: e?.title ?? '', type: e?.type ?? 'wedding', date: e?.date ?? '', startTime: e?.startTime ?? '10:00', venue: e?.venue ?? '', city: e?.city ?? '', description: e?.description ?? '', photographerIds: e?.photographerIds ?? [], isPublic: e?.isPublic ?? false, coverUrl: e?.coverUrl ?? '', status: e && e.status !== 'completed' ? e.status : e ? '' : 'scheduled' })}
        toPayload={(v, row) => { const { status, ...rest } = v; return row?.status === 'completed' || !status ? rest : { ...rest, status }; }} />
      {openId && <EventDrawer id={openId} onClose={() => setSp({})} />}
    </>
  );
}
 
function EventDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useTenantQuery(['events', 'detail', id], (t) => services.events.get(t, id));
  const gq = useTenantQuery(['galleries', 'event', id], (t) => services.galleries.listByEvent(t, id));
  const ph = usePhotographerList();
  const e = q.data;
  const inv = ['events', 'analytics', 'bookings', 'notifications', 'galleries'];
  const progress = useTenantMutation<PhotographyProgress, StudioEvent>((t, p) => services.events.updateProgress(t, id, p), inv, { success: 'Progress updated' });
  const complete = useTenantMutation<void, StudioEvent>((t) => services.events.markCompleted(t, id), inv, { success: 'Event marked completed — delivery clock started' });
  const [hours, setHours] = useState<string>(''); const [dnote, setDnote] = useState<string | null>(null); const [note, setNote] = useState('');
  const delivery = useTenantMutation<{ targetHours?: number; notes?: string }, StudioEvent>((t, p) => services.events.updateDelivery(t, id, p), ['events'], { success: 'Delivery settings saved' });
  const addNote = useTenantMutation<string, unknown>((t, s) => services.events.addNote(t, id, s), ['events'], { onSuccess: () => setNote('') });
  return (
    <Drawer open onClose={onClose} width="max-w-xl" title={e ? <span className="flex items-center gap-2">{e.title}<StatusBadge status={e.status} /></span> : 'Event'} subtitle={e ? `${formatDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${e.startTime} · ${e.venue}, ${e.city}` : undefined}>
      {q.isLoading ? <Skeleton className="h-64" /> : q.error || !e ? <ErrorState error={q.error ?? new Error('Not found')} onRetry={() => q.refetch()} /> : (
        <div className="space-y-5">
          <section className="space-y-3 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Shoot progress</h3>
              {e.status !== 'completed' && e.status !== 'cancelled' && <Button size="xs" variant="success" icon={<CheckCheck className="h-3.5 w-3.5" />} loading={complete.isPending} onClick={() => complete.mutate()}>Mark completed</Button>}</div>
            <ProgressStages progress={e.progress} />
            {e.status !== 'cancelled' && e.progress !== 'delivered' && (
              <Select aria-label="Set progress" value={e.progress} onChange={(ev) => progress.mutate(ev.target.value as PhotographyProgress)} disabled={progress.isPending}>
                {PROGRESS.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}</Select>)}
            <div className="flex items-center gap-2 text-xs text-ink-muted"><span>Team:</span><PhotographerStack ids={e.photographerIds} all={ph.data?.items ?? []} size={24} /><span>{e.photographerIds.map((i) => ph.data?.items.find((p) => p.id === i)?.name).filter(Boolean).join(', ') || 'Nobody assigned yet — edit the event to assign'}</span></div>
          </section>
 
          <section className="space-y-3 rounded-xl border border-line p-3">
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Photo delivery</h3><DueBadge delivery={e.delivery} /></div>
            <DeliveryTracker delivery={e.delivery} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
              <Field label="Target (hours)"><Input type="number" min={1} max={720} value={hours || String(e.delivery.targetHours)} onChange={(ev) => setHours(ev.target.value)} /></Field>
              <Field label="Note shown to the client"><Input value={dnote ?? e.delivery.notes} onChange={(ev) => setDnote(ev.target.value)} placeholder="e.g. Highlights tomorrow evening" maxLength={240} /></Field>
              <Button variant="outline" icon={<Save className="h-4 w-4" />} loading={delivery.isPending} onClick={() => delivery.mutate({ targetHours: hours ? Number(hours) : undefined, notes: dnote ?? undefined })}>Save</Button>
            </div>
            <p className="text-[11px] text-ink-faint">Overdue only flags the board — a gallery is never marked delivered automatically.</p>
            <div className="flex flex-wrap gap-2"><TLink to="/admin/delivery" className="text-xs font-semibold text-brand-dark">Open delivery board →</TLink>
              {gq.data?.map((g) => <TLink key={g.id} to={`/admin/galleries?open=${g.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark"><FolderOpen className="h-3.5 w-3.5" />{g.title}</TLink>)}
              {gq.data?.length === 0 && <span className="text-xs text-ink-muted">No gallery yet — the photographer or you can create one.</span>}</div>
          </section>
 
          {e.description && <section><h3 className="mb-1 text-sm font-semibold">Brief</h3><p className="text-sm text-ink-2">{e.description}</p></section>}
          {e.bookingId && <TLink to={`/admin/bookings?open=${e.bookingId}`} className="inline-block text-sm font-semibold text-brand-dark">Open linked booking →</TLink>}
 
          <section>
            <h3 className="mb-2 text-sm font-semibold">Team notes</h3>
            <form className="flex gap-2" onSubmit={(ev) => { ev.preventDefault(); if (note.trim()) addNote.mutate(note); }}><Textarea rows={2} aria-label="New note" value={note} onChange={(ev) => setNote(ev.target.value)} /><Button type="submit" variant="dark" className="self-end" disabled={!note.trim()} loading={addNote.isPending} icon={<MessageSquarePlus className="h-4 w-4" />}>Add</Button></form>
            <ul className="mt-2 space-y-2">{[...e.notes].reverse().map((n) => <li key={n.id} className="rounded-lg bg-paper p-2.5 text-sm"><p className="text-ink-2">{n.text}</p><p className="mt-0.5 text-[11px] text-ink-faint">{n.authorName} · {titleCase(n.authorRole)} · {timeAgo(n.createdAt)}</p></li>)}</ul>
          </section>
        </div>
      )}
    </Drawer>
  );
}