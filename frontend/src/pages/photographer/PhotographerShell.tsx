import { Calendar, CalendarCheck, Home, User } from 'lucide-react';
import { useTenant } from '@/context/TenantContext';
import { DashboardShell, type NavItem } from '@/components/layout/DashboardShell';
import { StudioBrand, StudioBrandMini } from '@/components/layout/StudioBrand';
import { needsHighlights, useMyEvents } from './photographerData';
 
export default function PhotographerShell() {
  const { tenant, to } = useTenant();
  const events = useMyEvents();
  const todo = events.data?.items.filter(needsHighlights).length ?? 0;
  const nav: NavItem[] = [
    { to: '/photographer', label: 'Overview', icon: Home, end: true },
    { to: '/photographer/events', label: 'My events', icon: Calendar, badge: todo },
    { to: '/photographer/bookings', label: 'Bookings', icon: CalendarCheck },
    { to: '/photographer/profile', label: 'Profile', icon: User },
  ];
  return <DashboardShell variant="studio" nav={nav} brand={<StudioBrand />} brandMini={<StudioBrandMini />} resolve={to} tenantId={tenant.id} viewSiteTo="/" logoutTo={to('/login')} />;
}