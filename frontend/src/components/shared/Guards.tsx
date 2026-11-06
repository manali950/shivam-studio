import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { Role } from '@/types';
import { useTenant } from '@/context/TenantContext';
import { ROLE_HOME, ROLE_LABEL, useAuth } from '@/context/AuthContext';
import { PageLoader } from '../ui/Feedback';
import { Button } from '../ui/Button';
 
/** Route-level role gate for studio areas. Server-side authorization is the real control; this is UX + defence in depth. */
export function RequireTenantRole({ roles }: { roles: Role[] }) {
  const { user, loading, logout } = useAuth();
  const { tenant, to } = useTenant();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`${to('/login')}?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (user.role !== 'super_admin' && user.tenantId !== tenant.id) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6 text-center">
        <div className="max-w-md"><ShieldAlert className="mx-auto h-10 w-10 text-amber-500" /><h1 className="mt-3 font-serif text-3xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-ink-muted">You are signed in as {user.name} ({ROLE_LABEL[user.role]}) for a different studio. Tenant data is strictly isolated — sign out to use {tenant.name}.</p>
          <Button className="mt-5" onClick={() => logout()}>Sign out</Button></div>
      </div>
    );
  }
  if (!roles.includes(user.role)) return <Navigate to={to(user.role === 'super_admin' ? '/admin' : ROLE_HOME[user.role])} replace />;
  return <Outlet />;
}
 
export function RequirePlatformAdmin() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!user || user.role !== 'super_admin') return <Navigate to={`/platform/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Outlet />;
}