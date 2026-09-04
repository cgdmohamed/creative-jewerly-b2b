import { create } from 'zustand';
import type { AdminEmployee } from '@/lib/types';
import { adminApi, clearAdminSession, getAdminToken, getCachedAdmin, setAdminSession } from '@/lib/api';

interface AdminState {
  admin: AdminEmployee | null;
  token: string | null;
  login: (identifier: string, pin: string) => Promise<void>;
  logout: () => void;
}

export const useAdmin = create<AdminState>((set) => ({
  admin: getCachedAdmin(),
  token: getAdminToken(),
  login: async (identifier, pin) => {
    const res = await adminApi<{ token: string; admin: AdminEmployee }>('/api/admin/login', {
      method: 'POST',
      body: { identifier, pin },
    });
    setAdminSession(res.token, res.admin);
    set({ admin: res.admin, token: res.token });
  },
  logout: () => {
    clearAdminSession();
    set({ admin: null, token: null });
  },
}));
