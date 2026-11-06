import { Link, NavLink, type LinkProps, type NavLinkProps } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
 
/** Tenant-aware links: <TLink to="/portfolio"> resolves to /royal/portfolio (path mode) or /portfolio (subdomain / custom domain). */
export function TLink({ to, ...rest }: Omit<LinkProps, 'to'> & { to: string }) {
  const { to: t } = useTenant();
  return <Link to={t(to)} {...rest} />;
}
export function TNavLink({ to, ...rest }: Omit<NavLinkProps, 'to'> & { to: string }) {
  const { to: t } = useTenant();
  return <NavLink to={t(to)} {...rest} />;
}