import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowRight, Camera, Globe, Layers, Lock, Shield, Wand2 } from 'lucide-react';
import { services, DATA_MODE } from '@/services/data-provider';
import { StatusBadge } from '@/components/ui/Badge';
import { SmartImage } from '@/components/ui/SmartImage';
import { Skeleton } from '@/components/ui/Feedback';
 
/** Root page in path mode: a studio directory for development + a short tour of how tenancy resolves. */
export default function StudioPicker() {
  const tq = useQuery({ queryKey: ['tenants-public'], queryFn: () => services.tenants.listPublic() });
  const cfgs = useQueries({ queries: (tq.data ?? []).map((t) => ({ queryKey: ['tenant-config', t.id], queryFn: () => services.tenants.getConfig(t.id) })) });
  return (
    <div className="min-h-screen bg-ink text-white">
      <header className="container-x flex h-16 items-center justify-between">
        <span className="flex items-center gap-2 font-serif text-xl font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#b08d57] text-ink"><Camera className="h-4 w-4" /></span>shivamStudio</span>
        <Link to="/platform" className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"><Shield className="h-4 w-4" />Platform admin</Link>
      </header>
      <section className="container-x pb-10 pt-12 sm:pt-20">
        <p className="eyebrow !text-[#b08d57]">Multi-tenant photography platform</p>
        <h1 className="h-display mt-3 max-w-4xl">One platform. Every studio its own brand.</h1>
        <p className="mt-4 max-w-2xl text-lg text-white/70">Preview independent photography studios — each with its own website, photographers, packages, bookings, galleries and client portal. Data mode: <b className="text-[#b08d57]">{DATA_MODE}</b>.</p>
      </section>
      <section className="container-x grid gap-4 pb-14 sm:grid-cols-2 lg:grid-cols-4">
        {tq.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl !bg-white/10" />)}
        {tq.data?.map((t, i) => {
          const c = cfgs[i]?.data;
          return (
            <Link key={t.id} to={`/${t.slug}`} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:-translate-y-1 hover:border-white/30">
              <div className="relative h-44"><SmartImage src={c?.branding.heroImageUrl} alt="" width={600} className="h-full w-full opacity-80" imgClassName="transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                <span className="absolute right-3 top-3"><StatusBadge status={t.status} /></span></div>
              <div className="p-4">
                <div className="flex items-center gap-2"><img src={c?.branding.logoUrl} alt="" className="h-8 w-8 rounded-lg" /><h2 className="font-serif text-xl font-semibold leading-tight">{t.name}</h2></div>
                <p className="mt-2 text-sm text-white/60">{c?.branding.tagline}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-white/50"><span>{t.city}</span><span className="flex gap-1">{c && [c.branding.primaryColor, c.branding.secondaryColor].map((x) => <i key={x} className="h-3 w-3 rounded-full ring-1 ring-white/30" style={{ background: x }} />)}</span></div>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#b08d57]">{t.status === 'inactive' ? <><Lock className="h-3.5 w-3.5" />Inactive studio</> : <>Open studio</>}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </div>
            </Link>
          );
        })}
      </section>
      <section className="border-t border-white/10 bg-white/[0.03] py-12">
        <div className="container-x grid grid-cols-1 gap-6 md:grid-cols-3">
          {[[Globe, 'Subdomain', 'royal.example.com', 'Set VITE_BASE_DOMAIN and point a wildcard DNS record at the app.'], [Layers, 'Custom domain', 'royalweddingphotography.in', 'Any domain stored in a tenant record resolves via TenantService.resolve({ host }).'], [Wand2, 'Path (development)', 'localhost:5173/royal', 'Used on localhost and IPs so you can preview every studio without DNS.']].map(([Icon, t, ex, d]: any) => (
            <div key={t} className="rounded-xl border border-white/10 p-5"><Icon className="h-5 w-5 text-[#b08d57]" /><h3 className="mt-3 font-semibold">{t}</h3><code className="mt-1 block text-xs text-[#b08d57]">{ex}</code><p className="mt-2 text-sm text-white/60">{d}</p></div>
          ))}
        </div>
      </section>
    </div>
  );
}