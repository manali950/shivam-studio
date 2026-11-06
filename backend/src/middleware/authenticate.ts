import type { Request } from 'express';
import { withSystemTx } from '../db/pool.js';
import { SESSION_COOKIE } from '../lib/cookies.js';
import { isUuid } from '../db/pool.js';
import { readToken } from '../lib/jwt.js';
import { asyncHandler } from '../lib/handlers.js';
import type { Principal } from '../lib/types.js';
 
interface Row {
  id: string; tenant_id: string | null; role: Principal['role']; name: string; email: string; phone: string; avatar_url: string;
  status: 'active' | 'disabled'; password_changed_at: string; client_id: string | null; photographer_id: string | null; tenant_ok: boolean;
}
 
/** Loads the signed-in user fresh from the database; disabled users, deleted studios and tokens older than the last password change are rejected. */
export async function loadPrincipal(userId: string, issuedAt?: number): Promise<Principal | null> {
  const row = await withSystemTx(async (db) => (await db.query<Row>(
    `SELECT u.id, u.tenant_id, u.role, u.name, u.email, u.phone, u.avatar_url, u.status, u.password_changed_at,
            (SELECT c.id FROM clients c WHERE c.user_id = u.id AND c.deleted_at IS NULL) AS client_id,
            (SELECT p.id FROM photographers p WHERE p.user_id = u.id AND p.deleted_at IS NULL) AS photographer_id,
            (u.tenant_id IS NULL OR EXISTS (SELECT 1 FROM tenants t WHERE t.id = u.tenant_id AND t.deleted_at IS NULL)) AS tenant_ok
       FROM users u WHERE u.id = $1 AND u.deleted_at IS NULL`, [userId])).rows[0]);
  if (!row || row.status !== 'active' || !row.tenant_ok) return null;
  if (issuedAt !== undefined && issuedAt < Math.floor(Date.parse(row.password_changed_at) / 1000)) return null;
  return {
    userId: row.id, role: row.role, tenantId: row.tenant_id, name: row.name, email: row.email, phone: row.phone, avatarUrl: row.avatar_url,
    clientId: row.client_id, photographerId: row.photographer_id, status: row.status,
  };
}
 
const tokenOf = (req: Request): string | null => {
  const c = req.cookies?.[SESSION_COOKIE];
  if (typeof c === 'string' && c) return c;
  const h = req.header('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
};
 
/** Soft authentication: sets req.auth (or null). Routes decide whether anonymous access is acceptable. */
export const authenticate = asyncHandler(async (req, _res, next) => {
  req.auth = null;
  const token = tokenOf(req);
  const claims = token ? readToken(token) : null;
  if (claims && isUuid(claims.sub)) req.auth = await loadPrincipal(claims.sub, claims.iat);
  next();
});