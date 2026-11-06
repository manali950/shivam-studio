import 'dotenv/config';
import { z } from 'zod';
 
const bool = (d: boolean) => z.enum(['true', 'false', '1', '0']).default(d ? 'true' : 'false').transform((v) => v === 'true' || v === '1');
 
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  MIGRATE_DATABASE_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN_HOURS: z.coerce.number().int().min(1).max(24 * 90).default(168),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional().transform((v) => v || undefined),
  CORS_ORIGINS: z.string().default('').transform((v) => v.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)),
  PLATFORM_BASE_DOMAIN: z.string().default('localhost').transform((v) => v.toLowerCase()),
  ENABLE_PUBLIC_TENANT_LIST: bool(true),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_API_MAX: z.coerce.number().int().min(10).default(600),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
});
 
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const msg = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${msg}\n\nCopy backend/.env.example to backend/.env and fill it in.`);
  process.exit(1);
}
 
export const env = { ...parsed.data, isProd: parsed.data.NODE_ENV === 'production' };
 
// A signing key copied from .env.example (or any obviously weak one) would let anyone forge sessions: refuse it in production.
if (env.isProd) {
  const secret = env.JWT_SECRET;
  if (/replace[-_ ]?me|change[-_ ]?me|example|secret|password/i.test(secret) || new Set(secret).size < 12) {
    console.error('Refusing to start: JWT_SECRET is a placeholder or too predictable. Generate one with:\n  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
  }
}