import { BarChart3, BookOpenText, Calendar, CalendarCheck, CalendarPlus, Camera, Film, FolderOpen, Globe, HardDrive, Home, Images, Package, Send, Settings, Star, UserPlus, Users, Video } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { useStudioStats } from '@/hooks/admin';
import { DashboardShell, type NavItem, type QuickAction } from '@/components/layout/DashboardShell';
import { StudioBrand, StudioBrandMini } from '@/components/layout/StudioBrand';
 
export default function AdminShell() {
  const { tenant, to } = useTenant();
  const stats = useStudioStats();
  const t = stats.data?.totals;
  const nav: NavItem[] = [
    { group: 'Overview', to: '/admin', label: 'Dashboard', icon: Home, end: true },
    { group: 'Overview', to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { group: 'Operations', to: '/admin/bookings', label: 'Bookings', icon: CalendarCheck, badge: t?.pendingEnquiries },
    { group: 'Operations', to: '/admin/events', label: 'Events', icon: Calendar },
    { group: 'Operations', to: '/admin/delivery', label: 'Photo delivery', icon: Send, badge: t?.pendingDeliveries },
    { group: 'Operations', to: '/admin/customers', label: 'Customers', icon: Users },
    { group: 'Media', to: '/admin/galleries', label: 'Galleries', icon: Images },
    { group: 'Media', to: '/admin/videos', label: 'YouTube videos', icon: Video },
    { group: 'Media', to: '/admin/drive', label: 'Google Drive', icon: HardDrive },
    { group: 'Studio', to: '/admin/photographers', label: 'Photographers', icon: Camera },
    { group: 'Studio', to: '/admin/services', label: 'Services', icon: Film },
    { group: 'Studio', to: '/admin/packages', label: 'Packages', icon: Package },
    { group: 'Studio', to: '/admin/testimonials', label: 'Testimonials', icon: Star },
    { group: 'Website', to: '/admin/website', label: 'Website content', icon: Globe },
    { group: 'Website', to: '/admin/blog', label: 'Blog', icon: BookOpenText },
    { group: 'Website', to: '/admin/settings', label: 'Settings', icon: Settings },
  ];
  const quick: QuickAction[] = [
    { label: 'New booking', to: '/admin/bookings?new=1', icon: CalendarCheck },
    { label: 'Add event', to: '/admin/events?new=1', icon: CalendarPlus },
    { label: 'Create gallery', to: '/admin/galleries?new=1', icon: FolderOpen },
    { label: 'Add YouTube video', to: '/admin/videos?new=1', icon: Video },
    { label: 'Add photographer', to: '/admin/photographers?new=1', icon: UserPlus },
  ];
  return <DashboardShell variant="studio" nav={nav} quick={quick} brand={<StudioBrand />} brandMini={<StudioBrandMini />} resolve={to} tenantId={tenant.id} searchTo="/admin/bookings" viewSiteTo="/" logoutTo={to('/login')} banner={tenant.status !== 'active' ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">This studio is <b>{tenant.status}</b>{tenant.status === 'trial' ? ' — enjoy your trial.' : ' — the public website is paused.'}</div> : undefined} />;
}