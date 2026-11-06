import type { Response } from 'express';
import { env } from '../config/env.js';
 
export const SESSION_COOKIE = 'ss_session';
 
/** httpOnly (no JS access → XSS cannot steal it), Secure in production / SameSite=None, SameSite per config. */
export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, secure: env.isProd || env.COOKIE_SAMESITE === 'none', sameSite: env.COOKIE_SAMESITE, domain: env.COOKIE_DOMAIN,
    path: '/', maxAge: env.JWT_EXPIRES_IN_HOURS * 3600 * 1000,
  });
}
export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: env.isProd || env.COOKIE_SAMESITE === 'none', sameSite: env.COOKIE_SAMESITE, domain: env.COOKIE_DOMAIN, path: '/' });
}