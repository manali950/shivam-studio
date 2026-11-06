import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Award, CalendarCheck, Camera, Star } from 'lucide-react';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { cn, formatDate, titleCase } from '@/lib/utils';
import { TLink } from '@/components/shared/TLink';
import { btn } from '@/components/ui/Button';
import { ErrorState, EmptyState } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import { SmartImage } from '@/components/ui/SmartImage';
import { Lightbox } from '@/components/shared/Lightbox';
import { CardSkeletons, PageBanner, PhotographerCard, SectionHeader } from './parts';
 
export function PhotographersPage() {
  const q = useTenantQuery(['photographers', 'all'], (t) => services.photographers.list(t, { pageSize: 50, sort: 'name' }));
  const [spec, setSpec] = useState('all');
  const items = q.data?.items ?? [];
  const specs = ['all', ...new Set(items.flatMap((p) => p.specialties))];
  const shown = items.filter((p) => spec === 'all' || p.specialties.includes(spec as any));
  return (
    <>
      <PageBanner eyebrow="Our photographers" title="Specialists behind every frame" subtitle="Request a photographer by name when you book — each profile shows experience, specialties and availability." />
      <section className="container-x py-12">
        <Tabs variant="pill" items={specs.map((s) => ({ key: s, label: s === 'all' ? 'All' : titleCase(s) }))} value={spec} onChange={setSpec} className="mb-8" />
        {q.isLoading ? <CardSkeletons n={4} h="h-96" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : shown.length === 0 ? <EmptyState title="No photographers match" /> : (
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">{shown.map((p) => <PhotographerCard key={p.id} p={p} />)}</div>
        )}
      </section>
    </>
  );
}
 
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function PhotographerProfilePage() {
  const { slug } = useParams();
  const q = useTenantQuery(['photographers', 'all'], (t) => services.photographers.list(t, { pageSize: 50, sort: 'name' }));
  const [light, setLight] = useState<number | null>(null);
  const p = q.data?.items.find((x) => x.slug === slug);
  if (q.isLoading) return <PageBanner title="Loading…" />;
  if (!p) return <><PageBanner title="Photographer not found" /><div className="container-x py-12">{q.error ? <ErrorState error={q.error} /> : <EmptyState title="We couldn't find that profile" action={<TLink to="/photographers" className={btn('dark', 'md')}>See the team</TLink>} />}</div></>;
  const gallery = p.portfolio.map((url, i) => ({ url, title: `${p.name} — portfolio ${i + 1}`, description: '', category: p.specialties[0], galleryTitle: p.name }));
  return (
    <>
      <PageBanner eyebrow={p.title} title={p.name} image={p.portfolio[0]} />
      <section className="container-x grid gap-10 py-14 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24">
            <SmartImage src={p.avatarUrl} alt={p.name} ratio="4/5" width={700} className="w-full rounded-2xl" priority />
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[[Award, `${p.experienceYears} yrs`, 'Experience'], [Star, p.rating.toFixed(1), 'Rating'], [Camera, p.specialties.length, 'Specialties']].map(([Icon, v, l]: any) => (
                <div key={l} className="rounded-xl border border-line bg-white p-3"><Icon className="mx-auto h-4 w-4 text-brand-dark" /><dd className="mt-1 font-serif text-xl font-semibold">{v}</dd><dt className="text-[11px] text-ink-muted">{l}</dt></div>
              ))}
            </dl>
            <TLink to="/booking" className={btn('primary', 'lg', 'mt-5 w-full')}>Book {p.name.split(' ')[0]}</TLink>
          </div>
        </aside>
        <div className="space-y-10 lg:col-span-8">
          <div><p className="eyebrow">About</p><p className="mt-3 text-lg leading-relaxed text-ink-2">{p.bio}</p></div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div><p className="eyebrow">Specialties</p><div className="mt-3 flex flex-wrap gap-2">{p.specialties.map((s) => <span key={s} className="rounded-full bg-brand-soft px-3 py-1 text-sm text-brand-dark">{titleCase(s)}</span>)}</div></div>
            <div><p className="eyebrow">Skills</p><div className="mt-3 flex flex-wrap gap-2">{p.skills.map((s) => <span key={s} className="rounded-full border border-line bg-white px-3 py-1 text-sm text-ink-2">{s}</span>)}</div></div>
          </div>
          {p.equipment.length > 0 && <div><p className="eyebrow">Kit</p><p className="mt-2 text-sm text-ink-muted">{p.equipment.join(' · ')}</p></div>}
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-brand-dark" />Availability{p.status === 'on_leave' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">On leave</span>}</p>
            <div className="mt-3 flex gap-1.5">{DAYS.map((d, i) => <span key={d} className={cn('grid h-9 w-9 place-items-center rounded-lg text-xs font-medium', p.availability.weekdays.includes(i) ? 'bg-ink text-white' : 'bg-paper-2 text-ink-faint line-through')}>{d}</span>)}</div>
            {p.availability.note && <p className="mt-3 text-sm text-ink-muted">{p.availability.note}</p>}
            {p.availability.blockedDates.length > 0 && <p className="mt-1 text-xs text-ink-faint">Unavailable: {p.availability.blockedDates.slice(0, 4).map((d) => formatDate(d, { day: 'numeric', month: 'short' })).join(', ')}{p.availability.blockedDates.length > 4 ? '…' : ''}</p>}
          </div>
          <div>
            <SectionHeader eyebrow="Portfolio" title={`Selected work by ${p.name.split(' ')[0]}`} className="!mb-5" />
            <div className="columns-2 gap-3 [&>*]:mb-3">{p.portfolio.map((u, i) => <button key={u} onClick={() => setLight(i)} className="group block w-full overflow-hidden rounded-xl" aria-label={`Open portfolio image ${i + 1}`}><SmartImage src={u} alt={`${p.name} portfolio ${i + 1}`} width={700} ratio={i % 3 === 0 ? '4/5' : '3/2'} className="w-full" imgClassName="transition duration-700 group-hover:scale-105" /></button>)}</div>
          </div>
        </div>
      </section>
      {light !== null && <Lightbox photos={gallery} index={light} onIndex={setLight} onClose={() => setLight(null)} />}
    </>
  );
}