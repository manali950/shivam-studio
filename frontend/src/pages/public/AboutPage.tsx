import { useTenant } from '@/context/TenantContext';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import { TLink } from '@/components/shared/TLink';
import { btn } from '@/components/ui/Button';
import { PageBanner, PhotographerCard, SectionHeader } from './parts';
 
export default function AboutPage() {
  const { config, tenant } = useTenant();
  const team = useTenantQuery(['photographers', 'team'], (t) => services.photographers.list(t, { pageSize: 8, status: 'active' } as any));
  const a = config.about;
  return (
    <>
      <PageBanner eyebrow={`About ${tenant.name}`} title={a.title} subtitle={a.intro} />
      <section className="container-x grid gap-12 py-16 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-7">
          {a.history && <div><p className="eyebrow">Our story</p><p className="mt-3 font-serif text-2xl leading-snug text-ink">{a.history}</p></div>}
          {a.philosophy && <div><p className="eyebrow">Photography philosophy</p><p className="mt-3 text-lg leading-relaxed text-ink-2">{a.philosophy}</p></div>}
        </div>
        <aside className="lg:col-span-5">
          {a.achievements.length > 0 && (
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
              {a.achievements.map((x) => <div key={x.label} className="bg-white p-6"><dd className="font-serif text-4xl font-semibold text-brand-dark">{x.value}</dd><dt className="mt-1 text-sm text-ink-muted">{x.label}</dt></div>)}
            </dl>
          )}
        </aside>
      </section>
      {a.milestones.length > 0 && (
        <section className="bg-paper-2 py-16">
          <div className="container-x">
            <SectionHeader eyebrow="Milestones" title="How we got here" />
            <ol className="relative ml-2 space-y-6 border-l border-brand/40 pl-8">
              {a.milestones.map((m) => <li key={m.year} className="relative"><span className="absolute -left-[39px] top-1 h-3 w-3 rounded-full bg-brand ring-4 ring-paper-2" /><p className="font-serif text-2xl font-semibold text-brand-dark">{m.year}</p><p className="text-ink-2">{m.text}</p></li>)}
            </ol>
          </div>
        </section>
      )}
      <section className="container-x py-16">
        <SectionHeader eyebrow="The team" title="The people behind the lens" action={<TLink to="/photographers" className={btn('outline', 'md')}>View profiles</TLink>} />
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">{team.data?.items.map((p) => <PhotographerCard key={p.id} p={p} />)}</div>
      </section>
    </>
  );
}