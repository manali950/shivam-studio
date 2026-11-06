import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { Role } from './types.js';
 
export interface TokenClaims { sub: string; role: Role; tid: string | null; iat: number }
 
export const signToken = (c: { userId: string; role: Role; tenantId: string | null }) =>
  jwt.sign({ role: c.role, tid: c.tenantId }, env.JWT_SECRET, { subject: c.userId, expiresIn: `${env.JWT_EXPIRES_IN_HOURS}h`, algorithm: 'HS256', issuer: 'shivamstudio' });
 
/** Returns null for any invalid / expired token — callers treat that as "anonymous". */
export function readToken(token: string): TokenClaims | null {
  try {
    const p = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'shivamstudio' }) as jwt.JwtPayload;
    return typeof p.sub === 'string' && typeof p.iat === 'number' ? { sub: p.sub, role: p.role as Role, tid: (p.tid as string | null) ?? null, iat: p.iat } : null;
  } catch { return null; }
}