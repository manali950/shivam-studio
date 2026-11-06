import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Calendar, CalendarCheck, Home, Images, LogOut, User, Video, type LucideIcon } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { ROLE_LABEL, useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { services } from '@/services/data-provider';
import { Avatar } from '../ui/SmartImage';
import { Logo } from './PublicLayout';
import { TLink } from '../shared/TLink';
 
const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/portal', label: 'Home', icon: Home, end: true }, { to: '/portal/bookings', label: 'Bookings', icon: CalendarCheck }, { to: '/portal/events', label: 'Events', icon: Calendar },
  { to: '/portal/photos', label: 'Photos', icon: Images }, { to: '/portal/videos', label: 'Videos', icon: Video }, { to: '/portal/notifications', label: 'Alerts', icon: Bell }, { to: '/portal/profile', label: 'Profile', icon: User },
];
 
/** Elegant client portal: top bar on desktop, bottom tab bar on mobile. */
export function PortalShell() {
  const { tenant, to } = useTenant(); const { user, logout } = useAuth(); const nav = useNavigate();
  const unread = useQuery({ queryKey: ['notifications', tenant.id, 'unread', user!.id], queryFn: () => services.notifications.list(tenant.id, user!.id, { unread: true, pageSize: 50 }), refetchInterval: 30_000 });
  const count = unread.data?.total ?? 0;
  return (
    <div className="min-h-screen bg-paper pb-20 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="container-x flex h-14 items-center justify-between gap-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Client portal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={to(n.to)} end={n.end} className={({ isActive }) => cn('relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition', isActive ? 'bg-ink text-white' : 'text-ink-muted hover:bg-paper-2 hover:text-ink')}>
                <n.icon className="h-4 w-4" />{n.label}{n.to.endsWith('notifications') && count > 0 && <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-contrast">{count}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <TLink to="/" className="hidden text-xs text-ink-muted hover:text-ink lg:inline">Visit website</TLink>
            <Avatar src={user?.avatarUrl} name={user?.name ?? '?'} size={30} />
            <button onClick={async () => { await logout(); nav(to('/login')); }} aria-label="Sign out" title={`${user?.name} · ${user && ROLE_LABEL[user.role]} — sign out`} className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-paper-2"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      <main className="container-x py-5 sm:py-8"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-white/95 backdrop-blur md:hidden" aria-label="Client portal">
        {NAV.filter((n) => n.to !== '/portal/profile').map((n) => (
          <NavLink key={n.to} to={to(n.to)} end={n.end} className={({ isActive }) => cn('relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium', isActive ? 'text-brand-dark' : 'text-ink-muted')}>
            <n.icon className="h-5 w-5" />{n.label}{n.to.endsWith('notifications') && count > 0 && <span className="absolute right-3 top-1 h-2 w-2 rounded-full bg-red-500" />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}