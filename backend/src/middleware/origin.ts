/**
 * Origin allow-list used for both CORS and CSRF protection.
 * Allowed: CORS_ORIGINS, any subdomain of PLATFORM_BASE_DOMAIN, every live tenant custom domain, and *.localhost in development.
 * Requests without an Origin header (curl, server-to-server) are not browsers and cannot be CSRF'd with a cookie.
 */
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { withSystemTx } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { log } from '../lib/logger.js';
 
let domains = { at: 0, set: new Set<string>() };
async function customDomains(): Promise<Set<string>> {
  if (Date.now() - domains.at < 60_000) return domains.set;
  try {
    const rows = await withSystemTx(async (db) => (await db.query<{ d: string }>('SELECT custom_domain AS d FROM tenants WHERE deleted_at IS NULL AND custom_domain IS NOT NULL')).rows);
    domains = { at: Date.now(), set: new Set(rows.map((r) => r.d.toLowerCase())) };
  } catch (e) { log.warn('Could not refresh custom domains for CORS', { error: (e as Error).message }); domains.at = Date.now() - 50_000; }
  return domains.set;
}
 
export async function isAllowedOrigin(origin: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(origin); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (env.CORS_ORIGINS.includes(`${u.protocol}//${u.host}`)) return true;
  const host = u.hostname.toLowerCase();
  const base = env.PLATFORM_BASE_DOMAIN;
  if (base !== 'localhost' && (host === base || host.endsWith(`.${base}`))) return true;
  if (!env.isProd && host.endsWith('.localhost')) return true;
  const set = await customDomains();
  return set.has(host) || set.has(host.replace(/^www\./, ''));
}
 
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Rejects state-changing requests that come from a browser page on an origin we do not know. */
export async function originGuard(req: Request, _res: Response, next: NextFunction) {
  try {
    const origin = req.header('origin');
    if (!SAFE.has(req.method) && origin && !(await isAllowedOrigin(origin))) throw new AppError(403, 'CSRF_ORIGIN', 'Requests from this origin are not allowed.');
    next();
  } catch (e) { next(e); }
}