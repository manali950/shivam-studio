/**
 * REST implementation of DataProvider — talks to backend/ (Express + PostgreSQL) at VITE_API_BASE_URL.
 * Endpoint contracts are documented in docs/API.md and mirror the mock provider's behaviour 1:1.
 */
import type { ID } from '@/types';
import { http } from './http';
import type { CrudService, DataProvider, ListParams } from './types';
 
function crudApi<T, C = Partial<T>, U = Partial<T>, F extends ListParams = ListParams>(path: string): CrudService<T, C, U, F> {
  return {
    list: (tenantId, params) => http.page<T>(`/${path}`, { tenantId, query: params as any }),
    get: (tenantId, id) => http.get<T>(`/${path}/${id}`, { tenantId }),
    create: (tenantId, input) => http.post<T>(`/${path}`, input, { tenantId }),
    update: (tenantId, id, input) => http.put<T>(`/${path}/${id}`, input, { tenantId }),
    remove: (tenantId, id) => http.del(`/${path}/${id}`, { tenantId }),
  };
}
 
export function createApiProvider(): DataProvider {
  const t = (tenantId: ID) => ({ tenantId });
  return {
    mode: 'api',
    tenants: {
      resolve: (q) => http.get('/tenants/resolve', { query: q }),
      listPublic: () => http.get('/tenants/public'),
      list: (params) => http.page('/tenants', { query: params as any }),
      get: (id) => http.get(`/tenants/${id}`),
      create: (i) => http.post('/tenants', i),
      update: (id, i) => http.put(`/tenants/${id}`, i),
      setStatus: (id, status) => http.patch(`/tenants/${id}/status`, { status }),
      getConfig: (id) => http.get(`/tenants/${id}/config`),
      submitContact: (id, i) => http.post<void>(`/tenants/${id}/contact`, i, { tenantId: id }),
      updateConfig: (id, patch) => http.put(`/tenants/${id}/config`, patch),
    },
    auth: {
      login: (i) => http.post('/auth/login', i, i.tenantId ? t(i.tenantId) : undefined),
      register: (i) => http.post('/auth/register', i, t(i.tenantId)),
      logout: () => http.post('/auth/logout'),
      me: async () => { try { return await http.get('/auth/me'); } catch (e: any) { if (e?.status === 401) return null; throw e; } },
      updateProfile: (p) => http.patch('/auth/me', p),
      changePassword: (i) => http.post('/auth/change-password', i),
    },
    photographers: crudApi('photographers'),
    services: crudApi('services'),
    packages: crudApi('packages'),
    testimonials: crudApi('testimonials'),
    videos: crudApi('videos'),
    drive: crudApi('drive-links'),
    clients: { ...crudApi('clients'), profile: (tid, id) => http.get(`/clients/${id}/profile`, t(tid)) },
    blog: { ...crudApi('blog'), getBySlug: (tid, slug) => http.get(`/blog/by-slug/${encodeURIComponent(slug)}`, t(tid)) },
    bookings: {
      ...crudApi('bookings'),
      setStatus: (tid, id, status, note) => http.patch(`/bookings/${id}/status`, { status, note }, t(tid)),
      assignPhotographers: (tid, id, photographerIds) => http.put(`/bookings/${id}/photographers`, { photographerIds }, t(tid)),
      addNote: (tid, id, text) => http.post(`/bookings/${id}/notes`, { text }, t(tid)),
    },
    events: {
      ...crudApi('events'),
      markCompleted: (tid, id) => http.post(`/events/${id}/complete`, {}, t(tid)),
      updateProgress: (tid, id, progress) => http.patch(`/events/${id}/progress`, { progress }, t(tid)),
      assignPhotographers: (tid, id, photographerIds) => http.put(`/events/${id}/photographers`, { photographerIds }, t(tid)),
      addNote: (tid, id, text) => http.post(`/events/${id}/notes`, { text }, t(tid)),
      updateDelivery: (tid, id, patch) => http.patch(`/events/${id}/delivery`, patch, t(tid)),
    },
    galleries: {
      list: (tid, params) => http.page('/galleries', { ...t(tid), query: params as any }),
      get: (tid, id) => http.get(`/galleries/${id}`, t(tid)),
      create: (tid, i) => http.post('/galleries', i, t(tid)),
      update: (tid, id, i) => http.put(`/galleries/${id}`, i, t(tid)),
      remove: (tid, id) => http.del(`/galleries/${id}`, t(tid)),
      listByEvent: (tid, eventId) => http.get(`/events/${eventId}/galleries`, t(tid)),
      addPhotos: (tid, id, photos) => http.post(`/galleries/${id}/photos`, { photos }, t(tid)),
      updatePhoto: (tid, id, photoId, patch) => http.patch(`/galleries/${id}/photos/${photoId}`, patch, t(tid)),
      removePhoto: (tid, id, photoId) => http.del(`/galleries/${id}/photos/${photoId}`, t(tid)).then(() => http.get(`/galleries/${id}`, t(tid))),
      reorderPhotos: (tid, id, photoIds) => http.put(`/galleries/${id}/photos/order`, { photoIds }, t(tid)),
      setExternalLinks: (tid, id, links) => http.put(`/galleries/${id}/external-links`, { links }, t(tid)),
      submitHighlights: (tid, id, photoIds, note) => http.post(`/galleries/${id}/submit-highlights`, { photoIds, note }, t(tid)),
      publishHighlights: (tid, id) => http.post(`/galleries/${id}/publish`, { stage: 'highlights' }, t(tid)),
      publishComplete: (tid, id) => http.post(`/galleries/${id}/publish`, { stage: 'complete' }, t(tid)),
      portfolio: (tid, params) => http.page('/portfolio', { ...t(tid), query: params as any }),
      sampleLibrary: () => http.get('/galleries/sample-library'),
    },
    notifications: {
      list: (tid, _userId, params) => http.page('/notifications', { ...t(tid), query: params as any }),
      markRead: (tid, id) => http.patch(`/notifications/${id}/read`, {}, t(tid)),
      markAllRead: (tid) => http.post('/notifications/read-all', {}, t(tid)).then(() => undefined),
    },
    analytics: { studioDashboard: (tid) => http.get('/analytics/dashboard', t(tid)) },
    platform: {
      stats: () => http.get('/platform/stats'),
      plans: {
        list: () => http.get('/platform/plans'),
        create: (i) => http.post('/platform/plans', i),
        update: (id, i) => http.put(`/platform/plans/${id}`, i),
        remove: (id) => http.del(`/platform/plans/${id}`),
      },
      getSettings: () => http.get('/platform/settings'),
      updateSettings: (p) => http.put('/platform/settings', p),
    },
  };
}