import type { AppNotification, ID, NotificationType } from '@/types';
import { uid } from '@/lib/utils';
import { ApiError } from '../../errors';
import type { CrudService, ListParams, Paged } from '../types';
import { actor, getDb, save, scoped } from './db';
 
export const delay = (ms = 90) => new Promise<void>((r) => setTimeout(r, ms));
export const clone = <T,>(x: T): T => structuredClone(x);
export const now = () => new Date().toISOString();
 
export function paginate<T>(items: T[], p: ListParams = {}): Paged<T> {
  const pageSize = Math.max(1, p.pageSize ?? 1000);
  const page = Math.max(1, p.page ?? 1);
  return { items: clone(items.slice((page - 1) * pageSize, page * pageSize)), total: items.length, page, pageSize };
}
  
export function sortItems<T>(items: T[], sort?: string, order: 'asc' | 'desc' = 'asc'): T[] {
  if (!sort) return items;
  const dir = order === 'desc' ? -1 : 1;
  return [...items].sort((a: any, b: any) => (a[sort] > b[sort] ? 1 : a[sort] < b[sort] ? -1 : 0) * dir);
}
 
/** Mock equivalent of the backend tenant guard: a signed-in non-super-admin may only touch their own tenant. */
export function assertTenantAccess(tenantId: ID) {
  const a = actor();
  if (a && a.role !== 'super_admin' && a.tenantId !== tenantId)
    throw new ApiError(403, 'TENANT_FORBIDDEN', 'You do not have access to this studio.');
}
export function requireRole(...roles: string[]) {
  const a = actor();
  if (!a || !roles.includes(a.role)) throw new ApiError(403, 'FORBIDDEN', 'You are not allowed to perform this action.');
  return a;
}
export const isStaff = () => { const a = actor(); return !!a && (a.role === 'studio_admin' || a.role === 'super_admin'); };
 
export function notify(tenantId: ID, userIds: (ID | null | undefined)[], n: { type: NotificationType; title: string; body: string; link: string }) {
  const db = getDb();
  [...new Set(userIds.filter(Boolean) as ID[])].forEach((userId) => {
    const item: AppNotification = { id: uid('ntf'), tenantId, userId, read: false, createdAt: now(), ...n };
    db.notifications.push(item);
  });
}
export const adminIds = (tenantId: ID) => getDb().users.filter((u) => u.tenantId === tenantId && u.role === 'studio_admin').map((u) => u.id);
export const clientUserId = (clientId: ID | null) => getDb().clients.find((c) => c.id === clientId)?.userId ?? null;
 
export function notFound(what: string): never { throw new ApiError(404, 'NOT_FOUND', `${what} not found`); }
 
interface CrudOpts<T, C, U, F> {
  key: Exclude<keyof ReturnType<typeof getDb>, 'settings'>;
  prefix: string; label: string;
  search?: (i: T) => (string | undefined | null)[];
  filter?: (i: T, p: F) => boolean;
  defaults?: (tenantId: ID, input: C) => Partial<T>;
  beforeSave?: (i: T, input: C | U, mode: 'create' | 'update') => void;
  scope?: (items: T[], tenantId: ID) => T[];            // role-based row scoping (public / client / photographer)
  writeRoles?: string[];                                // who may mutate (default: studio admin)
  sort?: string; order?: 'asc' | 'desc';
  afterRemove?: (i: T) => void;
}
 
/** Generic tenant-scoped CRUD used by most collections — mirrors the backend's generic repository. */
export function crud<T extends { id: ID; tenantId: ID }, C = Partial<T>, U = Partial<T>, F extends ListParams = ListParams>(
  o: CrudOpts<T, C, U, F>,
): CrudService<T, C, U, F> {
  const col = () => getDb()[o.key] as unknown as T[];
  const visible = (tenantId: ID) => {
    const rows = col().filter((r) => r.tenantId === tenantId);
    return o.scope ? o.scope(rows, tenantId) : rows;
  };
  const guard = (tenantId: ID) => { assertTenantAccess(tenantId); requireRole(...(o.writeRoles ?? ['studio_admin', 'super_admin'])); };
  return {
    async list(tenantId, params = {} as F) {
      await delay();
      return scoped(tenantId, () => {
        let rows = visible(tenantId);
        if (params.search && o.search) rows = rows.filter((r) => o.search!(r).some((h) => h?.toLowerCase().includes(params.search!.toLowerCase())));
        if (o.filter) rows = rows.filter((r) => o.filter!(r, params));
        rows = sortItems(rows, params.sort ?? o.sort, params.order ?? o.order ?? 'asc');
        return paginate(rows, params);
      });
    },
    async get(tenantId, id) {
      await delay(50);
      return scoped(tenantId, () => {
        const r = visible(tenantId).find((x) => x.id === id);
        return r ? clone(r) : notFound(o.label);
      });
    },
    async create(tenantId, input) {
      await delay();
      guard(tenantId);
      const item = { id: uid(o.prefix), createdAt: now(), ...(o.defaults?.(tenantId, input) ?? {}), ...(input as object), tenantId } as unknown as T;
      o.beforeSave?.(item, input, 'create');
      col().push(item); save();
      return clone(item);
    },
    async update(tenantId, id, input) {
      await delay();
      guard(tenantId);
      const item = col().find((x) => x.id === id && x.tenantId === tenantId);
      if (!item) return notFound(o.label);
      // Validate on a copy so a rejected update never leaves the stored record half-modified.
      const next = { ...item, ...(input as object), id, tenantId } as T;
      o.beforeSave?.(next, input, 'update');
      Object.assign(item, next); save();
      return clone(item);
    },
    async remove(tenantId, id) {
      await delay();
      guard(tenantId);
      const arr = col(); const idx = arr.findIndex((x) => x.id === id && x.tenantId === tenantId);
      if (idx < 0) return notFound(o.label);
      const [gone] = arr.splice(idx, 1); o.afterRemove?.(gone); save();
    },
  };
}