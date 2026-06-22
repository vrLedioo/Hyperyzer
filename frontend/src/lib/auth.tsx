'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, setToken, clearToken, getToken } from './api';

export interface User {
  id: number;
  email: string;
  credits: number;             // purchased pack credits (never expire)
  subscription_credits: number; // monthly plan allowance (refills)
  total_credits: number;        // spendable now
  plan: string;                 // "free" | "creator" | "pro" | "agency"
  subscription_status: string;
  // Team-aware effective entitlement (from /api/auth/me).
  effective_plan?: string;      // plan whose capabilities apply right now
  studio_features?: string[];   // Studio capability keys the user can use
  pool_credits?: number;        // spendable credits backing the user (team pool if a member)
  team_id?: number | null;
  team_role?: string | null;    // "owner" | "member" | null
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>('/api/auth/me');
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    setToken(res.access_token);
    await refresh();
  }, [refresh]);

  const signup = useCallback(async (email: string, password: string) => {
    // Signup no longer logs the user in: they must confirm their email first.
    // The signup page shows a "check your inbox" state on success.
    await api('/api/auth/signup', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
