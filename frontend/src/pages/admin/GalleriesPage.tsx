import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { keepPreviousData } from '@tanstack/react-query';
import { CheckCircle2, ImagePlus, Images, Pencil, Plus, Send, Sparkles, Star, Trash2 } from 'lucide-react';
import { useTenantMutation, useTenantQuery } from '@/hooks/data';
import { useDebounce } from '@/hooks/useDebounce';
import { useEventList } from '@/hooks/admin';
import { services } from '@/services/data-provider';
import { cn, formatDateTime, pluralize, timeAgo, titleCase } from '@/lib/utils';
import type { Gallery, GallerySummary } from '@/types';
import { AddPhotos, DeliveryLinks } from '@/components/shared/GalleryParts';
import { Lightbox } from '@/components/shared/Lightbox';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/Card';
import { Pagination, SearchInput } from '@/components/ui/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { Field, Input, Select, Textarea } from '@/components/ui/Form';
import { ConfirmDialog, Drawer, Modal } from '@/components/ui/Modal';
import { SmartImage } from '@/components/ui/SmartImage';
 
const stage = (g: Pick<GallerySummary, 'highlightsSubmittedAt' | 'highlightsPublishedAt' | 'completePublishedAt'>) =>
  g.completePublishedAt ? { label: 'Delivered', tone: 'success' as const } : g.highlightsPublishedAt ? { label: 'Highlights live', tone: 'info' as const } : g.highlightsSubmittedAt ? { label: 'Highlights in review', tone: 'warning' as const } : { label: 'Draft', tone: 'neutral' as const };
 
export default function GalleriesPage() {
  const [sp, setSp] = useSearchParams();
  const [search, setSearch] = useState(''); const q = useDebounce(search); const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const [form, setForm] = useState<GallerySummary | 'new' | null>(sp.get('new') === '1' ? 'new' : null);
  const params = useMemo(() => ({ page, pageSize: 12, search: q || undefined, status: (status || undefined) as never }), [page, q, status]);
  const list = useTenantQuery(['galleries', 'list', params], (t) => services.galleries.list(t, params), { placeholderData: keepPreviousData } as never);
  const openId = sp.get('open');
  const setOpen = (id: string | null) => { const n = new URLSearchParams(sp); if (id) n.set('open', id); else n.delete('open'); n.delete('new'); setSp(n, { replace: true }); };
  return (
    <div>
      <PageHeader title="Galleries" subtitle="Photographs by event: highlights, complete galleries and Google Drive links." actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm('new')}>New gallery</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search galleries…" className="w-full sm:w-64" />
        <Select aria-label="Stage" className="w-auto min-w-[10rem]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Stage: all</option><option value="highlights_pending">Highlights not live</option><option value="highlights_published">Highlights live</option><option value="complete">Delivered</option></Select>
        <span className="ml-auto text-xs text-ink-muted">{list.data ? pluralize(list.data.total, 'gallery', 'galleries') : ''}</span>
      </div>
      {list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : list.isLoading ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
        : list.data!.items.length === 0 ? <EmptyState icon={<Images className="h-5 w-5" />} title="No galleries yet" body="Create a gallery for an event, add photographs and publish highlights." action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setForm('new')}>New gallery</Button>} /> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.data!.items.map((g) => { const st = stage(g); return (
              <button key={g.id} onClick={() => setOpen(g.id)} className="card group overflow-hidden text-left transition hover:border-brand/50 hover:shadow-pop">
                <div className="grid h-32 grid-cols-4 gap-0.5 bg-paper-2">{(g.previewUrls.length ? g.previewUrls : [g.coverUrl]).slice(0, 4).map((u, i) => <SmartImage key={i} src={u} alt="" width={240} className={cn('h-32', g.previewUrls.length <= 1 ? 'col-span-4' : i === 0 ? 'col-span-2 row-span-1' : '')} />)}</div>
                <div className="space-y-1.5 p-3"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-semibold leading-snug">{g.title}</p><Badge tone={st.tone} className="shrink-0">{st.label}</Badge></div>
                  <p className="text-xs text-ink-muted">{pluralize(g.photoCount, 'photo')} · {g.highlightCount} highlights · {titleCase(g.visibility)}</p>
                  <p className="text-[11px] text-ink-faint">Updated {timeAgo(g.updatedAt)}{g.externalLinks.length > 0 && ` · ${pluralize(g.externalLinks.length, 'link')}`}</p></div>
              </button>); })}
          </div>)}
      {list.data && <div className="mt-3"><Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={setPage} /></div>}
      {openId && <GalleryDrawer id={openId} onClose={() => setOpen(null)} onEdit={(g) => setForm(g)} />}
      {form && <GalleryForm row={form === 'new' ? null : form} onClose={() => { setForm(null); const n = new URLSearchParams(sp); n.delete('new'); setSp(n, { replace: true }); }} onSaved={(g) => { setForm(null); setOpen(g.id); }} />}
    </div>
  );
}
 
const schema = z.object({ title: z.string().trim().min(3, 'Enter a gallery title'), description: z.string().max(500).optional(), eventId: z.string().optional(), visibility: z.enum(['private', 'client', 'public']) });
type F = z.infer<typeof schema>;
function GalleryForm({ row, onClose, onSaved }: { row: GallerySummary | null; onClose: () => void; onSaved: (g: Gallery) => void }) {
  const events = useEventList();
  const { register, handleSubmit, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema), defaultValues: { title: row?.title ?? '', description: row?.description ?? '', eventId: row?.eventId ?? '', visibility: row?.visibility ?? 'client' } });
  const save = useTenantMutation<F, Gallery>((t, v) => (row ? services.galleries.update(t, row.id, { title: v.title, description: v.description, visibility: v.visibility }) : services.galleries.create(t, { ...v, eventId: v.eventId || null })), ['galleries'], { success: 'Gallery saved', onSuccess: onSaved });
  return (
    <Modal open onClose={onClose} title={row ? 'Edit gallery' : 'New gallery'} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={handleSubmit((v) => save.mutate(v))}>{row ? 'Save changes' : 'Create gallery'}</Button></>}>
      <form className="space-y-3" noValidate onSubmit={handleSubmit((v) => save.mutate(v))}>
        <Field label="Title" required error={errors.title?.message}><Input invalid={!!errors.title} {...register('title')} /></Field>
        {!row && <Field label="Event" hint="Link a gallery to an event so it joins the delivery workflow and reaches the right customer."><Select {...register('eventId')}><option value="">No event (portfolio / general)</option>{events.data?.items.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</Select></Field>}
        <Field label="Visibility" hint="Private: staff only · Client: the customer once photos are published · Public: also in the website portfolio."><Select {...register('visibility')}><option value="private">Private</option><option value="client">Client</option><option value="public">Public portfolio</option></Select></Field>
        <Field label="Description"><Textarea rows={3} {...register('description')} /></Field>
      </form>
    </Modal>
  );
}
 
function GalleryDrawer({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (g: GallerySummary) => void }) {
  const q = useTenantQuery(['galleries', 'detail', id], (t) => services.galleries.get(t, id));
  const g = q.data;
  const inv = ['galleries', 'events', 'analytics', 'notifications'];
  const toggle = useTenantMutation<{ pid: string; on: boolean }, Gallery>((t, a) => services.galleries.updatePhoto(t, id, a.pid, { isHighlight: a.on }), ['galleries']);
  const del = useTenantMutation<string, Gallery>((t, pid) => services.galleries.removePhoto(t, id, pid), ['galleries'], { success: 'Photo removed' });
  const pubH = useTenantMutation<void, Gallery>((t) => services.galleries.publishHighlights(t, id), inv, { success: 'Highlights published — client notified' });
  const pubC = useTenantMutation<void, Gallery>((t) => services.galleries.publishComplete(t, id), inv, { success: 'Complete gallery published — event delivered' });
  const rm = useTenantMutation<void, void>((t) => services.galleries.remove(t, id), inv, { success: 'Gallery deleted', onSuccess: onClose });
  const [adding, setAdding] = useState(false); const [confirm, setConfirm] = useState(false); const [light, setLight] = useState<number | null>(null);
  const hl = g?.photos.filter((p) => p.isHighlight).length ?? 0;
  const st = g ? stage(g) : null;
  return (
    <Drawer open onClose={onClose} width="max-w-4xl" title={g ? <span className="flex items-center gap-2">{g.title}{st && <Badge tone={st.tone}>{st.label}</Badge>}</span> : 'Gallery'} subtitle={g ? `${pluralize(g.photos.length, 'photograph')} · ${hl} highlights · ${titleCase(g.visibility)}` : undefined}>
      {q.isLoading ? <Skeleton className="h-64" /> : q.error || !g ? <ErrorState error={q.error ?? new Error('Not found')} onRetry={() => q.refetch()} /> : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" icon={<ImagePlus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add photos</Button>
            <Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(g)}>Edit details</Button>
            <Button size="sm" variant="ghost" className="text-red-600" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm(true)}>Delete</Button>
          </div>
 
          <section className="rounded-xl border border-line p-3">
            <h3 className="mb-2 text-sm font-semibold">Release to client</h3>
            <ol className="grid gap-2 text-xs sm:grid-cols-3">
              <li className="rounded-lg bg-paper p-2.5"><p className="font-semibold">1 · Photographer submits</p><p className="text-ink-muted">{g.highlightsSubmittedAt ? `Submitted ${formatDateTime(g.highlightsSubmittedAt)}` : 'Waiting — or mark highlights yourself below'}</p></li>
              <li className="rounded-lg bg-paper p-2.5"><p className="font-semibold">2 · Publish highlights</p><p className="mb-2 text-ink-muted">{g.highlightsPublishedAt ? `Live since ${formatDateTime(g.highlightsPublishedAt)}` : `${hl} selected`}</p>
                {!g.highlightsPublishedAt && <Button size="xs" icon={<Sparkles className="h-3.5 w-3.5" />} disabled={hl === 0 || !g.highlightsSubmittedAt} loading={pubH.isPending} onClick={() => pubH.mutate()}>Publish highlights</Button>}
                {!g.highlightsPublishedAt && !g.highlightsSubmittedAt && g.eventId && <p className="mt-1 text-[11px] text-amber-700">Needs photographer submission.</p>}</li>
              <li className="rounded-lg bg-paper p-2.5"><p className="font-semibold">3 · Publish complete gallery</p><p className="mb-2 text-ink-muted">{g.completePublishedAt ? `Delivered ${formatDateTime(g.completePublishedAt)}` : `${g.photos.length} photos ready`}</p>
                {!g.completePublishedAt && <Button size="xs" variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} disabled={g.photos.length === 0 || !g.eventId} loading={pubC.isPending} onClick={() => pubC.mutate()}>Publish all</Button>}</li>
            </ol>
            {!g.eventId && <p className="mt-2 text-[11px] text-ink-muted">Publishing steps apply to galleries linked to an event. Unlinked galleries stay as portfolio / general albums.</p>}
          </section>
 
          <section>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Photographs</h3><p className="text-xs text-ink-muted">Star = next-day highlight</p></div>
            {g.photos.length === 0 ? <EmptyState icon={<ImagePlus className="h-5 w-5" />} title="No photographs yet" action={<Button size="sm" onClick={() => setAdding(true)}>Add photos</Button>} /> : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {g.photos.map((p, i) => (
                  <div key={p.id} className={cn('group relative overflow-hidden rounded-lg ring-2 ring-offset-1', p.isHighlight ? 'ring-brand' : 'ring-transparent')}>
                    <button onClick={() => setLight(i)} className="block w-full" aria-label={`Preview ${p.title}`}><SmartImage src={p.url} alt={p.title} ratio="1/1" width={260} className="w-full" /></button>
                    <button aria-pressed={p.isHighlight} aria-label={p.isHighlight ? `Remove ${p.title} from highlights` : `Mark ${p.title} as highlight`} onClick={() => toggle.mutate({ pid: p.id, on: !p.isHighlight })} className={cn('absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full shadow', p.isHighlight ? 'bg-brand text-brand-contrast' : 'bg-white/90 text-ink-muted hover:text-ink')}><Star className={cn('h-3.5 w-3.5', p.isHighlight && 'fill-current')} /></button>
                    <IconButton label={`Remove ${p.title}`} onClick={() => del.mutate(p.id)} className="absolute bottom-1 right-1 !h-7 !w-7 bg-white/90 opacity-0 hover:!text-red-600 focus:opacity-100 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></IconButton>
                  </div>))}
              </div>)}
          </section>
 
          <DeliveryLinks g={g} />
          <p className="flex items-center gap-1.5 text-[11px] text-ink-faint"><Send className="h-3 w-3" />Customers only ever see photographs that have been published; private galleries never leave the studio.</p>
        </div>
      )}
      {g && <AddPhotos open={adding} onClose={() => setAdding(false)} galleryId={id} existing={g.photos} />}
      {g && light !== null && <Lightbox photos={g.photos.map((p) => ({ ...p, galleryTitle: g.title }))} index={light} onIndex={setLight} onClose={() => setLight(null)} />}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} danger title="Delete gallery?" confirmLabel="Delete gallery" loading={rm.isPending} onConfirm={() => rm.mutate()} body={<>This removes the gallery and its {g?.photos.length ?? 0} photograph records. It cannot be undone.</>} />
    </Drawer>
  );
}