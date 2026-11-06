import { z } from 'zod';
import type { Db } from '../../db/pool.js';
import { isUuid } from '../../db/pool.js';
import { auditDb } from '../../lib/audit.js';
import { AppError, conflict, forbidden, invalid, notFound } from '../../lib/errors.js';
import { DUMMY_HASH, hashPassword, passwordProblem, verifyPassword } from '../../lib/password.js';
import type { Principal } from '../../lib/types.js';
import { email, mediaUrl, phone, reqText, uuid } from '../../lib/validation.js';
import { authRepository as repo, toUserDto } from './auth.repository.js';
 
export const loginSchema = z.object({ email: z.string().trim().min(1).max(254), password: z.string().min(1).max(256), tenantId: z.union([uuid, z.null()]).optional() });
export const registerSchema = z.object({ name: reqText(100, 'Enter your name'), email, phone: phone.default(''), password: z.string().max(256), tenantId: uuid });
export const profileSchema = z.object({ name: reqText(100), phone, avatarUrl: mediaUrl }).partial();
export const passwordSchema = z.object({ current: z.string().min(1).max(256), next: z.string().max(256) });
 
const INVALID = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
 
export const authService = {
  /**
   * Returns an outcome instead of throwing so the failed-login audit row is committed with the transaction.
   * Unknown email and wrong password are indistinguishable (same message, and a dummy hash is verified to equalise timing).
   */
  async login(db: Db, body: unknown, headerTenantId: string | undefined, ip?: string): Promise<{ error: AppError } | { userId: string; role: Principal['role']; tenantId: string | null; user: ReturnType<typeof toUserDto> }> {
    const input = loginSchema.parse(body);
    const tenantId = input.tenantId ?? (headerTenantId && isUuid(headerTenantId) ? headerTenantId : null);
    const row = await repo.findByEmail(db, input.email, tenantId);
    const ok = await verifyPassword(input.password, row?.password_hash ?? DUMMY_HASH);
    const fail = async (error: AppError, reason: string) => {
      await auditDb(db, { tenantId, userId: row?.id, action: 'login_failed', entity: 'user', entityId: row?.id, metadata: { reason }, ip });
      return { error };
    };
    if (!row || !ok) return fail(INVALID(), 'bad_credentials');
    if (row.status !== 'active') return fail(forbidden('This account has been disabled.', 'ACCOUNT_DISABLED'), 'disabled');
    if (row.tenant_id) {
      const t = (await db.query<{ status: string }>('SELECT status FROM tenants WHERE id = $1 AND deleted_at IS NULL', [row.tenant_id])).rows[0];
      if (!t) return fail(INVALID(), 'tenant_missing');
      if (t.status === 'inactive') return fail(forbidden('This studio is currently inactive.', 'TENANT_INACTIVE'), 'tenant_inactive');
    }
    if (row.role !== 'super_admin') {
      const m = (await db.query<{ m: boolean }>('SELECT maintenance_mode AS m FROM platform_settings LIMIT 1')).rows[0];
      if (m?.m) return fail(new AppError(503, 'MAINTENANCE', 'The platform is under maintenance. Please try again shortly.'), 'maintenance');
    }
    await repo.touchLogin(db, row.id);
    await auditDb(db, { tenantId: row.tenant_id, userId: row.id, action: 'login', entity: 'user', entityId: row.id, ip });
    return { userId: row.id, role: row.role, tenantId: row.tenant_id, user: toUserDto(row) };
  },
 
  /** Self-service sign-up for a studio's customers. Runs inside that studio's tenant transaction. */
  async register(db: Db, body: unknown, ip?: string) {
    const input = registerSchema.parse(body);
    const problem = passwordProblem(input.password);
    if (problem) throw invalid(problem, { password: problem });
    const t = (await db.query<{ status: string }>('SELECT status FROM tenants WHERE id = $1 AND deleted_at IS NULL', [input.tenantId])).rows[0];
    if (!t) throw notFound('Studio');
    if (t.status === 'inactive') throw forbidden('This studio is not accepting sign-ups.', 'TENANT_INACTIVE');
    if (await repo.findByEmail(db, input.email, input.tenantId)) throw conflict('An account with this email already exists.');
 
    const userId = await repo.create(db, { tenantId: input.tenantId, role: 'client', name: input.name, email: input.email, phone: input.phone, passwordHash: await hashPassword(input.password) });
    // Attach to the customer record the studio may already have for this email (e.g. from an earlier enquiry), else create one.
    const existing = (await db.query<{ id: string }>('SELECT id FROM clients WHERE tenant_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL AND user_id IS NULL', [input.tenantId, input.email])).rows[0];
    if (existing) await db.query('UPDATE clients SET user_id = $2 WHERE id = $1', [existing.id, userId]);
    else await db.query(`INSERT INTO clients (tenant_id, user_id, name, email, phone, source) VALUES ($1,$2,$3,$4,$5,'website')`, [input.tenantId, userId, input.name, input.email, input.phone]);
    await auditDb(db, { tenantId: input.tenantId, userId, action: 'register', entity: 'user', entityId: userId, ip });
    const row = (await repo.findById(db, userId))!;
    return { userId, role: row.role, tenantId: row.tenant_id, user: toUserDto(row) };
  },
 
  async updateProfile(db: Db, me: Principal, body: unknown) {
    const patch = profileSchema.parse(body);
    await repo.updateProfile(db, me.userId, patch);
    return toUserDto((await repo.findById(db, me.userId)) ?? (() => { throw notFound('Account'); })());
  },
 
  async changePassword(db: Db, me: Principal, body: unknown, ip?: string) {
    const { current, next } = passwordSchema.parse(body);
    const row = (await repo.findById(db, me.userId)) ?? (() => { throw notFound('Account'); })();
    if (!(await verifyPassword(current, row.password_hash))) throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
    const problem = passwordProblem(next);
    if (problem) throw invalid(problem, { next: problem });
    if (next === current) throw invalid('Choose a password you have not used before.', { next: 'Same as current password' });
    await repo.setPassword(db, me.userId, await hashPassword(next));
    await auditDb(db, { tenantId: me.tenantId, userId: me.userId, action: 'change_password', entity: 'user', entityId: me.userId, ip });
    return { userId: me.userId, role: me.role, tenantId: me.tenantId };
  },
};