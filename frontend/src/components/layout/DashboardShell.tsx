import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronsLeft, ChevronsRight, ExternalLink, LogOut, Menu, Plus, Search, X, type LucideIcon } from 'lucide-react';
import { ROLE_LABEL, useAuth } from '@/context/AuthContext';
import { cn, timeAgo } from '@/lib/utils';
import { services } from '@/services/data-provider';
import { Avatar } from '../ui/SmartImage';
 
export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: number; group?: string }
export interface QuickAction { label: string; to: string; icon: LucideIcon }
 
interface Props {
  nav: NavItem[]; brand: ReactNode; brandMini?: ReactNode; variant: 'studio' | 'platform';
  resolve: (p: string) => string; tenantId?: string; quick?: QuickAction[]; searchTo?: string; viewSiteTo?: string; logoutTo: string; banner?: ReactNode;
}
 
const THEME = {
  studio: { side: 'bg-ink text-white/70', active: 'bg-white/10 text-white', hover: 'hover:bg-white/5 hover:text-white', bar: 'bg-brand', group: 'text-white/35', border: 'border-white/10' },
  platform: { side: 'bg-[#1b1840] text-white/70', active: 'bg-violet-500/25 text-white', hover: 'hover:bg-white/5 hover:text-white', bar: 'bg-violet-400', group: 'text-white/35', border: 'border-white/10' },
};
 
function useCollapsed() {
  const [c, setC] = useState(() => { try { const s = localStorage.getItem('ss.sidebar'); if (s) return s === '1'; } catch { /* ignore */ } return window.innerWidth < 1280; });
  useEffect(() => { try { localStorage.setItem('ss.sidebar', c ? '1' : '0'); } catch { /* ignore */ } }, [c]);
  return [c, setC] as const;
}
 
function useClickAway(cb: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cb(); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, [cb]);
  return ref;
}
 
function Bell_({ tenantId, resolve }: { tenantId: string; resolve: (p: string) => string }) {
  const { user } = useAuth(); const [open, setOpen] = useState(false); const qc = useQueryClient(); const nav = useNavigate();
  const ref = useClickAway(() => setOpen(false));
  const q = useQuery({ queryKey: ['notifications', tenantId, 'bell', user!.id], queryFn: () => services.notifications.list(tenantId, user!.id, { pageSize: 6 }), refetchInterval: 30_000 });
  const unread = q.data?.items.filter((n) => !n.read).length ?? 0;
  const readAll = async () => { await services.notifications.markAllRead(tenantId, user!.id); qc.invalidateQueries({ queryKey: ['notifications', tenantId] }); };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-paper-2"><Bell className="h-[18px] w-[18px]" />{unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}</button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-1.5rem)] animate-fade-in overflow-hidden rounded-xl border border-line bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-line px-3 py-2"><p className="text-sm font-semibold">Notifications</p>{unread > 0 && <button onClick={readAll} className="text-xs font-medium text-brand-dark">Mark all read</button>}</div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {q.data?.items.length === 0 && <li className="p-4 text-center text-sm text-ink-muted">You're all caught up.</li>}
            {q.data?.items.map((n) => (
              <li key={n.id}><button onClick={async () => { setOpen(false); if (!n.read) { await services.notifications.markRead(tenantId, n.id); qc.invalidateQueries({ queryKey: ['notifications', tenantId] }); } nav(resolve(n.link)); }} className={cn('flex w-full gap-2 px-3 py-2.5 text-left hover:bg-paper-2', !n.read && 'bg-brand-soft/40')}>
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-brand')} /><span className="min-w-0"><span className="block truncate text-[13px] font-medium">{n.title}</span><span className="line-clamp-2 text-xs text-ink-muted">{n.body}</span><span className="text-[10px] text-ink-faint">{timeAgo(n.createdAt)}</span></span>
              </button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
 
export function DashboardShell({ nav, brand, brandMini, variant, resolve, tenantId, quick, searchTo, viewSiteTo, logoutTo, banner }: Props) {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useCollapsed(); const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false); const [plus, setPlus] = useState(false); const [term, setTerm] = useState('');
  const menuRef = useClickAway(() => setMenu(false)); const plusRef = useClickAway(() => setPlus(false));
  const t = THEME[variant];
  useEffect(() => { setDrawer(false); }, [pathname]);
 
  const groups = nav.reduce<Record<string, NavItem[]>>((a, i) => { (a[i.group ?? ''] ||= []).push(i); return a; }, {});
  const Sidebar = ({ rail }: { rail: boolean }) => (
    <div className={cn('flex h-full flex-col', t.side)}>
      <div className={cn('flex h-14 shrink-0 items-center border-b px-3', t.border, rail && 'justify-center px-0')}>{rail ? (brandMini ?? <span className="scale-90">{brand}</span>) : brand}</div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Dashboard">
        {Object.entries(groups).map(([g, items]) => (
          <div key={g} className="mb-3">
            {g && !rail && <p className={cn('mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]', t.group)}>{g}</p>}
            {g && rail && <div className={cn('mx-2 mb-2 border-t', t.border)} />}
            <ul className="space-y-0.5">
              {items.map((i) => (
                <li key={i.to}>
                  <NavLink to={resolve(i.to)} end={i.end} title={rail ? i.label : undefined} className={({ isActive }) => cn('group relative flex h-9 items-center gap-2.5 rounded-lg text-[13px] font-medium transition', rail ? 'justify-center' : 'px-2.5', isActive ? t.active : t.hover)}>
                    {({ isActive }) => (<>
                      {isActive && <span className={cn('absolute -left-2 top-1.5 h-6 w-1 rounded-r', t.bar)} />}
                      <i.icon className="h-[18px] w-[18px] shrink-0" />{!rail && <span className="flex-1 truncate">{i.label}</span>}
                      {!!i.badge && (rail ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand" /> : <span className="rounded-full bg-brand px-1.5 text-[10px] font-bold text-brand-contrast">{i.badge}</span>)}
                    </>)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <button onClick={() => setCollapsed(!collapsed)} className={cn('hidden h-10 shrink-0 items-center gap-2 border-t px-4 text-xs text-white/50 hover:text-white lg:flex', t.border, rail && 'justify-center px-0')} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {rail ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Collapse</>}
      </button>
    </div>
  );
 
  return (
    <div className="min-h-screen bg-[#f6f4ef]">
      <aside className={cn('fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block', collapsed ? 'w-16' : 'w-56')}><Sidebar rail={collapsed} /></aside>
      {drawer && (<div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 animate-fade-in bg-ink/50" onClick={() => setDrawer(false)} /><div className="relative h-full w-64 animate-slide-in [animation-direction:normal]"><Sidebar rail={false} /><button aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute right-2 top-3 text-white/70"><X className="h-5 w-5" /></button></div></div>)}
 
      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-16' : 'lg:pl-56')}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur sm:px-5">
          <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-paper-2 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}><Menu className="h-5 w-5" /></button>
          {searchTo && (
            <form className="relative hidden max-w-sm flex-1 sm:block" onSubmit={(e) => { e.preventDefault(); navigate(`${resolve(searchTo)}?q=${encodeURIComponent(term)}`); }}>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search bookings by name, reference, venue…" aria-label="Search bookings" className="input h-9 bg-paper pl-8" />
            </form>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {quick && quick.length > 0 && (
              <div className="relative" ref={plusRef}>
                <button onClick={() => setPlus((v) => !v)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-brand-contrast hover:bg-brand-dark hover:text-white" aria-haspopup="menu" aria-expanded={plus}><Plus className="h-4 w-4" /><span className="hidden sm:inline">Quick action</span></button>
                {plus && <div role="menu" className="absolute right-0 z-40 mt-2 w-56 animate-fade-in rounded-xl border border-line bg-white p-1 shadow-pop">{quick.map((a) => <Link role="menuitem" key={a.label} to={resolve(a.to)} onClick={() => setPlus(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-paper-2"><a.icon className="h-4 w-4 text-ink-muted" />{a.label}</Link>)}</div>}
              </div>
            )}
            {tenantId && <Bell_ tenantId={tenantId} resolve={resolve} />}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-paper-2" aria-haspopup="menu" aria-expanded={menu}>
                <Avatar src={user?.avatarUrl} name={user?.name ?? '?'} size={30} /><span className="hidden text-left leading-tight sm:block"><span className="block max-w-[9rem] truncate text-[13px] font-medium">{user?.name}</span><span className="block text-[10px] text-ink-muted">{user && ROLE_LABEL[user.role]}</span></span>
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 z-40 mt-2 w-56 animate-fade-in rounded-xl border border-line bg-white p-1 shadow-pop">
                  <div className="border-b border-line px-3 py-2"><p className="truncate text-sm font-medium">{user?.name}</p><p className="truncate text-xs text-ink-muted">{user?.email}</p></div>
                  {viewSiteTo && <Link role="menuitem" to={resolve(viewSiteTo)} target="_blank" className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-paper-2"><ExternalLink className="h-4 w-4 text-ink-muted" />View public website</Link>}
                  <button role="menuitem" onClick={async () => { await logout(); navigate(logoutTo); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        {banner}
        <main className="mx-auto w-full max-w-[1500px] p-3 sm:p-5"><Outlet /></main>
      </div>
    </div>
  );
}