/**
 * Authentication state. In mock mode the session lives in localStorage (DEMO ONLY — see README "Security").
 * In api mode the server sets an httpOnly JWT cookie and `auth.me()` rehydrates the user.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, Role, User } from '@/types';
import { services } from '@/services/data-provider';
 
interface AuthState {
  user: User | null;
  loading: boolean;
  login(i: LoginInput): Promise<User>;
  register(i: RegisterInput): Promise<User>;
  logout(): Promise<void>;
  setUser(u: User): void;
}
const Ctx = createContext<AuthState | null>(null);
export const useAuth = () => useContext(Ctx)!;
 
export const ROLE_HOME: Record<Role, string> = { super_admin: '/platform', studio_admin: '/admin', photographer: '/photographer', client: '/portal' };
export const ROLE_LABEL: Record<Role, string> = { super_admin: 'Platform admin', studio_admin: 'Studio admin', photographer: 'Photographer', client: 'Client' };
 
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();
 
  useEffect(() => {
    let alive = true;
    services.auth.me().then((s) => { if (alive) setUser(s?.user ?? null); }).catch(() => undefined).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
 
  const login = useCallback(async (i: LoginInput) => { const s = await services.auth.login(i); setUser(s.user); qc.clear(); return s.user; }, [qc]);
  const register = useCallback(async (i: RegisterInput) => { const s = await services.auth.register(i); setUser(s.user); qc.clear(); return s.user; }, [qc]);
  const logout = useCallback(async () => { await services.auth.logout(); setUser(null); qc.clear(); }, [qc]);
 
  const value = useMemo(() => ({ user, loading, login, register, logout, setUser }), [user, loading, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}