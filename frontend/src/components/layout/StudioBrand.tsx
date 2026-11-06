import { useTenant } from '@/context/TenantContext';
 
/** Sidebar brand lockup (expanded + collapsed rail) for tenant dashboards. */
export function StudioBrand() {
  const { tenant, config } = useTenant();
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <img src={config.branding.logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg bg-white/10" />
      <span className="min-w-0 leading-tight"><span className="block truncate font-serif text-[17px] font-semibold text-white">{tenant.name}</span></span>
    </span>
  );
}
export function StudioBrandMini() {
  const { config } = useTenant();
  return <img src={config.branding.logoUrl} alt="" className="h-8 w-8 rounded-lg bg-white/10" />;
}