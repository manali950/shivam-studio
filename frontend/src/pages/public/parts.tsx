import type { ReactNode } from 'react';
import { ArrowRight, Calendar, Camera, Check, Clock, MapPin, Play, Quote, Star, Users } from 'lucide-react';
import type { BlogPost, Package, Photographer, Service, StudioEvent, Testimonial, Video } from '@/types';
import { useTenant } from '@/context/TenantContext';
import { cn, formatDate, titleCase } from '@/lib/utils';
import { TLink } from '@/components/shared/TLink';
import { SmartImage, Avatar } from '@/components/ui/SmartImage';
import { Skeleton } from '@/components/ui/Feedback';
import { btn } from '@/components/ui/Button';
 
export function PageBanner({ eyebrow, title, subtitle, image, children }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; image?: string; children?: ReactNode }) {
  const { config } = useTenant();
  return (
    <section className="relative overflow-hidden bg-accent pb-14 pt-32 text-white sm:pb-16 sm:pt-36">
      <SmartImage src={image ?? config.branding.heroImageUrl} alt="" width={1600} className="absolute inset-0 h-full w-full opacity-30" imgClassName="animate-kenburns" priority />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-accent/70 to-accent" />
      <div className="container-x relative animate-fade-up">
        {eyebrow && <p className="eyebrow !text-brand">{eyebrow}</p>}
        <h1 className="h-section mt-2 max-w-3xl !text-white sm:!text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-base text-white/75">{subtitle}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
 
export function SectionHeader({ eyebrow, title, subtitle, action, center, className }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; action?: ReactNode; center?: boolean; className?: string }) {
  return (
    <div className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', center && 'justify-center text-center', className)}>
      <div className={cn('max-w-2xl', center && 'mx-auto')}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="h-section mt-2">{title}</h2>
        {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export const SeeAll = ({ to, label = 'View all' }: { to: string; label?: string }) => (
  <TLink to={to} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-dark">{label}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></TLink>
);
 
export const CardSkeletons = ({ n = 3, h = 'h-72' }: { n?: number; h?: string }) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={cn('w-full rounded-2xl', h)} />)}</div>
);
 
export function PhotographerCard({ p }: { p: Photographer }) {
  return (
    <TLink to={`/photographers/${p.slug}`} className="group block">
      <div className="relative overflow-hidden rounded-2xl">
        <SmartImage src={p.avatarUrl} alt={p.name} ratio="4/5" width={600} className="w-full" imgClassName="transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-14 text-white">
          <p className="flex items-center gap-1 text-xs text-white/80"><Star className="h-3.5 w-3.5 fill-brand text-brand" />{p.rating.toFixed(1)} · {p.experienceYears} yrs</p>
        </div>
        {p.status !== 'active' && <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink">{titleCase(p.status)}</span>}
      </div>
      <h3 className="mt-3 font-serif text-xl font-semibold leading-tight">{p.name}</h3>
      <p className="text-sm text-ink-muted">{p.title}</p>
      <p className="mt-1 truncate text-xs text-brand-dark">{p.specialties.map(titleCase).join(' · ')}</p>
    </TLink>
  );
}
 
export function ServiceCard({ s, count }: { s: Service; count?: number }) {
  const { money } = useTenant();
  return (
    <TLink to={`/booking?service=${s.id}`} className="group relative block overflow-hidden rounded-2xl bg-ink">
      <SmartImage src={s.imageUrl} alt={s.name} ratio="4/5" width={700} className="w-full opacity-90" imgClassName="transition duration-700 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <p className="eyebrow !text-brand">{titleCase(s.category)}</p>
        <h3 className="mt-1 font-serif text-2xl font-semibold leading-tight">{s.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-white/75">{s.description}</p>
        <div className="mt-3 flex items-center justify-between text-sm"><span className="font-semibold">From {money(s.startingPrice)}</span><span className="inline-flex items-center gap-1 text-white/80 transition group-hover:text-white">{count ? `${count} packages · ` : ''}Enquire <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div>
      </div>
    </TLink>
  );
}
 
export function PackageCard({ p, serviceName }: { p: Package; serviceName?: string }) {
  const { money } = useTenant();
  return (
    <article className={cn('relative flex flex-col rounded-2xl border bg-white p-6 transition hover:-translate-y-1 hover:shadow-pop', p.popular ? 'border-brand ring-1 ring-brand/40' : 'border-line')}>
      {p.popular && <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-brand-contrast">Most booked</span>}
      {serviceName && <p className="eyebrow">{serviceName}</p>}
      <h3 className="mt-1 font-serif text-2xl font-semibold">{p.name}</h3>
      <p className="mt-1 text-sm text-ink-muted">{p.description}</p>
      <p className="mt-4 font-serif text-4xl font-semibold text-ink">{money(p.price)}</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 border-y border-line py-3 text-xs text-ink-2">
        <li className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-brand-dark" />{p.durationHours >= 24 ? `${Math.round(p.durationHours / 12) / 2} days` : `${p.durationHours} hours`}</li>
        <li className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-brand-dark" />{p.photographerCount} photographer{p.photographerCount > 1 ? 's' : ''}</li>
      </ul>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Deliverables</p>
      <ul className="mt-2 space-y-1.5 text-sm">{p.deliverables.map((d) => <li key={d} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" />{d}</li>)}</ul>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Included</p>
      <ul className="mt-2 flex-1 space-y-1.5 text-sm text-ink-2">{p.features.map((d) => <li key={d} className="flex gap-2"><Camera className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />{d}</li>)}</ul>
      <TLink to={`/booking?service=${p.serviceId}&package=${p.id}`} className={btn(p.popular ? 'primary' : 'dark', 'lg', 'mt-6 w-full')}>Enquire about this package</TLink>
    </article>
  );
}
 
export function EventCard({ e }: { e: StudioEvent }) {
  return (
    <TLink to={`/events/${e.id}`} className="group block overflow-hidden rounded-2xl border border-line bg-white transition hover:shadow-pop">
      <SmartImage src={e.coverUrl} alt={e.title} ratio="3/2" width={700} className="w-full" imgClassName="transition duration-700 group-hover:scale-105" />
      <div className="p-4">
        <p className="eyebrow">{titleCase(e.type)}</p>
        <h3 className="mt-1 font-serif text-xl font-semibold leading-snug">{e.title}</h3>
        <p className="mt-2 flex items-center gap-3 text-xs text-ink-muted"><span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(e.date)}</span><span className="inline-flex items-center gap-1 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" />{e.venue}</span></p>
      </div>
    </TLink>
  );
}
 
export function VideoCard({ v, onPlay }: { v: Video; onPlay: (v: Video) => void }) {
  return (
    <button type="button" onClick={() => onPlay(v)} className="group block w-full text-left">
      <div className="relative overflow-hidden rounded-xl">
        <SmartImage src={v.thumbnailUrl} alt={v.title} ratio="16/9" width={560} className="w-full" imgClassName="transition duration-700 group-hover:scale-105" />
        <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/35" />
        <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink shadow-pop transition group-hover:scale-110"><Play className="ml-0.5 h-4 w-4 fill-current" /></span>
        {v.featured && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-contrast">Featured</span>}
      </div>
      <p className="eyebrow mt-3">{titleCase(v.category)}</p>
      <h3 className="mt-0.5 font-serif text-lg font-semibold leading-snug">{v.title}</h3>
    </button>
  );
}
 
export function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-line bg-white p-6">
      <Quote className="h-7 w-7 text-brand/60" />
      <div className="mt-3 flex gap-0.5" aria-label={`${t.rating} out of 5`}>{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn('h-4 w-4', i < t.rating ? 'fill-brand text-brand' : 'text-paper-3')} />)}</div>
      <blockquote className="mt-3 flex-1 font-serif text-lg leading-snug text-ink">“{t.quote}”</blockquote>
      <figcaption className="mt-5 flex items-center gap-3"><Avatar src={t.avatarUrl} name={t.clientName} size={40} /><div><p className="text-sm font-semibold">{t.clientName}</p><p className="text-xs text-ink-muted">{t.role}</p></div></figcaption>
    </figure>
  );
}
 
export function BlogCard({ b }: { b: BlogPost }) {
  return (
    <TLink to={`/blog/${b.slug}`} className="group block">
      <SmartImage src={b.coverUrl} alt={b.title} ratio="3/2" width={700} className="w-full rounded-2xl" imgClassName="transition duration-700 group-hover:scale-105" />
      <p className="eyebrow mt-4">{b.category === 'tips' ? 'Photography tips' : 'Stories'} · {b.readMinutes} min</p>
      <h3 className="mt-1 font-serif text-2xl font-semibold leading-snug group-hover:text-brand-dark">{b.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-ink-muted">{b.excerpt}</p>
      <p className="mt-2 text-xs text-ink-faint">{b.authorName} · {formatDate(b.publishedAt)}</p>
    </TLink>
  );
}