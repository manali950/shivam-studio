import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { log } from '../lib/logger.js';
 
const UNIQUE_MESSAGES: Record<string, string> = {
  users_email_tenant_uq: 'An account with this email already exists.',
  users_email_platform_uq: 'An account with this email already exists.',
  clients_email_uq: 'A customer with this email already exists.',
  tenants_slug_uq: 'A studio with this slug already exists.',
  tenants_subdomain_uq: 'A studio with this subdomain already exists.',
  tenants_domain_uq: 'That custom domain is already used by another studio.',
  photographers_slug_uq: 'A photographer with this name already exists.',
  services_slug_uq: 'A service with this name already exists.',
  blog_posts_slug_uq: 'An article with this slug already exists.',
  events_booking_uq: 'This booking already has an event.',
};
 
const fieldLabel = (path: (string | number)[]) => (path.length ? String(path[path.length - 1]).replace(/([A-Z])/g, ' $1').toLowerCase() : '');
 
export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
}
 
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.requestId;
  const body = (status: number, code: string, message: string, details?: unknown) => res.status(status).json({ error: { code, message, details, requestId } });
 
  if (err instanceof AppError) return void body(err.status, err.code, err.message, err.details);
 
  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const i of err.issues) { const k = i.path.join('.') || '_'; details[k] ??= i.message; }
    const first = err.issues[0];
    const label = first ? fieldLabel(first.path) : '';
    return void body(422, 'VALIDATION_ERROR', err.issues.length === 1 && first ? (label ? `${label[0].toUpperCase()}${label.slice(1)}: ${first.message}` : first.message) : 'Please correct the highlighted fields.', details);
  }
 
  const e = err as { code?: string; constraint?: string; message?: string; type?: string; status?: number };
  if (e?.type === 'entity.parse.failed') return void body(400, 'BAD_JSON', 'Request body is not valid JSON.');
  if (e?.type === 'entity.too.large') return void body(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  switch (e?.code) {
    case '23505': return void body(409, 'CONFLICT', UNIQUE_MESSAGES[e.constraint ?? ''] ?? 'A record with the same value already exists.');
    case '23503': return void (/still referenced/.test(e.message ?? '')
      ? body(409, 'CONFLICT', 'This record is still in use and cannot be removed.')
      : body(422, 'VALIDATION_ERROR', 'A referenced record does not exist in this studio.'));
    case '23514': return void body(422, 'VALIDATION_ERROR', 'One of the values is outside the allowed range.', { constraint: e.constraint });
    case '23502': return void body(422, 'VALIDATION_ERROR', 'A required value is missing.');
    case '22P02': case '22007': case '22008': case '22003': return void body(422, 'VALIDATION_ERROR', 'One of the values has an invalid format.');
    case '42501': return void body(403, 'TENANT_FORBIDDEN', 'You do not have access to this studio.');
  }
 
  log.error('Unhandled error', { requestId, method: req.method, path: req.path, error: (err as Error)?.message, stack: env.isProd ? undefined : (err as Error)?.stack });
  body(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
}