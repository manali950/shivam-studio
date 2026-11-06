import { Camera, CreditCard, Home, Settings, Store } from 'lucide-react';
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';
 
const NAV: NavItem[] = [
  { to: '/platform', label: 'Overview', icon: Home, end: true }, { to: '/platform/studios', label: 'Studios', icon: Store },
  { to: '/platform/plans', label: 'Plans', icon: CreditCard }, { to: '/platform/settings', label: 'Platform settings', icon: Settings },
];
const Brand = () => <span className="flex min-w-0 items-center gap-2.5 text-white"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-500/30"><Camera className="h-4 w-4" /></span><span className="truncate font-serif text-[17px] font-semibold">Platform</span></span>;
const Mini = () => <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-500/30 text-white"><Camera className="h-4 w-4" /></span>;
 
export default function PlatformShell() {
  return <DashboardShell variant="platform" nav={NAV} brand={<Brand />} brandMini={<Mini />} resolve={(p) => p} logoutTo="/platform/login" />;
}