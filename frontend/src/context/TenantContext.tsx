import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, Lock } from 'lucide-react';
import type { Tenant, TenantConfig } from '@/types';
import { services } from '@/services/data-provider';
import { getTenantStrategy } from '@/tenancy/resolve';
import { applyTheme, resetTheme, setFavicon } from '@/lib/theme';
import { formatMoney } from '@/lib/utils';
import { Spinner } from '@/components/ui/Feedback';
 
export interface TenantState {
  tenant: Tenant;
  config: TenantConfig;
  /** URL prefix for this studio: "/royal" in path mode, "" on subdomain / custom domain. */
  basePath: string;
  /** Build an in-app URL for this studio: to('/portfolio') → "/royal/portfolio". */
  to(path: string): string;
  money(amount: number, compact?: boolean): string;
}
const Ctx = createContext<TenantState | null>(null);
export const useTenant = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTenant must be used inside <TenantProvider>');
  return v;
};
 
const strategy = getTenantStrategy();
 
function Message({ icon: Icon, title, body }: { icon: typeof Camera; title: string; body: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-ink text-[#b08d57]"><Icon className="h-6 w-6" /></div>
        <h1 className="font-serif text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{body}</p>
        {strategy.mode === 'path' && <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-ink px-5 text-sm font-medium text-white">Browse studios</Link>}
      </div>
    </div>
  );
}
 
/** Route element that resolves the current studio (path / subdomain / custom domain), applies its theme and provides it. */
export function TenantProvider({ children }: { children?: ReactNode }) {
  const { tenantSlug } = useParams();
  const { pathname } = useLocation();
 
  const tenantQ = useQuery({
    queryKey: ['tenant-resolve', strategy.mode === 'host' ? strategy.host : tenantSlug],
    queryFn: () => services.tenants.resolve(strategy.mode === 'host' ? { host: strategy.host } : { slug: tenantSlug }),
    staleTime: 60_000,
  });
  const tenant = tenantQ.data ?? null;
  const configQ = useQuery({
    queryKey: ['tenant-config', tenant?.id], enabled: !!tenant && tenant.status !== 'inactive',
    queryFn: () => services.tenants.getConfig(tenant!.id), staleTime: 60_000,
  });
  const config = configQ.data;
 
  useEffect(() => {
    if (!config || !tenant) return;
    applyTheme(config.branding.primaryColor, config.branding.secondaryColor);
    setFavicon(config.branding.faviconUrl);
    document.title = `${tenant.name} — ${config.branding.tagline}`;
    return () => { resetTheme(); document.title = 'shivamStudio'; };
  }, [config, tenant]);
 
  const basePath = strategy.mode === 'path' ? `/${tenantSlug ?? ''}` : '';
  const value = useMemo<TenantState | null>(() => (tenant && config ? {
    tenant, config, basePath,
    to: (p: string) => (p === '/' || p === '' ? basePath || '/' : `${basePath}${p.startsWith('/') ? p : `/${p}`}`),
    money: (a: number, compact?: boolean) => formatMoney(a, config.settings.currency, config.settings.locale, compact),
  } : null), [tenant, config, basePath]);
 
  if (tenantQ.isLoading || (tenant && tenant.status !== 'inactive' && configQ.isLoading))
    return <div className="grid min-h-screen place-items-center bg-paper"><Spinner className="h-6 w-6 text-ink-muted" /></div>;
  if (!tenant) return <Message icon={Camera} title="Studio not found" body={`We couldn't find a studio at “${strategy.mode === 'host' ? strategy.host : tenantSlug}”. Check the address and try again.`} />;
  if (tenant.status === 'inactive') return <Message icon={Lock} title={`${tenant.name} is currently unavailable`} body="This studio's website is paused. If you are the studio owner, ask your platform administrator to re-activate the account." />;
  if (!value) return <Message icon={Camera} title="Could not load studio" body="Studio configuration failed to load. Please refresh." />;
 
  void pathname;
  return <Ctx.Provider value={value}>{children ?? <Outlet />}</Ctx.Provider>;
}