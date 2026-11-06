import { useState } from 'react';
import { Camera } from 'lucide-react';
import { cn, imgSrcSet, imgUrl } from '@/lib/utils';
 
/** Lazy, responsive image with shimmer placeholder and a branded gradient fallback if the URL fails (offline / dead link). */
export function SmartImage({ src, alt, className, imgClassName, width = 800, sizes = '(min-width:1024px) 33vw, 100vw', priority, ratio, style }: {
  src?: string; alt: string; className?: string; imgClassName?: string; width?: number; sizes?: string; priority?: boolean; ratio?: string; style?: React.CSSProperties;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(src ? 'loading' : 'error');
  return (
    <div className={cn(!className?.includes('absolute') && 'relative', 'overflow-hidden bg-paper-3', className)} style={{ aspectRatio: ratio, ...style }}>
      {state !== 'ok' && (
        state === 'error'
          ? <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand/30 via-paper-2 to-accent/30"><Camera className="h-6 w-6 text-ink/25" aria-hidden /></div>
          : <div className="skeleton absolute inset-0" />
      )}
      {src && state !== 'error' && (
        <img src={imgUrl(src, width)} srcSet={imgSrcSet(src, [Math.round(width / 2), width, width * 2])} sizes={sizes} alt={alt}
          loading={priority ? 'eager' : 'lazy'} decoding="async" {...({ fetchpriority: priority ? 'high' : 'auto' } as object)}
          onLoad={() => setState('ok')} onError={() => setState('error')}
          className={cn('h-full w-full object-cover transition duration-500', state === 'ok' ? 'opacity-100' : 'opacity-0', imgClassName)} />
      )}
    </div>
  );
}
 
export function Avatar({ src, name, size = 32, className }: { src?: string; name: string; size?: number; className?: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  return (
    <span className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-soft text-[11px] font-semibold text-brand-dark', className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {src && !err ? <img src={imgUrl(src, size * 2)} alt={name} loading="lazy" onError={() => setErr(true)} className="h-full w-full object-cover" /> : initials}
    </span>
  );
}