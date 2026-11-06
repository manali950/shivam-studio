/**
 * Password hashing with scrypt (node:crypto — no native addon). Stored as  scrypt$N$r$p$saltB64$hashB64.
 * tools/generate-seed.mjs writes the same format, so seeded demo accounts verify with this code.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
 
const N = 16384, R = 8, P = 1, KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;
 
const derive = (pw: string, salt: Buffer, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scrypt(pw, salt, KEYLEN, { ...opts, maxmem: MAXMEM }, (e, k) => (e ? reject(e) : resolve(k))));
 
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(pw, salt, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}
 
export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(pw, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
 
/** Verified against when the account does not exist so response time does not reveal which emails are registered. */
export const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16, 7).toString('base64')}$${Buffer.alloc(KEYLEN, 9).toString('base64')}`;
 
/** Policy: 8–128 characters with at least one letter and one digit. */
export const passwordProblem = (pw: string): string | null =>
  pw.length < 8 ? 'Password must be at least 8 characters.' : pw.length > 128 ? 'Password must be at most 128 characters.'
  : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Password must contain at least one letter and one number.' : null;
 
export const randomPassword = () => `${randomBytes(9).toString('base64url')}-${Math.floor(10 + Math.random() * 89)}`;