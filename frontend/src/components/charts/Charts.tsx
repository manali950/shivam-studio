/**
 * Dependency-free SVG/HTML charts. One brand series colour by default; status charts use reserved semantic colours.
 * Marks are thin, grid is recessive, every chart has a hover/tooltip layer and a text value fallback.
 */
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
 
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300']; // validated categorical order
const BRAND = 'rgb(var(--brand))';
 
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
 
export function Sparkline({ data, className, color = BRAND }: { data: number[]; className?: string; color?: string }) {
  const w = 64, h = 28, max = Math.max(...data, 1), min = Math.min(...data, 0);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  return (
    <svg width={w} height={h} className={className} aria-hidden>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={color} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
 
export interface Point { label: string; value: number; sub?: number }
export function AreaChart({ data, height = 190, format = (n: number) => String(n), color = BRAND, secondaryLabel }: { data: Point[]; height?: number; format?: (n: number) => string; color?: string; secondaryLabel?: string }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 6, r: 6, t: 14, b: 22 };
  const max = Math.max(...data.map((d) => d.value), 1) * 1.1;
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1)},${height - pad.b} L${x(0)},${height - pad.b} Z`;
  const gid = useRef(`g${Math.random().toString(36).slice(2, 7)}`).current;
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={`Chart: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const rel = (e.clientX - r.left - pad.l) / (w - pad.l - pad.r); setHover(Math.min(data.length - 1, Math.max(0, Math.round(rel * (data.length - 1))))); }}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".22" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {[0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={pad.l} x2={w - pad.r} y1={y(max * t / 1.1)} y2={y(max * t / 1.1)} stroke="#e6e0d5" strokeDasharray="2 4" />)}
          <line x1={pad.l} x2={w - pad.r} y1={height - pad.b} y2={height - pad.b} stroke="#d8d1c4" />
          <path d={area} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => <text key={d.label} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'} className="fill-ink-muted text-[10px]">{d.label}</text>)}
          {hover !== null && <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="#9a948b" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="4.5" fill={color} stroke="#fff" strokeWidth="2" />
          </>}
          {hover === null && <circle cx={x(data.length - 1)} cy={y(data[data.length - 1].value)} r="4" fill={color} stroke="#fff" strokeWidth="2" />}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-pop" style={{ left: Math.min(Math.max(x(hover) - 50, 0), w - 110), top: 0 }}>
          <p className="text-[10px] uppercase tracking-wide text-ink-muted">{data[hover].label}</p>
          <p className="font-semibold tabular-nums text-ink">{format(data[hover].value)}</p>
          {data[hover].sub !== undefined && <p className="text-ink-muted">{data[hover].sub} {secondaryLabel}</p>}
        </div>
      )}
    </div>
  );
}
 
export function BarList({ items, format = (n: number) => String(n), color = BRAND, max }: { items: { label: string; value: number; hint?: string; color?: string }[]; format?: (n: number) => string; color?: string; max?: number }) {
  const m = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(i.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs"><span className="truncate text-ink-2">{i.label}</span><span className="shrink-0 font-semibold tabular-nums text-ink">{format(i.value)}{i.hint && <span className="ml-1 font-normal text-ink-muted">{i.hint}</span>}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-paper-2"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(2, (i.value / m) * 100)}%`, background: i.color ?? color }} /></div>
        </li>
      ))}
    </ul>
  );
}
 
export function Donut({ segments, centerValue, centerLabel, size = 112 }: { segments: { label: string; value: number; color: string }[]; centerValue?: string | number; centerLabel?: string; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 9, c = 2 * Math.PI * r;
  let acc = 0;
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3efe8" strokeWidth="12" />
          {segments.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * c; const off = acc; acc += len;
            return <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={hover === s.label ? 14 : 12} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-off} onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)} className="transition-all"><title>{`${s.label}: ${s.value}`}</title></circle>;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center"><div><p className="text-xl font-semibold leading-none tabular-nums">{hover ? segments.find((s) => s.label === hover)?.value : centerValue ?? total}</p><p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-muted">{hover ?? centerLabel}</p></div></div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {segments.map((s) => (
          <li key={s.label} className={cn('flex items-center gap-2', hover === s.label && 'font-semibold')} onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} /><span className="truncate text-ink-2">{s.label}</span><span className="ml-auto tabular-nums text-ink">{s.value}</span>
          </li>
        ))}
      </ul>-
    </div>
  );
}
 
export function ProgressBar({ value, max = 100, className, color }: { value: number; max?: number; className?: string; color?: string }) {
  return <div className={cn('h-1.5 overflow-hidden rounded-full bg-paper-2', className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}><div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>;
}