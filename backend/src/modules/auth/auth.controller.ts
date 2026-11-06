import { withScope } from '../../db/pool.js';
import { clearSessionCookie, setSessionCookie } from '../../lib/cookies.js';
import { forbidden, unauthenticated } from '../../lib/errors.js';
import { asyncHandler, assertNotInMaintenance, send } from '../../lib/handlers.js';
import { signToken } from '../../lib/jwt.js';
import type { Principal } from '../../lib/types.js';
import { toUserDto } from './auth.repository.js';
import { authService } from './auth.service.js';
 
const scopeOf = (tenantId: string | null) => (tenantId ? { tenantId } : { system: true as const });
const session = (res: Parameters<typeof setSessionCookie>[0], s: { userId: string; role: Principal['role']; tenantId: string | null }) => setSessionCookie(res, signToken(s));
const dto = (p: Principal) => toUserDto({ id: p.userId, tenant_id: p.tenantId, role: p.role, name: p.name, email: p.email, phone: p.phone, avatar_url: p.avatarUrl, status: p.status, client_id: p.clientId, photographer_id: p.photographerId });
 
/** The JWT lives only in an httpOnly cookie; `token` is kept in the body for contract compatibility but is always empty. */
export const authController = {
  login: asyncHandler(async (req, res) => {
    const out = await withScope({ system: true }, (db) => authService.login(db, req.body, req.header('x-tenant-id'), req.ip));
    if ('error' in out) throw out.error;
    session(res, out);
    send(res, { user: out.user, token: '' });
  }),
 
  register: asyncHandler(async (req, res) => {
    const tenantId = (req.body?.tenantId ?? req.header('x-tenant-id')) as string | undefined;
    if (!tenantId) throw forbidden('Choose a studio to register with.', 'TENANT_REQUIRED');
    await assertNotInMaintenance(null);
    const out = await withScope({ tenantId: String(tenantId) }, (db) => authService.register(db, { ...req.body, tenantId }, req.ip));
    session(res, out);
    send(res, { user: out.user, token: '' }, 201);
  }),
 
  logout: asyncHandler(async (_req, res) => { clearSessionCookie(res); send(res, undefined); }),
 
  me: asyncHandler(async (req, res) => {
    if (!req.auth) throw unauthenticated();
    send(res, { user: dto(req.auth), token: '' });
  }),
 
  updateProfile: asyncHandler(async (req, res) => {
    const me = req.auth ?? (() => { throw unauthenticated(); })();
    send(res, await withScope(scopeOf(me.tenantId), (db) => authService.updateProfile(db, me, req.body)));
  }),
 
  changePassword: asyncHandler(async (req, res) => {
    const me = req.auth ?? (() => { throw unauthenticated(); })();
    const out = await withScope(scopeOf(me.tenantId), (db) => authService.changePassword(db, me, req.body, req.ip));
    session(res, out);                       // the old token is now invalid (password_changed_at) — issue a fresh one
    send(res, undefined);
  }),
};