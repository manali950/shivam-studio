import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Camera, ImagePlus, Lock, MessageSquarePlus, Play, Plus, Send } from 'lucide-react';
import { useTenantMutation, useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils';
import type { Gallery, PhotographyProgress, StudioEvent } from '@/types';
import { Kv, PhotographerStack } from '@/components/shared/Bits';
import { DeliveryTracker, DueBadge } from '@/components/shared/DeliveryTracker';
import { TLink } from '@/components/shared/TLink';
import { Lightbox } from '@/components/shared/Lightbox';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Field, Textarea } from '@/components/ui/Form';
import { useAllPhotographers, useCatalogue } from '../client/clientData';
import { ProgressStages } from '../client/ClientBookingsEvents';
import { useMyBookings } from './photographerData';
import { AddPhotos, DeliveryLinks, PhotoTile } from '@/components/shared/GalleryParts';
 
const NEXT: Partial<Record<PhotographyProgress, { to: PhotographyProgress; label: string; hint: string }>> = {
  planned: { to: 'shooting', label: 'Start shoot', hint: 'Marks the event as in progress.' },
  shooting: { to: 'wrapped', label: 'Mark shoot wrapped', hint: 'Completes the event and starts the delivery clock.' },
  wrapped: { to: 'editing', label: 'Start editing', hint: 'Let the studio know post-production has begun.' },
};
 
export default function PhotographerEventDetail() {
  const { id = '' } = useParams();
  const q = useTenantQuery(['events', 'detail', id], (t) => services.events.get(t, id));
  const gq = useTenantQuery(['galleries', 'event', id], (t) => services.galleries.listByEvent(t, id));
  const bq = useMyBookings(); const ph = useAllPhotographers(); const cat = useCatalogue();
  const e = q.data;
  const booking = bq.data?.items.find((b) => b.id === e?.bookingId || b.eventId === id);
  const gallery = gq.data?.[0];
 
  if (q.isLoading) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>;
  if (q.error || !e) return <ErrorState error={q.error ?? new Error('Event not found')} onRetry={() => q.refetch()} />;
 
  return (
    <div className="space-y-4">
      <div>
        <TLink to="/photographer/events" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"><ArrowLeft className="h-3.5 w-3.5" />My events</TLink>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{e.title}</h1><StatusBadge status={e.status} /></div>
            <p className="mt-1 text-sm text-ink-muted">{formatDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {e.startTime} · {e.venue}, {e.city}</p></div>
          <DueBadge delivery={e.delivery} />
        </div>
      </div>
 
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <ProgressCard e={e} />
          <GalleryCard e={e} summaryId={gallery?.id} loading={gq.isLoading} />
          <NotesCard e={e} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Shoot details" />
            <dl className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-1">
              <Kv k="Service">{booking ? cat.service(booking.serviceId) : <span className="capitalize">{e.type}</span>}</Kv>
              {booking && <Kv k="Client">{booking.customer.name}<span className="block text-xs text-ink-muted">{booking.customer.phone}</span></Kv>}
              {booking && <Kv k="Guests">{booking.guestCount ?? '—'}</Kv>}
              <Kv k="Venue">{e.venue}, {e.city}</Kv>
              <Kv k="Team"><PhotographerStack ids={e.photographerIds} all={ph.data?.items ?? []} size={28} /><span className="mt-1 block text-xs text-ink-muted">{e.photographerIds.map((i) => ph.data?.items.find((p) => p.id === i)?.name).filter(Boolean).join(', ')}</span></Kv>
              {(booking?.requirements || e.description) && <div className="sm:col-span-2 xl:col-span-1"><Kv k="Brief">{booking?.requirements || e.description}</Kv></div>}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Delivery timeline" subtitle={`Target: highlights within ${e.delivery.targetHours}h of completion`} />
            <div className="space-y-3 p-4">
              <DeliveryTracker delivery={e.delivery} compact />
              {e.delivery.completedAt && <p className="text-xs text-ink-muted">Shoot completed {formatDateTime(e.delivery.completedAt)}</p>}
              {e.delivery.notes && <p className="rounded-lg bg-paper-2 p-2.5 text-xs text-ink-2">{e.delivery.notes}</p>}
              <p className="text-[11px] text-ink-faint">The studio reviews and publishes highlights. Deadlines are informational — nothing is marked delivered automatically.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
 
function ProgressCard({ e }: { e: StudioEvent }) {
  const step = NEXT[e.progress];
  const m = useTenantMutation<PhotographyProgress, StudioEvent>((t, p) => services.events.updateProgress(t, e.id, p), ['events', 'galleries'], { success: 'Progress updated' });
  return (
    <Card>
      <CardHeader title="Shoot progress" subtitle="Update this as you go — clients see it live in their portal." />
      <div className="space-y-4 p-4">
        <ProgressStages progress={e.progress} />
        {e.status === 'cancelled' ? <p className="text-sm text-ink-muted">This event was cancelled.</p> : step ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper p-3">
            <p className="text-xs text-ink-muted">{step.hint}</p>
            <Button icon={<Play className="h-4 w-4" />} onClick={() => m.mutate(step.to)} loading={m.isPending}>{step.label}</Button>
          </div>
        ) : <p className="text-sm text-ink-2">{e.progress === 'delivered' ? 'This event has been delivered. Great work.' : 'Post-production is under way. Select and submit highlights below.'}</p>}
      </div>
    </Card>
  );
}
 
function GalleryCard({ e, summaryId, loading }: { e: StudioEvent; summaryId?: string; loading: boolean }) {
  const create = useTenantMutation<void, Gallery>((t) => services.galleries.create(t, { title: `${e.title} — photographs`, eventId: e.id }), ['galleries'], { success: 'Gallery created' });
  if (loading) return <Skeleton className="h-64 rounded-xl" />;
  if (!summaryId) return (
    <Card><CardHeader title="Photographs & highlights" />
      <div className="p-4"><EmptyState icon={<Camera className="h-5 w-5" />} title="No gallery for this event yet" body="Create a gallery, add your photographs, then pick the next-day highlights." action={<Button icon={<Plus className="h-4 w-4" />} onClick={() => create.mutate()} loading={create.isPending}>Create gallery</Button>} /></div></Card>
  );
  return <GalleryEditor e={e} id={summaryId} />;
}
 
function GalleryEditor({ e, id }: { e: StudioEvent; id: string }) {
  const q = useTenantQuery(['galleries', 'detail', id], (t) => services.galleries.get(t, id));
  const g = q.data;
  const [sel, setSel] = useState<Set<string>>(new Set()); const [note, setNote] = useState(e.delivery.notes ?? '');
  const [adding, setAdding] = useState(false); const [light, setLight] = useState<number | null>(null);
  useEffect(() => { if (g) setSel(new Set(g.photos.filter((p) => p.isHighlight).map((p) => p.id))); }, [g?.id, g?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
 
  const submit = useTenantMutation<void, Gallery>((t) => services.galleries.submitHighlights(t, id, [...sel], note), ['galleries', 'events'], { success: 'Highlights submitted for studio review' });
  const delivered = !!g?.completePublishedAt; const published = !!g?.highlightsPublishedAt;
  const photos = g?.photos ?? [];
  const toggle = (pid: string) => setSel((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  const canSubmit = e.status === 'completed' && !published && !delivered && sel.size > 0;
  const status = delivered ? <Badge tone="success">Complete gallery published</Badge> : published ? <Badge tone="success">Highlights live</Badge> : g?.highlightsSubmittedAt ? <Badge tone="info">In studio review · {timeAgo(g.highlightsSubmittedAt)}</Badge> : <Badge tone="warning">Not submitted</Badge>;
 
  return (
    <Card>
      <CardHeader title="Photographs & highlights" subtitle={g ? `${photos.length} photographs · ${sel.size} selected as highlights` : undefined} action={<div className="flex items-center gap-2">{status}{!delivered && <Button size="sm" variant="outline" icon={<ImagePlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add photos</Button>}</div>} />
      <div className="space-y-4 p-4">
        {q.isLoading ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
          : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} />
          : photos.length === 0 ? <EmptyState icon={<ImagePlus className="h-5 w-5" />} title="No photographs yet" body="Add photographs to start selecting highlights." action={<Button onClick={() => setAdding(true)} icon={<ImagePlus className="h-4 w-4" />}>Add photos</Button>} />
          : (
            <>
              <p className="text-xs text-ink-muted">{delivered || published ? 'Highlights are live, so the selection is locked.' : 'Tap the star to mark a photograph as a next-day highlight. Click an image to preview it.'}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p, i) => <PhotoTile key={p.id} p={p} on={sel.has(p.id)} locked={published || delivered} onToggle={() => toggle(p.id)} onOpen={() => setLight(i)} />)}
              </div>
            </>
          )}
 
        {photos.length > 0 && !delivered && (
          <div className="space-y-3 border-t border-line pt-4">
            {!published && (
              <>
                <Field label="Note to the studio (optional)" hint="Mention favourites, edits you want prioritised, or anything the client should know."><Textarea rows={2} value={note} onChange={(ev) => setNote(ev.target.value)} maxLength={500} /></Field>
                {e.status !== 'completed' && <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800"><Lock className="h-3.5 w-3.5" />Mark the shoot as wrapped before submitting highlights.</p>}
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-ink-muted">{sel.size === 0 ? 'Select at least one highlight.' : `${sel.size} highlight${sel.size === 1 ? '' : 's'} will be sent for review.`}</p>
                  <Button icon={<Send className="h-4 w-4" />} disabled={!canSubmit} loading={submit.isPending} onClick={() => submit.mutate()}>{g?.highlightsSubmittedAt ? 'Resubmit highlights' : 'Submit highlights'}</Button></div>
              </>
            )}
          </div>
        )}
        {g && !delivered && <DeliveryLinks g={g} />}
      </div>
      <AddPhotos open={adding} onClose={() => setAdding(false)} galleryId={id} existing={photos} />
      {light !== null && <Lightbox photos={photos.map((p) => ({ ...p, galleryTitle: g?.title }))} index={light} onIndex={setLight} onClose={() => setLight(null)} />}
    </Card>
  );
}
 
function NotesCard({ e }: { e: StudioEvent }) {
  const [text, setText] = useState('');
  const add = useTenantMutation<string, unknown>((t, s) => services.events.addNote(t, e.id, s), ['events'], { onSuccess: () => setText(''), success: 'Note added' });
  const notes = [...e.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Card>
      <CardHeader title="Notes" subtitle="Visible to the studio team and other photographers on this event" />
      <div className="space-y-3 p-4">
        <form onSubmit={(ev) => { ev.preventDefault(); if (text.trim()) add.mutate(text); }} className="flex gap-2">
          <Textarea aria-label="New note" rows={2} value={text} onChange={(ev) => setText(ev.target.value)} placeholder="Shot list changes, venue access, gear issues…" maxLength={600} className="flex-1" />
          <Button type="submit" variant="dark" className="self-end" disabled={!text.trim()} loading={add.isPending} icon={<MessageSquarePlus className="h-4 w-4" />}>Add</Button>
        </form>
        {notes.length === 0 ? <p className="text-sm text-ink-muted">No notes yet.</p> : <ul className="space-y-2">{notes.map((n) => <li key={n.id} className="rounded-lg bg-paper p-3"><p className="text-sm text-ink-2">{n.text}</p><p className="mt-1 text-[11px] text-ink-faint">{n.authorName} · {timeAgo(n.createdAt)}</p></li>)}</ul>}
      </div>
    </Card>
  );
}