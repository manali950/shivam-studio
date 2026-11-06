type RGB = [number, number, number];
 
const hexToRgb = (hex: string): RGB => {
  const h = hex.replace('#', '').trim();
  const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = parseInt(f, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const lum = ([r, g, b]: RGB) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const css = (c: RGB) => c.join(' ');
 
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [20, 18, 16];
const INK: RGB = [29, 27, 25];
 
export const isHexColor = (s: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
 
/** Writes tenant brand colours as CSS variables; Tailwind's `brand`/`accent` colours read them. */
export function applyTheme(primary: string, secondary: string) {
  const root = document.documentElement.style;
  const p = hexToRgb(isHexColor(primary) ? primary : '#B08D57');
  const s = hexToRgb(isHexColor(secondary) ? secondary : '#1d1b19');
  root.setProperty('--brand', css(p));
  root.setProperty('--brand-dark', css(mix(p, BLACK, 0.22)));
  root.setProperty('--brand-soft', css(mix(p, WHITE, 0.88)));
  root.setProperty('--brand-contrast', css(lum(p) > 0.62 ? INK : WHITE));
  root.setProperty('--accent', css(s));
  root.setProperty('--accent-soft', css(mix(s, WHITE, 0.9)));
}
export const resetTheme = () => applyTheme('#B08D57', '#1d1b19');
 
export function setFavicon(href: string) {
  const el = document.getElementById('favicon') as HTMLLinkElement | null;
  if (el && href) el.href = href;
}