/**
 * Tenant resolution strategy, decided synchronously from the browser location.
 *
 *  - path : localhost:5173/royal/...            (local dev, IPs, platform hosts)
 *  - host : royal.example.com  or  royalweddingphotography.in   (subdomain / custom domain → looked up via TenantService.resolve)
 */
export type TenantStrategy = { mode: 'path' } | { mode: 'host'; host: string };
 
const csv = (s?: string) => (s ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
 
export function getTenantStrategy(loc: Pick<Location, 'hostname'> = window.location): TenantStrategy {
  const host = loc.hostname.toLowerCase();
  const platformHosts = csv(import.meta.env.VITE_PLATFORM_HOSTS ?? 'localhost,127.0.0.1');
  const base = import.meta.env.VITE_BASE_DOMAIN?.trim().toLowerCase();
  if (platformHosts.includes(host) || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host === '::1') return { mode: 'path' };
  if (base && (host === base || host === `www.${base}`)) return { mode: 'path' };
  return { mode: 'host', host };
}
 
/** Slugs that can never be used as a studio slug because they collide with platform routes. */
export const RESERVED_SLUGS = ['platform', 'api', 'admin', 'www', 'login', 'assets'];