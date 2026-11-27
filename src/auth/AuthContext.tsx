import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  api, clearSession, getToken, readCachedUser, setUnauthorizedHandler, storeSession, storeUser,
} from '../api/client';
import type { AuthUser, Role } from '../api/types';

export const SESSION_ENDED = 'Your session has ended. Please sign in again.';

interface AuthState {
  user: AuthUser | null;
  booting: boolean;
  notice: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearNotice: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(() => (getToken() ? readCachedUser() : null));
  const [booting, setBooting] = useState<boolean>(() => !!getToken());
  const [notice, setNotice] = useState<string | null>(null);

  const dropSession = useCallback(
    (message: string | null) => {
      clearSession();
      setUser(null);
      qc.clear();
      setNotice(message);
    },
    [qc],
  );

  // Any 401 from the API ends the session (spec 5.9 / 5.10).
  useEffect(() => {
    setUnauthorizedHandler(() => dropSession(SESSION_ENDED));
    return () => setUnauthorizedHandler(null);
  }, [dropSession]);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api<AuthUser>('/api/auth/me/')
      .then((me) => {
        if (cancelled) return;
        storeUser(me);
        setUser(me);
      })
      .catch(() => {
        /* 401 handled globally; network errors keep cached user */
      })
      .finally(() => !cancelled && setBooting(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api<{ token: string; user: AuthUser }>('/api/auth/login/', {
        method: 'POST',
        body: { username: username.trim(), password },
        auth: false,
      });
      qc.clear();
      storeSession(res.token, res.user);
      setNotice(null);
      setUser(res.user);
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api<void>('/api/auth/logout/', { method: 'POST' });
    } catch {
      /* token may already be invalid; local logout still proceeds */
    }
    dropSession(null);
  }, [dropSession]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      booting,
      notice,
      login,
      logout,
      clearNotice: () => setNotice(null),
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, booting, notice, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const canOperate = (role?: Role) => role === 'admin' || role === 'technician';
export const canAudit = (role?: Role) => role === 'admin' || role === 'auditor';
