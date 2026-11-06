import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartImage } from '../ui/SmartImage';
 
/** Lite embed: shows the thumbnail and only loads the (heavy) iframe on click, via the privacy-friendly nocookie host. */
export function YouTubeEmbed({ videoId, title, thumbnail, className, autoPlay }: { videoId: string; title: string; thumbnail?: string; className?: string; autoPlay?: boolean }) {
  const [active, setActive] = useState(!!autoPlay);
  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-xl bg-ink', className)}>
      {active ? (
        <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`} title={title}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <button type="button" onClick={() => setActive(true)} aria-label={`Play video: ${title}`} className="group absolute inset-0 block h-full w-full">
          <SmartImage src={thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full" imgClassName="transition duration-700 group-hover:scale-105" width={640} />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink shadow-pop transition group-hover:scale-110 group-hover:bg-brand group-hover:text-brand-contrast"><Play className="ml-0.5 h-5 w-5 fill-current" /></span>
        </button>
      )}
    </div>
  );
}