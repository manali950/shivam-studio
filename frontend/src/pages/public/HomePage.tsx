import { useMemo, useState } from 'react';
import { ArrowDown, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { titleCase } from '@/lib/utils';
import type { PortfolioPhoto, Video } from '@/types';
import { TLink } from '@/components/shared/TLink';
import { btn } from '@/components/ui/Button';
import { SmartImage } from '@/components/ui/SmartImage';
import { Modal } from '@/components/ui/Modal';
import { YouTubeEmbed } from '@/components/shared/YouTubeEmbed';
import { Lightbox } from '@/components/shared/Lightbox';
import { BlogCard, CardSkeletons, EventCard, PackageCard, PhotographerCard, SectionHeader, SeeAll, ServiceCard, TestimonialCard, VideoCard } from './parts';
 
export default function HomePage() {
  const { tenant, config } = useTenant();
  const svcQ = useTenantQuery(['services', 'public'], (t) => services.services.list(t, { pageSize: 20, status: 'active', sort: 'sortOrder' } as any));
  const pkgQ = useTenantQuery(['packages', 'public'], (t) => services.packages.list(t, { pageSize: 20, status: 'active', sort: 'sortOrder' } as any));
  const phQ = useTenantQuery(['photographers', 'featured'], (t) => services.photographers.list(t, { pageSize: 4, featured: true, status: 'active' } as any));
  const portQ = useTenantQuery(['portfolio', 'home'], (t) => services.galleries.portfolio(t, { pageSize: 7, featured: true }));
  const vidQ = useTenantQuery(['videos', 'public-home'], (t) => services.videos.list(t, { pageSize: 4, visibility: 'public', enabled: true } as any));
  const evQ = useTenantQuery(['events', 'public-home'], (t) => services.events.list(t, { pageSize: 3, isPublic: true } as any));
  const tstQ = useTenantQuery(['testimonials', 'home'], (t) => services.testimonials.list(t, { pageSize: 3, featured: true }));
  const blogQ = useTenantQuery(['blog', 'home'], (t) => services.blog.list(t, { pageSize: 3, status: 'published' } as any));
  const [light, setLight] = useState<number | null>(null);
  const [playing, setPlaying] = useState<Video | null>(null);
 
  const svcs = useMemo(() => svcQ.data?.items ?? [], [svcQ.data]);
  const pkgs = (pkgQ.data?.items ?? []).filter((p) => p.popular).concat((pkgQ.data?.items ?? []).filter((p) => !p.popular)).slice(0, 3);
  const photos = portQ.data?.items ?? [];
  const vids = vidQ.data?.items ?? [];
  const mainVideo = vids.find((v) => v.featured) ?? vids[0];
  const serviceName = useMemo(() => new Map(svcs.map((s) => [s.id, s.name])), [svcs]);
 
  return (
    <>
      {/* HERO */}
      <section className="relative isolate flex min-h-[92vh] items-end overflow-hidden bg-ink text-white">
        <SmartImage src={config.branding.heroImageUrl} alt="" width={1920} sizes="100vw" priority className="absolute inset-0 -z-10 h-full w-full" imgClassName="animate-kenburns" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
        <div className="container-x pb-16 pt-40 sm:pb-24">
          <p className="eyebrow animate-fade-up !text-brand">{tenant.city} · {config.branding.tagline}</p>
          <h1 className="h-display mt-4 max-w-4xl animate-fade-up text-white [animation-delay:.1s]">{config.home.headline}</h1>
          <p className="mt-5 max-w-xl animate-fade-up text-lg text-white/80 [animation-delay:.2s]">{config.home.subheadline}</p>
          <div className="mt-8 flex animate-fade-up flex-wrap gap-3 [animation-delay:.3s]">
            <TLink to="/booking" className={btn('primary', 'lg')}>{config.home.heroCtaLabel}</TLink>
            <TLink to="/portfolio" className={btn('outline', 'lg', '!border-white/40 !bg-white/5 !text-white backdrop-blur hover:!bg-white/15')}>View portfolio</TLink>
          </div>
          {config.about.achievements.length > 0 && (
            <dl className="mt-12 grid max-w-2xl animate-fade-up grid-cols-2 gap-x-8 gap-y-4 border-t border-white/15 pt-6 [animation-delay:.4s] sm:grid-cols-4">
              {config.about.achievements.slice(0, 4).map((a) => <div key={a.label}><dd className="font-serif text-3xl font-semibold text-brand">{a.value}</dd><dt className="text-xs text-white/60">{a.label}</dt></div>)}
            </dl>
          )}
        </div>
        <ArrowDown className="absolute bottom-6 left-1/2 hidden h-5 w-5 -translate-x-1/2 animate-bounce text-white/50 sm:block" aria-hidden />
      </section>
 
      {/* FEATURED PHOTOGRAPHY */}
      <section className="container-x py-20">
        <SectionHeader eyebrow="Featured photography" title="Frames we are proud of" action={<SeeAll to="/portfolio" label="Open full portfolio" />} />
        {portQ.isLoading ? <CardSkeletons n={3} h="h-80" /> : (
          <div className="grid auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[200px] md:grid-cols-4">
            {photos.map((p: PortfolioPhoto, i: number) => (
              <button key={p.id} onClick={() => setLight(i)} aria-label={`Preview ${p.title}`}
                className={`group relative overflow-hidden rounded-xl ${i === 0 ? 'col-span-2 row-span-2' : i === 3 ? 'row-span-2' : i === 6 ? 'col-span-2' : ''}`}>
                <SmartImage src={p.url} alt={p.title} width={i === 0 ? 1000 : 500} className="h-full w-full" imgClassName="transition duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                <span className="absolute bottom-3 left-3 translate-y-2 text-left text-sm font-medium text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">{p.title}<span className="block text-[11px] font-normal text-white/70">{titleCase(p.category)}</span></span>
              </button>
            ))}
          </div>
        )}
      </section>
 
      {/* CATEGORIES */}
      <section className="bg-paper-2 py-20">
        <div className="container-x">
          <SectionHeader eyebrow="What we photograph" title="Photography for every chapter" subtitle="Choose a service to start your enquiry — every package is tailored to your date and venue." action={<SeeAll to="/services" label="All services" />} />
          {svcQ.isLoading ? <CardSkeletons n={4} h="h-96" /> : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{svcs.slice(0, 4).map((s) => <ServiceCard key={s.id} s={s} count={pkgQ.data?.items.filter((p) => p.serviceId === s.id).length} />)}</div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">{svcs.slice(4).map((s) => <TLink key={s.id} to={`/booking?service=${s.id}`} className="rounded-full border border-line bg-white px-4 py-1.5 text-sm text-ink-2 transition hover:border-brand hover:text-brand-dark">{s.name}</TLink>)}</div>
        </div>
      </section>
 
      {/* PHOTOGRAPHERS */}
      <section className="container-x py-20">
        <SectionHeader eyebrow="The team" title="Meet our photographers" subtitle="Specialists you can request by name when you book." action={<SeeAll to="/photographers" label="Full team" />} />
        {phQ.isLoading ? <CardSkeletons n={4} h="h-96" /> : <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">{phQ.data?.items.map((p) => <PhotographerCard key={p.id} p={p} />)}</div>}
      </section>
 
      {/* PACKAGES */}
      {pkgs.length > 0 && (
        <section className="bg-paper-2 py-20">
          <div className="container-x">
            <SectionHeader eyebrow="Packages" title="Transparent pricing, thoughtful deliverables" action={<SeeAll to="/packages" label="Compare packages" />} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{pkgs.map((p) => <PackageCard key={p.id} p={p} serviceName={serviceName.get(p.serviceId)} />)}</div>
          </div>
        </section>
      )}
 
      {/* VIDEOS */}
      {mainVideo && (
        <section className="bg-ink py-20 text-white">
          <div className="container-x">
            <SectionHeader eyebrow="Films" title={<span className="text-white">Stories in motion</span>} action={<SeeAll to="/videos" label="Watch all films" />} />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2"><YouTubeEmbed videoId={mainVideo.youtubeId} title={mainVideo.title} thumbnail={mainVideo.thumbnailUrl} /><p className="eyebrow mt-4">{titleCase(mainVideo.category)}</p><h3 className="font-serif text-2xl font-semibold">{mainVideo.title}</h3><p className="mt-1 text-sm text-white/65">{mainVideo.description}</p></div>
              <div className="grid content-start gap-5 [&_.eyebrow]:!text-brand [&_h3]:text-white">{vids.filter((v) => v.id !== mainVideo.id).slice(0, 2).map((v) => <VideoCard key={v.id} v={v} onPlay={setPlaying} />)}</div>
            </div>
          </div>
        </section>
      )}
 
      {/* EVENTS */}
      {(evQ.data?.items.length ?? 0) > 0 && (
        <section className="container-x py-20">
          <SectionHeader eyebrow="Recent galleries" title="Celebrations we have captured" action={<SeeAll to="/events" label="All events" />} />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{evQ.data?.items.map((e) => <EventCard key={e.id} e={e} />)}</div>
        </section>
      )}
 
      {/* TESTIMONIALS */}
      {(tstQ.data?.items.length ?? 0) > 0 && (
        <section className="bg-paper-2 py-20">
          <div className="container-x">
            <SectionHeader center eyebrow="Kind words" title="Loved by the people we photograph" />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">{tstQ.data?.items.map((t) => <TestimonialCard key={t.id} t={t} />)}</div>
          </div>
        </section>
      )}
 
      {/* BLOG */}
      {(blogQ.data?.items.length ?? 0) > 0 && (
        <section className="container-x py-20">
          <SectionHeader eyebrow="Journal" title="Tips & stories" action={<SeeAll to="/blog" label="Read the journal" />} />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">{blogQ.data?.items.map((b) => <BlogCard key={b.id} b={b} />)}</div>
        </section>
      )}
 
      {/* CTA + CONTACT */}
      <section className="relative overflow-hidden bg-accent py-20 text-white">
        <div className="container-x relative grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow !text-brand">Let's create something timeless</p>
            <h2 className="h-section mt-2 !text-white sm:!text-5xl">Is your date still open?</h2>
            <p className="mt-3 max-w-md text-white/75">Send us your date and venue. We'll reply within one working day with availability and a tailored quote.</p>
            <div className="mt-6 flex flex-wrap gap-3"><TLink to="/booking" className={btn('primary', 'lg')}>Check availability</TLink><TLink to="/contact" className={btn('outline', 'lg', '!border-white/30 !bg-transparent !text-white hover:!bg-white/10')}>Contact us</TLink></div>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            {[[Phone, 'Call us', config.contact.phone, `tel:${config.contact.phone.replace(/\s/g, '')}`], [Mail, 'Email', config.contact.email, `mailto:${config.contact.email}`], [MessageCircle, 'WhatsApp', 'Chat with us', `https://wa.me/${config.contact.whatsapp}`], [MapPin, 'Studio', config.contact.address, config.contact.mapUrl]].map(([Icon, label, value, href]: any) => (
              <li key={label}><a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer noopener" className="flex h-full gap-3 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" /><span className="min-w-0"><span className="block text-xs text-white/55">{label}</span><span className="block break-words">{value || '—'}</span></span></a></li>
            ))}
          </ul>
        </div>
      </section>
 
      {light !== null && <Lightbox photos={photos} index={light} onIndex={setLight} onClose={() => setLight(null)} />}
      <Modal open={!!playing} onClose={() => setPlaying(null)} title={playing?.title} size="lg">{playing && <YouTubeEmbed videoId={playing.youtubeId} title={playing.title} thumbnail={playing.thumbnailUrl} autoPlay />}</Modal>
    </>
  );
}