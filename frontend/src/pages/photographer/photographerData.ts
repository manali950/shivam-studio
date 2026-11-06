import { useAuth } from '@/context/AuthContext';
import { useTenantQuery } from '@/hooks/data';
import { services } from '@/services/data-provider';
import type { StudioEvent } from '@/types';
 
/** Queries for the photographer portal. The provider/backend restricts rows to events the photographer is assigned to. */
export function useMyEvents() {
  const { user } = useAuth();
  return useTenantQuery(['events', 'photographer', user!.photographerId], (t) => services.events.list(t, { photographerId: user!.photographerId ?? undefined, pageSize: 100, sort: 'date', order: 'asc' }));
}
export function useMyBookings() {
  const { user } = useAuth();
  return useTenantQuery(['bookings', 'photographer', user!.photographerId], (t) => services.bookings.list(t, { photographerId: user!.photographerId ?? undefined, pageSize: 100, sort: 'eventDate', order: 'asc' }));
}
export function useMyGalleries() {
  return useTenantQuery(['galleries', 'photographer'], (t) => services.galleries.list(t, { pageSize: 100 }));
}
 
/** What the photographer still has to do for an event. */
export function nextAction(e: StudioEvent): { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' } {
  const d = e.delivery;
  if (e.status === 'cancelled') return { label: 'Cancelled', tone: 'neutral' };
  if (e.status !== 'completed') return { label: e.progress === 'shooting' ? 'Shoot in progress' : 'Upcoming shoot', tone: 'info' };
  if (d.galleryPublishedAt) return { label: 'Delivered', tone: 'success' };
  if (d.highlightsPublishedAt) return { label: 'Highlights live · studio finishing gallery', tone: 'success' };
  if (d.highlightsSubmittedAt) return { label: 'Highlights in studio review', tone: 'info' };
  return { label: 'Submit highlights', tone: 'warning' };
}
export const needsHighlights = (e: StudioEvent) => e.status === 'completed' && !e.delivery.highlightsSubmittedAt;