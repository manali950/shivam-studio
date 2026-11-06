import type { Db } from '../db/pool.js';
import type { Ctx } from './types.js';
 
/** Appends to audit_logs inside the caller's transaction (so an audit row exists iff the change committed). */
export async function auditDb(db: Db, e: { tenantId: string | null; userId?: string | null; action: string; entity: string; entityId?: string | null; metadata?: Record<string, unknown>; ip?: string }) {
  await db.query(
    'INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, metadata, ip) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)',
    [e.tenantId, e.userId ?? null, e.action, e.entity, e.entityId ?? null, JSON.stringify(e.metadata ?? {}), e.ip ?? null]);
}
export const audit = (ctx: Ctx, action: string, entity: string, entityId?: string | null, metadata?: Record<string, unknown>) =>
  auditDb(ctx.db, { tenantId: ctx.tenantId, userId: ctx.principal?.userId, action, entity, entityId, metadata, ip: ctx.ip });