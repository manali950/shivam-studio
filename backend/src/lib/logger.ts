import { env } from '../config/env.js';
 
const levels = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 } as const;
const min = levels[env.LOG_LEVEL];
const emit = (lvl: keyof typeof levels, msg: string, meta?: Record<string, unknown>) => {
  if (levels[lvl] < min) return;
  const line = env.isProd ? JSON.stringify({ t: new Date().toISOString(), lvl, msg, ...meta }) : `${lvl.toUpperCase().padEnd(5)} ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
  (lvl === 'error' ? console.error : console.log)(line);
};
export const log = {
  debug: (m: string, x?: Record<string, unknown>) => emit('debug', m, x),
  info: (m: string, x?: Record<string, unknown>) => emit('info', m, x),
  warn: (m: string, x?: Record<string, unknown>) => emit('warn', m, x),
  error: (m: string, x?: Record<string, unknown>) => emit('error', m, x),
};