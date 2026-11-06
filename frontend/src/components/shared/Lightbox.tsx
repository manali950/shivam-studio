import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import type { GalleryPhoto } from '@/types';
import { imgUrl, titleCase } from '@/lib/utils';
 
type P = Pick<GalleryPhoto, 'url' | 'title' | 'description' | 'category' | 'camera' | 'lens' | 'exposure'> & { galleryTitle?: string };
 
/** Full-screen preview with keyboard navigation (←/→/Esc) and photo metadata. */
export function Lightbox({ photos, index, onClose, onIndex, allowDownload }: { photos: P[]; index: number; onClose: () => void; onIndex: (i: number) => void; allowDownload?: boolean }) {
  const p = photos[index];
  const go = (d: number) => onIndex((index + d + photos.length) % photos.length);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', key); };
  });
  useEffect(() => { // preload neighbours
    [1, -1].forEach((d) => { const n = photos[(index + d + photos.length) % photos.length]; if (n) new Image().src = imgUrl(n.url, 1600); });
  }, [index, photos]);
  if (!p) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex animate-fade-in flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Photo preview">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs tabular-nums text-white/60">{index + 1} / {photos.length}</span>
        <div className="flex items-center gap-1">
          {allowDownload && <a href={p.url} target="_blank" rel="noreferrer" download className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Open original"><Download className="h-5 w-5" /></a>}
          <button onClick={onClose} aria-label="Close preview" className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-14" onClick={onClose}>
        <img key={p.url} src={imgUrl(p.url, 1800, 80)} alt={p.title} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full animate-fade-in object-contain" />
        {photos.length > 1 && (<>
          <button aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); go(-1); }} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 hover:bg-white/15 sm:left-3"><ChevronLeft className="h-6 w-6" /></button>
          <button aria-label="Next photo" onClick={(e) => { e.stopPropagation(); go(1); }} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white/80 hover:bg-white/15 sm:right-3"><ChevronRight className="h-6 w-6" /></button>
        </>)}
      </div>
      <div className="mx-auto w-full max-w-3xl px-4 py-4 text-center">
        <p className="font-serif text-lg font-semibold">{p.title}</p>
        <p className="mt-0.5 text-xs text-white/60">{[p.galleryTitle, titleCase(p.category)].filter(Boolean).join(' · ')}</p>
        {(p.camera || p.exposure) && <p className="mt-2 text-[11px] tracking-wide text-white/45">{[p.camera, p.lens, p.exposure].filter(Boolean).join('  ·  ')}</p>}
      </div>
    </div>, document.body);
}