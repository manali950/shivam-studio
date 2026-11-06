import type { Db } from '../db/pool.js';
 
export type Role = 'super_admin' | 'studio_admin' | 'photographer' | 'client';
 
/** The authenticated user, re-loaded from the database on every request (so disabling an account takes effect immediately). */
export interface Principal {
  userId: string; role: Role; tenantId: string | null; name: string; email: string; phone: string; avatarUrl: string;
  clientId: string | null; photographerId: string | null; status: 'active' | 'disabled';
}
 
/** Everything a service needs to serve one tenant-scoped request. `db` is a transaction with the tenant (RLS) context applied. */
export interface Ctx {
  tenantId: string;
  /** Null for anonymous visitors — and for signed-in users of ANOTHER studio, who must only ever see public data here. */
  principal: Principal | null;
  /** True when a user of a different studio is calling (writes then answer TENANT_FORBIDDEN instead of UNAUTHENTICATED). */
  crossTenant: boolean;
  db: Db;
  ip?: string;
}
 
/** A page of results; the response layer turns this into { data, meta }. */
export class Page<T> {
  constructor(public items: T[], public total: number, public page: number, public pageSize: number) {}
}
 
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request { auth: Principal | null; requestId: string }
  }
}