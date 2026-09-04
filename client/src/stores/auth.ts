import { create } from 'zustand';
import type { ShopUser } from '@/lib/types';
import { api, clearSession, getCachedUser, getToken, setSession } from '@/lib/api';

interface AuthState {
  user: ShopUser | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    company?: string;
    email?: string;
    phone?: string;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  refresh: () => void;
  setUser: (user: ShopUser) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: getCachedUser(),
  token: getToken(),
  refresh: () => set({ user: getCachedUser(), token: getToken() }),
  login: async (identifier, password) => {
    const res = await api<{ token: string; user: ShopUser }>('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    setSession(res.token, res.user);
    set({ user: res.user, token: res.token });
  },
  register: async (data) => {
    const res = await api<{ token: string; user: ShopUser }>('/api/auth/register', {
      method: 'POST',
      body: data,
    });
    setSession(res.token, res.user);
    set({ user: res.user, token: res.token });
  },
  logout: () => {
    clearSession();
    set({ user: null, token: null });
  },
  setUser: (user) => {
    const prev = getCachedUser();
    const merged = prev ? { ...prev, ...user } : user;
    setSession(getToken()!, merged);
    set({ user: merged });
  },
}));
