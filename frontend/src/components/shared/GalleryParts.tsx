import { useMemo, useState } from 'react';
import { ExternalLink, HardDrive, Link2, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import { useTenantMutation, useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { DRIVE_NOTICE, isHttpUrl, parseDrive } from '@/lib/media';
import { cn } from '@/lib/utils';
import type { Gallery, GalleryPhoto } from '@/types';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Form';
import { Modal } from '../ui/Modal';
import { Skeleton } from '../ui/Feedback';
import { SmartImage } from '../ui/SmartImage';
 
/** Gallery building blocks shared by the photographer portal and the studio admin. */
export function PhotoTile({ p, on, locked, onToggle, onOpen }: { p: GalleryPhoto; on: boolean; locked: boolean; onToggle: () => void; onOpen: () => void }) {
  return (
    <div className={cn('group relative overflow-hidden rounded-lg ring-2 ring-offset-1 transition', on ? 'ring-brand' : 'ring-transparent')}>
      <button onClick={onOpen} aria-label={`Preview ${p.title}`} className="block w-full"><SmartImage src={p.url} alt={p.title} ratio="1/1" width={360} className="w-full" /></button>
      <button onClick={onToggle} disabled={locked} aria-pressed={on} aria-label={on ? `Remove ${p.title} from highlights` : `Mark ${p.title} as highlight`}
        className={cn('absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full shadow transition disabled:cursor-not-allowed', on ? 'bg-brand text-brand-contrast' : 'bg-white/90 text-ink-muted hover:text-ink')}><Star className={cn('h-4 w-4', on && 'fill-current')} /></button>
      {on && <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white"><Sparkles className="h-3 w-3" />Highlight</span>}
    </div>
  );
}
 
export function DeliveryLinks({ g }: { g: Gallery }) {
  const [url, setUrl] = useState(''); const [label, setLabel] = useState('Google Drive folder'); const [err, setErr] = useState('');
  const save = useTenantMutation<{ id: string; label: string; url: string }[], Gallery>((t, links) => services.galleries.setExternalLinks(t, g.id, links), ['galleries'], { success: 'Delivery links updated' });
  const add = () => {
    const d = parseDrive(url);
    if (!d && !isHttpUrl(url)) return setErr('Enter a valid https:// link.');
    if (!d && !url.startsWith('https://')) return setErr('Links must use https://');
    if (!label.trim()) return setErr('Give the link a label.');
    setErr(''); save.mutate([...g.externalLinks, { id: '', label: label.trim(), url: d?.url ?? url.trim() }], { onSuccess: () => setUrl('') });
  };
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <div><p className="flex items-center gap-1.5 text-sm font-semibold"><HardDrive className="h-4 w-4 text-ink-muted" />Delivery links</p><p className="mt-0.5 text-xs text-ink-muted">Share a Google Drive folder with the full-resolution files. {DRIVE_NOTICE}</p></div>
      {g.externalLinks.length > 0 && <ul className="space-y-1.5">{g.externalLinks.map((l) => (
        <li key={l.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm"><Link2 className="h-4 w-4 shrink-0 text-ink-faint" /><span className="min-w-0 flex-1 truncate"><span className="font-medium">{l.label}</span> <a href={l.url} target="_blank" rel="noreferrer noopener" className="text-xs text-brand-dark">open <ExternalLink className="inline h-3 w-3" /></a></span>
          <button aria-label={`Remove ${l.label}`} onClick={() => save.mutate(g.externalLinks.filter((x) => x.id !== l.id))} className="rounded p-1 text-ink-faint hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></li>))}</ul>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <Input aria-label="Link label" value={label} onChange={(ev) => setLabel(ev.target.value)} placeholder="Label" />
        <Input aria-label="Link URL" value={url} onChange={(ev) => { setUrl(ev.target.value); setErr(''); }} placeholder="https://drive.google.com/drive/folders/…" invalid={!!err} />
        <Button variant="dark" onClick={add} loading={save.isPending} icon={<Plus className="h-4 w-4" />}>Add</Button>
      </div>
      {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
 
export function AddPhotos({ open, onClose, galleryId, existing }: { open: boolean; onClose: () => void; galleryId: string; existing: GalleryPhoto[] }) {
  const lib = useTenantQuery(['galleries', 'sample-library'], () => services.galleries.sampleLibrary(), { enabled: open });
  const [picked, setPicked] = useState<Set<string>>(new Set()); const [url, setUrl] = useState(''); const [title, setTitle] = useState(''); const [err, setErr] = useState('');
  const have = useMemo(() => new Set(existing.map((p) => p.url)), [existing]);
  const items = (lib.data ?? []).filter((p) => p.url && !have.has(p.url));
  const add = useTenantMutation<Partial<GalleryPhoto>[], Gallery>((t, photos) => services.galleries.addPhotos(t, galleryId, photos), ['galleries'], { onSuccess: (_r, a) => { setPicked(new Set()); setUrl(''); setTitle(''); onClose(); void a; }, success: 'Photographs added' });
  const submit = () => {
    const chosen = items.filter((p) => picked.has(p.url!));
    const extra: Partial<GalleryPhoto>[] = [];
    if (url.trim()) { if (!/^https?:\/\//.test(url.trim())) return setErr('Image URL must start with http:// or https://'); extra.push({ url: url.trim(), title: title.trim() || 'Untitled' }); }
    if (!chosen.length && !extra.length) return setErr('Select at least one photograph or paste an image URL.');
    setErr(''); add.mutate([...chosen, ...extra]);
  };
  return (
    <Modal open={open} onClose={onClose} size="lg" title="Add photographs" subtitle="Demo mode: pick from the studio's sample library or paste image URLs. In production this step uploads files to storage."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={add.isPending}>Add {picked.size + (url.trim() ? 1 : 0) || ''} photo{picked.size + (url.trim() ? 1 : 0) === 1 ? '' : 's'}</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_12rem]"><Field label="Image URL"><Input value={url} onChange={(ev) => { setUrl(ev.target.value); setErr(''); }} placeholder="https://…/photo.jpg" /></Field><Field label="Title"><Input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Optional" /></Field></div>
        <div><p className="mb-2 text-sm font-medium">Sample library <span className="font-normal text-ink-muted">· {picked.size} selected</span></p>
          {lib.isLoading ? <Skeleton className="h-40" /> : items.length === 0 ? <p className="text-sm text-ink-muted">Every sample photograph is already in this gallery.</p> : (
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
              {items.map((p) => { const on = picked.has(p.url!); return (
                <button key={p.url} type="button" aria-pressed={on} onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(p.url!)) n.delete(p.url!); else n.add(p.url!); return n; })} className={cn('relative overflow-hidden rounded-lg ring-2 ring-offset-1', on ? 'ring-brand' : 'ring-transparent')}>
                  <SmartImage src={p.url!} alt={p.title ?? ''} ratio="1/1" width={240} className="w-full" />{on && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand text-[10px] font-bold text-brand-contrast">✓</span>}
                </button>); })}
            </div>)}
        </div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </div>
    </Modal>
  );
}