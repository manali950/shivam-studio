import type { Db } from '../../db/pool.js';
import type { Principal } from '../../lib/types.js';
 
export interface UserRow {
  id: string; tenant_id: string | null; role: Principal['role']; name: string; email: string; phone: string; avatar_url: string; password_hash: string;
  status: 'active' | 'disabled'; client_id: string | null; photographer_id: string | null;
}
 
const USER = `u.id, u.tenant_id, u.role, u.name, u.email, u.phone, u.avatar_url, u.password_hash, u.status,
  (SELECT c.id FROM clients c WHERE c.user_id = u.id AND c.deleted_at IS NULL) AS client_id,
  (SELECT p.id FROM photographers p WHERE p.user_id = u.id AND p.deleted_at IS NULL) AS photographer_id`;
 
/** The public shape of a user (never includes the password hash). */
export const toUserDto = (r: Pick<UserRow, 'id' | 'tenant_id' | 'role' | 'name' | 'email' | 'phone' | 'avatar_url' | 'status' | 'client_id' | 'photographer_id'>) => ({
  id: r.id, tenantId: r.tenant_id, role: r.role, name: r.name, email: r.email, phone: r.phone, avatarUrl: r.avatar_url, clientId: r.client_id, photographerId: r.photographer_id, status: r.status,
});
 
export const authRepository = {
  /** Must run in a system (or matching tenant) transaction — `users` is protected by row-level security. */
  async findByEmail(db: Db, email: string, tenantId: string | null): Promise<UserRow | null> {
    return (await db.query<UserRow>(
      `SELECT ${USER} FROM users u WHERE lower(u.email) = lower($1) AND u.tenant_id IS NOT DISTINCT FROM $2 AND u.deleted_at IS NULL`, [email, tenantId])).rows[0] ?? null;
  },
  async findById(db: Db, id: string): Promise<UserRow | null> {
    return (await db.query<UserRow>(`SELECT ${USER} FROM users u WHERE u.id = $1 AND u.deleted_at IS NULL`, [id])).rows[0] ?? null;
  },
  async create(db: Db, u: { tenantId: string | null; role: Principal['role']; name: string; email: string; phone: string; passwordHash: string }): Promise<string> {
    return (await db.query<{ id: string }>(
      `INSERT INTO users (tenant_id, role, name, email, phone, password_hash, password_changed_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [u.tenantId, u.role, u.name, u.email, u.phone, u.passwordHash, new Date()])).rows[0].id;
  },
  async touchLogin(db: Db, id: string) { await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]); },
  async setPassword(db: Db, id: string, hash: string) {
    // App clock (not now()) so it is comparable with the JWT `iat` claim even if the DB server's clock differs.
    await db.query('UPDATE users SET password_hash = $2, password_changed_at = $3 WHERE id = $1', [id, hash, new Date()]);
  },
  async updateProfile(db: Db, id: string, patch: { name?: string; phone?: string; avatarUrl?: string }) {
    await db.query('UPDATE users SET name = COALESCE($2, name), phone = COALESCE($3, phone), avatar_url = COALESCE($4, avatar_url) WHERE id = $1', [id, patch.name ?? null, patch.phone ?? null, patch.avatarUrl ?? null]);
    // Keep the linked customer / photographer record's contact details in step with the account.
    await db.query('UPDATE clients SET name = COALESCE($2, name), phone = COALESCE($3, phone) WHERE user_id = $1', [id, patch.name ?? null, patch.phone ?? null]);
    await db.query('UPDATE photographers SET name = COALESCE($2, name), phone = COALESCE($3, phone), avatar_url = COALESCE($4, avatar_url) WHERE user_id = $1', [id, patch.name ?? null, patch.phone ?? null, patch.avatarUrl ?? null]);
  },
};