import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, RotateCcw, Shield, X } from 'lucide-react';
import { DATA_MODE, resetDemoData, services } from '@/services/data-provider';
import { getTenantStrategy } from '@/tenancy/resolve';
import { StatusBadge } from '../ui/Badge';
 
/** Dev-only floating widget: jump between studios (path-based tenancy), open the platform admin, reset mock data. */
export function DevSwitcher() {
  const [open, setOpen] = useState(false);
  const nav = useNavigate(); const { pathname } = useLocation();
  // Dashboards own the bottom-left (sidebar footer) and bottom edge (portal tab bar), so dock the switcher bottom-right there.
  const inApp = /\/(portal|photographer|admin|platform)(\/|$)/.test(pathname);
  const enabled = import.meta.env.VITE_DEV_TENANT_SWITCHER !== 'false' && getTenantStrategy().mode === 'path';
  const q = useQuery({ queryKey: ['tenants-public'], queryFn: () => services.tenants.listPublic(), enabled: enabled && open });
  if (!enabled) return null;
  return (
    <div className={inApp ? 'fixed bottom-20 right-4 z-40 sm:right-6 md:bottom-5 print:hidden' : 'fixed bottom-5 left-5 z-40 print:hidden'}>
      {open ? (
        <div className="w-64 animate-fade-up rounded-xl border border-line bg-white p-2 shadow-pop">
          <div className="flex items-center justify-between px-2 py-1"><span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Switch studio · dev</span><button aria-label="Close" onClick={() => setOpen(false)}><X className="h-4 w-4 text-ink-muted" /></button></div>
          <ul className="max-h-64 overflow-y-auto">
            {q.data?.map((t) => (
              <li key={t.id}><button onClick={() => { nav(`/${t.slug}`); setOpen(false); }} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-paper-2"><span className="truncate">{t.name}</span><StatusBadge status={t.status} /></button></li>
            ))}
          </ul>
          <div className="mt-1 border-t border-line pt-1">
            <button onClick={() => { nav('/platform'); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-paper-2"><Shield className="h-4 w-4 text-ink-muted" />Platform admin</button>
            {DATA_MODE === 'mock' && <button onClick={async () => { await resetDemoData(); window.location.assign('/'); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"><RotateCcw className="h-4 w-4" />Reset demo data</button>}
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} aria-label="Switch studio (development)" title="Switch studio (dev)" className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white shadow-pop ring-2 ring-white transition hover:scale-105"><Building2 className="h-4 w-4" /></button>
      )}
    </div>
  );
}