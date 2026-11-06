/**
 * In-browser mock database. Seeds from src/data/mock/*.json, persists mutations to localStorage so the
 * demo behaves like a real app across reloads. This file is the ONLY place (with mock-provider.ts)
 * that imports the JSON datasets — pages never do.
 *
 * Dates in the seed are anchored to SEED_ANCHOR and shifted to "today" on first load so the demo never goes stale.
 */
import type {
  AppNotification, BlogPost, Booking, Client, DriveLink, Gallery, Package, Photographer, PlatformSettings,
  Service, StudioEvent, SubscriptionPlan, Tenant, TenantConfig, Testimonial, User, Video,
} from '@/types';
import tenants from '@/data/mock/tenants.json';
import configs from '@/data/mock/tenant-config.json';
import plans from '@/data/mock/plans.json';
import settings from '@/data/mock/platform-settings.json';
import users from '@/data/mock/users.json';
import photographers from '@/data/mock/photographers.json';
import clients from '@/data/mock/clients.json';
import services from '@/data/mock/services.json';
import packages from '@/data/mock/packages.json';
import bookings from '@/data/mock/bookings.json';
import events from '@/data/mock/events.json';
import galleries from '@/data/mock/galleries.json';
import videos from '@/data/mock/videos.json';
import drive from '@/data/mock/drive-links.json';
import testimonials from '@/data/mock/testimonials.json';
import blog from '@/data/mock/blog-posts.json';
import notifications from '@/data/mock/notifications.json';
 
/**
 * MOCK ONLY. Seeded demo accounts carry the shared, public demo password in clear (so the login page can offer one-click demo sign-in).
 * Passwords people choose themselves (register / change password) are never stored in clear: only a salted hash is kept.
 * This is still NOT real security — the "database" is the visitor's own localStorage. The real backend stores scrypt hashes.
 */
export type MockUser = User & { password?: string; passwordHash?: string };
 
export interface MockDB {
  tenants: Tenant[]; configs: TenantConfig[]; plans: SubscriptionPlan[]; settings: PlatformSettings; users: MockUser[];
  photographers: Photographer[]; clients: Client[]; services: Service[]; packages: Package[]; bookings: Booking[];
  events: StudioEvent[]; galleries: Gallery[]; videos: Video[]; drive: DriveLink[]; testimonials: Testimonial[];
  blog: BlogPost[]; notifications: AppNotification[];
}
 
const STORE_KEY = 'shivamstudio.mock.db.v2';
const SESSION_KEY = 'shivamstudio.mock.session.v1';
const SEED_ANCHOR = '2026-11-06';
const DAY = 86400000;
 
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
 
function shift<T>(v: T, days: number): T {
  if (days === 0) return v;
  if (typeof v === 'string') {
    if (DATE_ONLY.test(v)) return new Date(Date.parse(`${v}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10) as T;
    if (ISO_TS.test(v)) return new Date(Date.parse(v) + days * DAY).toISOString() as T;
    return v;
  }
  if (Array.isArray(v)) return v.map((x) => shift(x, days)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shift(x, days)])) as T;
  return v;
}
 
/** Seeded history can never be in the future (the anchor's clock time may be later than "now"): clamp such timestamps. */
function clampPast<T>(v: T, limit: number): T {
  if (typeof v === 'string') return (ISO_TS.test(v) && Date.parse(v) > limit ? new Date(limit).toISOString() : v) as T;
  if (Array.isArray(v)) return v.map((x) => clampPast(x, limit)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clampPast(x, limit)])) as T;
  return v;
}
 
function seed(): MockDB {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const anchor = new Date(`${SEED_ANCHOR}T00:00:00`);
  const days = Math.round((today.getTime() - anchor.getTime()) / DAY);
  const raw = { tenants, configs, plans, settings, users, photographers, clients, services, packages, bookings, events, galleries, videos, drive, testimonials, blog, notifications };
  return clampPast(shift(structuredClone(raw), days), Date.now() - 10 * 60000) as unknown as MockDB;
}
 
let db: MockDB | null = null;
 
export function getDb(): MockDB {
  if (db) return db;
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) { db = JSON.parse(stored) as MockDB; return db; }
  } catch { /* storage unavailable → in-memory only */ }
  db = seed();
  return db;
}
export function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* ignore quota/private mode */ }
}
export function resetDb() {
  db = seed();
  save();
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
 
/* ------------------------------------------------ session (mock auth — NOT production security) */
export interface StoredSession { userId: string; token: string }
export const readSession = (): StoredSession | null => {
  try { const s = localStorage.getItem(SESSION_KEY); return s ? (JSON.parse(s) as StoredSession) : null; } catch { return null; }
};
export const writeSession = (s: StoredSession | null) => {
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
};
/** The signed-in user (mock equivalent of the JWT subject), regardless of which studio a request targets. */
function sessionUser(): MockUser | null {
  const s = readSession();
  return s ? getDb().users.find((u) => u.id === s.userId) ?? null : null;
}
/**
 * Tenant context of the request currently being served (set by `scoped`). A signed-in user acting on a *different*
 * studio is treated as anonymous there, so they only ever see that studio's public data — the same downgrade the
 * backend applies when a JWT's tenant does not match the resolved tenant.
 */
let requestTenant: string | null = null;
export function scoped<T>(tenantId: string, fn: () => T): T {
  const prev = requestTenant; requestTenant = tenantId;
  try { return fn(); } finally { requestTenant = prev; }
}
/** The acting user for the current request (mock equivalent of the authenticated principal). */
export function actor(): MockUser | null {
  const u = sessionUser();
  if (u && requestTenant && u.role !== 'super_admin' && u.tenantId !== requestTenant) return null;
  return u;
}
export const stripPassword = ({ password: _p, passwordHash: _h, ...u }: MockUser): User => u;
 
/** Salted SHA-256 (Web Crypto) for user-chosen mock passwords; falls back to a non-cryptographic digest where Web Crypto is unavailable (plain-http LAN hosts). */
export async function hashPassword(password: string, salt = Math.random().toString(36).slice(2, 12)): Promise<string> {
  const data = `${salt}:${password}`;
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return `${salt}$${Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  }
  let h = 0x811c9dc5; for (let i = 0; i < data.length; i++) { h ^= data.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${salt}$fnv${(h >>> 0).toString(16)}`;
}
export async function checkPassword(u: MockUser, password: string): Promise<boolean> {
  if (u.passwordHash) return (await hashPassword(password, u.passwordHash.split('$')[0])) === u.passwordHash;
  return u.password !== undefined && u.password === password;
}