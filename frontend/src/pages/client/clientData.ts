import { useAuth } from '@/context/AuthContext';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
 
/** Shared client-portal queries. Every call is tenant-scoped; the provider additionally restricts rows to the signed-in client. */
export function useClientBookings() {
  const { user } = useAuth();
  return useTenantQuery(['bookings', 'mine'], (t) => services.bookings.list(t, { clientId: user!.clientId ?? undefined, pageSize: 50, sort: 'eventDate', order: 'desc' }));
}
export function useClientEvents() {
  const { user } = useAuth();
  return useTenantQuery(['events', 'mine'], (t) => services.events.list(t, { clientId: user!.clientId ?? undefined, pageSize: 50, sort: 'date', order: 'desc' }));
}
export function useClientGalleries() {
  const { user } = useAuth();
  return useTenantQuery(['galleries', 'mine'], (t) => services.galleries.list(t, { clientId: user!.clientId ?? undefined, pageSize: 50 }));
}
export const useAllPhotographers = () => useTenantQuery(['photographers', 'all'], (t) => services.photographers.list(t, { pageSize: 50, sort: 'name' }));
export function useClientVideos() {
  const { user } = useAuth();
  return useTenantQuery(['videos', 'mine'], (t) => services.videos.list(t, { pageSize: 50, clientId: user!.clientId ?? undefined } as any));
}
export function useClientDrive() {
  return useTenantQuery(['drive', 'mine'], (t) => services.drive.list(t, { pageSize: 50, visibility: 'client' } as any));
}
 
/** id → display name lookups for services and packages (public catalogue; tenant-scoped). */
export function useCatalogue() {
  const s = useTenantQuery(['services', 'public'], (t) => services.services.list(t, { pageSize: 30, status: 'active', sort: 'sortOrder' } as any));
  const p = useTenantQuery(['packages', 'public'], (t) => services.packages.list(t, { pageSize: 50, status: 'active', sort: 'sortOrder' } as any));
  return {
    service: (id: string) => s.data?.items.find((x) => x.id === id)?.name ?? 'Photography session',
    pkg: (id: string | null) => (id ? p.data?.items.find((x) => x.id === id)?.name ?? 'Custom package' : 'Custom quote'),
  };
}