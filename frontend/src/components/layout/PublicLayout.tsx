import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Facebook, Globe, Instagram, Mail, MapPin, Menu, MessageCircle, Phone, X, Youtube, Twitter } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { ROLE_HOME, useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { TLink, TNavLink } from '../shared/TLink';
import { btn } from '../ui/Button';
 
const NAV = [
  ['/', 'Home'], ['/about', 'About'], ['/photographers', 'Photographers'], ['/services', 'Services'], ['/packages', 'Packages'],
  ['/portfolio', 'Portfolio'], ['/videos', 'Films'], ['/events', 'Events'], ['/blog', 'Journal'], ['/contact', 'Contact'],
] as const;
 
export function Logo({ light, className }: { light?: boolean; className?: string }) {
  const { tenant, config } = useTenant();
  return (
    <TLink to="/" className={cn('flex min-w-0 items-center gap-2.5', className)} aria-label={`${tenant.name} home`}>
      <img src={config.branding.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg" />
      <span className={cn('truncate font-serif text-xl font-semibold leading-none tracking-tight', light ? 'text-white' : 'text-ink')}>{tenant.name}</span>
    </TLink>
  );
}
 
export function PublicLayout() {
  const { tenant, config, to } = useTenant();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const mine = user && (user.tenantId === tenant.id || user.role === 'super_admin');
 
  useEffect(() => { const f = () => setScrolled(window.scrollY > 30); f(); window.addEventListener('scroll', f, { passive: true }); return () => window.removeEventListener('scroll', f); }, []);
  useEffect(() => { setOpen(false); window.scrollTo({ top: 0 }); }, [pathname]);
 
  const dark = !scrolled && !open;
  const s = config.social;
  const socials = [[s.instagram, Instagram, 'Instagram'], [s.facebook, Facebook, 'Facebook'], [s.youtube, Youtube, 'YouTube'], [s.twitter, Twitter, 'Twitter'], [s.pinterest, Globe, 'Pinterest']] as const;
 
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only z-[70] bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2">Skip to content</a>
      <header className={cn('fixed inset-x-0 top-0 z-40 transition-all duration-300', dark ? 'bg-transparent' : 'border-b border-line/70 bg-paper/90 shadow-card backdrop-blur-md')}>
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Logo light={dark} />
          <nav className="hidden items-center gap-5 xl:flex" aria-label="Primary">
            {NAV.map(([p, l]) => (
              <TNavLink key={p} to={p} end={p === '/'} className={({ isActive }) => cn('link-underline text-[13px] font-medium tracking-wide transition-colors', dark ? 'text-white/85 hover:text-white' : 'text-ink-2 hover:text-ink', isActive && (dark ? 'text-white' : 'text-brand-dark'))}>{l}</TNavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {mine
              ? <Link to={to(ROLE_HOME[user!.role] === '/platform' ? '/admin' : ROLE_HOME[user!.role])} className={cn('hidden text-[13px] font-medium sm:inline', dark ? 'text-white/90 hover:text-white' : 'text-ink-2 hover:text-ink')}>My dashboard</Link>
              : <TLink to="/login" className={cn('hidden text-[13px] font-medium sm:inline', dark ? 'text-white/90 hover:text-white' : 'text-ink-2 hover:text-ink')}>Sign in</TLink>}
            <TLink to="/booking" className={btn('primary', 'sm', 'hidden sm:inline-flex')}>Book now</TLink>
            <button className={cn('rounded-lg p-2 xl:hidden', dark ? 'text-white' : 'text-ink')} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
          </div>
        </div>
        {open && (
          <nav className="container-x animate-fade-in border-t border-line bg-paper pb-5 pt-2 xl:hidden" aria-label="Mobile">
            <ul className="grid grid-cols-2 gap-x-4">
              {NAV.map(([p, l]) => <li key={p}><TNavLink to={p} end={p === '/'} className={({ isActive }) => cn('block border-b border-line/60 py-3 text-sm font-medium', isActive ? 'text-brand-dark' : 'text-ink-2')}>{l}</TNavLink></li>)}
            </ul>
            <div className="mt-4 flex gap-2">
              <TLink to="/booking" className={btn('primary', 'md', 'flex-1')}>Book now</TLink>
              <TLink to={mine ? ROLE_HOME[user!.role] === '/platform' ? '/admin' : ROLE_HOME[user!.role] : '/login'} className={btn('outline', 'md', 'flex-1')}>{mine ? 'Dashboard' : 'Sign in'}</TLink>
            </div>
          </nav>
        )}
      </header>
 
      <main id="main" className="flex-1"><Outlet /></main>
 
      <footer className="bg-ink text-white/70">
        <div className="container-x grid gap-10 py-14 md:grid-cols-12">
          <div className="md:col-span-5">
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">{config.footer.text || config.branding.tagline}</p>
            <div className="mt-5 flex gap-2">
              {socials.filter(([u]) => u).map(([u, Icon, label]) => <a key={label} href={u} target="_blank" rel="noreferrer noopener" aria-label={label} className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/80 transition hover:border-brand hover:bg-brand hover:text-brand-contrast"><Icon className="h-4 w-4" /></a>)}
            </div>
          </div>
          <div className="md:col-span-3">
            <h4 className="eyebrow !text-brand">Explore</h4>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{NAV.slice(1).map(([p, l]) => <li key={p}><TLink to={p} className="transition hover:text-white">{l}</TLink></li>)}</ul>
          </div>
          <div className="md:col-span-4">
            <h4 className="eyebrow !text-brand">Visit & contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {config.contact.address && <li className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{config.contact.address}</li>}
              {config.contact.phone && <li className="flex gap-2.5"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><a href={`tel:${config.contact.phone.replace(/\s/g, '')}`} className="hover:text-white">{config.contact.phone}</a></li>}
              {config.contact.email && <li className="flex gap-2.5"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" /><a href={`mailto:${config.contact.email}`} className="break-all hover:text-white">{config.contact.email}</a></li>}
              {config.contact.hours && <li className="pl-6 text-white/50">{config.contact.hours}</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10"><div className="container-x flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-white/45"><span>{config.footer.copyright}</span><span>Powered by shivamStudio</span></div></div>
      </footer>
 
      {config.contact.whatsapp && (
        <a href={`https://wa.me/${config.contact.whatsapp}?text=${encodeURIComponent(`Hi ${tenant.name}, I'd like to know more.`)}`} target="_blank" rel="noreferrer noopener" aria-label="Chat on WhatsApp"
          className="fixed bottom-5 right-5 z-30 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-pop transition hover:scale-105"><MessageCircle className="h-6 w-6" /></a>
      )}
    </div>
  );
}