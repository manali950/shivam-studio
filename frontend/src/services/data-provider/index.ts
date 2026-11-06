/**
 * Single entry point for ALL data access. Pages and hooks import `services` from here — never JSON, never fetch.
 *
 *   VITE_DATA_MODE=mock  → mock-provider.ts   (default; JSON + localStorage, no backend needed)
 *   VITE_DATA_MODE=api   → api-provider.ts    (REST at VITE_API_BASE_URL)
 *
 * Vite replaces the env var at build time, so the unused provider is tree-shaken out of the bundle.
 */
import type { DataProvider } from './types';
 
export const DATA_MODE: 'mock' | 'api' = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'mock';
 
export const services: DataProvider =
  DATA_MODE === 'api'
    ? (await import('./api-provider')).createApiProvider()
    : (await import('./mock-provider')).mockProvider;
 
/** Dev helper (mock mode only): restore the seed datasets and sign out. */
export async function resetDemoData() {
  if (DATA_MODE !== 'mock') return;
  (await import('./mock-provider')).resetDb();
}
 
export type { DataProvider, Paged, ListParams } from './types';