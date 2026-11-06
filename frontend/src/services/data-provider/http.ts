import { ApiError } from '../errors';
import type { Paged } from './types';
 
const BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:5000/api/v1').replace(/\/$/, '');
 
type Query = Record<string, string | number | boolean | undefined | null>;
interface Opts { query?: Query; body?: unknown; tenantId?: string }
interface Envelope<T> { data: T; meta?: { page: number; pageSize: number; total: number } }
 
/**
 * Thin fetch wrapper. Auth is an httpOnly cookie (credentials: include). `X-Tenant-Id` identifies the studio
 * for public pages; the server ALWAYS re-validates it against the authenticated user — it is never trusted.
 */
async function raw<T>(method: string, path: string, { query, body, tenantId }: Opts = {}): Promise<Envelope<T>> {
  const qs = query ? Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&') : '';
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
      method, credentials: 'include',
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the API. Is the backend running and VITE_API_BASE_URL correct?');
  }
  if (res.status === 204) return { data: undefined as T };
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'HTTP_ERROR', json?.error?.message ?? res.statusText, json?.error?.details);
  return json as Envelope<T>;
}
 
export const http = {
  get: async <T,>(path: string, o?: Opts) => (await raw<T>('GET', path, o)).data,
  post: async <T,>(path: string, body?: unknown, o?: Opts) => (await raw<T>('POST', path, { ...o, body: body ?? {} })).data,
  put: async <T,>(path: string, body?: unknown, o?: Opts) => (await raw<T>('PUT', path, { ...o, body })).data,
  patch: async <T,>(path: string, body?: unknown, o?: Opts) => (await raw<T>('PATCH', path, { ...o, body })).data,
  del: async (path: string, o?: Opts) => { await raw<void>('DELETE', path, o); },
  page: async <T,>(path: string, o?: Opts): Promise<Paged<T>> => {
    const r = await raw<T[]>('GET', path, o);
    return { items: r.data, total: r.meta?.total ?? r.data.length, page: r.meta?.page ?? 1, pageSize: r.meta?.pageSize ?? r.data.length };
  },
};