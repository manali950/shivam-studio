import type { ISODate } from '@/types';
 
export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
 
export const uid = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
 
export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
 
export function formatMoney(amount: number, currency = 'INR', locale = 'en-IN', compact = false) {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, maximumFractionDigits: 0,
    ...(compact ? { notation: 'compact', maximumFractionDigits: 1 } : {}),
  }).format(amount || 0);
}
 
export const formatDate = (d?: ISODate | null, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  d ? new Date(d).toLocaleDateString('en-GB', opts) : '—';
export const formatDateTime = (d?: ISODate | null) =>
  d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
 
export function timeAgo(d: ISODate) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  const abs = Math.abs(s);
  const fmt = (n: number, u: string) => `${n}${u}`;
  const v = abs < 60 ? 'just now' : abs < 3600 ? fmt(Math.floor(abs / 60), 'm') : abs < 86400 ? fmt(Math.floor(abs / 3600), 'h') : abs < 86400 * 30 ? fmt(Math.floor(abs / 86400), 'd') : formatDate(d, { day: 'numeric', month: 'short' });
  return v === 'just now' || abs >= 86400 * 30 ? v : s >= 0 ? `${v} ago` : `in ${v}`;
}
 
/** Whole calendar days from today to date (negative = past). */
export function daysUntil(d: ISODate) {
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
 
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => isoDay(new Date());
export const hoursSince = (d: ISODate) => (Date.now() - new Date(d).getTime()) / 3600000;
 
export const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const titleCase = (s: string) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
 
/** Rewrite an Unsplash-style URL to request a specific width (responsive sizing). Other URLs pass through. */
export function imgUrl(url: string, width = 800, quality = 70) {
  if (!url) return '';
  if (!url.includes('images.unsplash.com')) return url;
  const u = new URL(url);
  u.searchParams.set('auto', 'format'); u.searchParams.set('fit', 'crop');
  u.searchParams.set('w', String(width)); u.searchParams.set('q', String(quality));
  return u.toString();
}
export const imgSrcSet = (url: string, widths = [400, 800, 1200]) =>
  url.includes('images.unsplash.com') ? widths.map((w) => `${imgUrl(url, w)} ${w}w`).join(', ') : undefined;
 
/** Simple whole-row text search helper used by the mock provider and tables. */
export const matchesSearch = (haystack: (string | undefined | null)[], q?: string) =>
  !q || haystack.some((h) => h?.toLowerCase().includes(q.toLowerCase()));