import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
 
const handler = (_req: unknown, res: { status(n: number): { json(b: unknown): void } }) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' } });
 
const make = (limit: number, windowMs = env.RATE_LIMIT_WINDOW_MS) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, handler });
 
/** Whole API, per IP. */
export const apiLimiter = make(env.RATE_LIMIT_API_MAX);
/** Login / register / change-password — slows credential stuffing. */
export const authLimiter = make(env.RATE_LIMIT_AUTH_MAX);
/** Anonymous write endpoints (booking enquiries, contact form) — slows spam. */
export const publicWriteLimiter = make(Math.max(30, env.RATE_LIMIT_AUTH_MAX * 2), 60 * 60 * 1000);