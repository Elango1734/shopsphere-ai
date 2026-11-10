import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { UserDto } from '@shopsphere/api-client';
import { api, setAccessToken, setOnUnauthorized } from '../api/client';

export type Permission = 'admin' | 'seller' | 'support_agent';

interface AuthContextValue {
  user: UserDto | null;
  isBootstrapping: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Background refresh cadence — comfortably inside the access token's default 15-minute TTL (config/env.ts's ACCESS_TOKEN_TTL_SECONDS). */
const SILENT_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearSession() {
    setAccessToken(null);
    setUser(null);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startSilentRefresh() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      api.auth
        .refresh()
        .then((result) => {
          setAccessToken(result.accessToken);
          setUser(result.user);
        })
        .catch(() => clearSession());
    }, SILENT_REFRESH_INTERVAL_MS);
  }

  useEffect(() => {
    setOnUnauthorized(() => clearSession());

    api.auth
      .refresh()
      .then((result) => {
        setAccessToken(result.accessToken);
        setUser(result.user);
        startSilentRefresh();
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setIsBootstrapping(false));

    return () => {
      setOnUnauthorized(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const result = await api.auth.login({ email, password });
    setAccessToken(result.accessToken);
    setUser(result.user);
    startSilentRefresh();
  }

  async function logout() {
    await api.auth.logout().catch(() => undefined);
    clearSession();
  }

  function hasRole(role: Permission): boolean {
    if (!user) return false;
    if (role === 'admin') return user.roles.includes('administrator');
    return user.roles.includes(role);
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, isBootstrapping, isAuthenticated: Boolean(user), login, logout, hasRole }),
    [user, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
